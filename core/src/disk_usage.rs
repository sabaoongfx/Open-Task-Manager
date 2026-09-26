//! WinDirStat-style disk usage scan: walks a folder, sizes every file and folder, and tallies
//! space per file extension. Shared by the GUI's Disk usage tab and `otm`'s.

use rayon::prelude::*;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs::{self, Metadata};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;

/// Items smaller than `total / PRUNE_DIVISOR` are folded into one "N smaller items" entry per
/// folder, so a scan of a whole drive stays a few thousand nodes instead of millions (the GUI
/// gets the whole tree in one message, and a treemap can't draw sub-pixel files anyway).
const PRUNE_DIVISOR: u64 = 10_000;

/// The extension list is cut to the biggest this many.
const MAX_EXTENSIONS: usize = 200;

/// Shared between a running scan and whoever started it: a live file count for progress
/// display, and a flag to stop early.
#[derive(Default)]
pub struct ScanProgress {
    files: AtomicU64,
    cancelled: AtomicBool,
}

impl ScanProgress {
    pub fn new() -> Self {
        Self::default()
    }

    /// Files counted so far by the current scan.
    pub fn files(&self) -> u64 {
        self.files.load(Ordering::Relaxed)
    }

    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::Relaxed);
    }

    fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Relaxed)
    }

    fn reset(&self) {
        self.files.store(0, Ordering::Relaxed);
        self.cancelled.store(false, Ordering::Relaxed);
    }
}

#[derive(Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum NodeKind {
    Dir,
    File,
    /// Several small items folded together (see `PRUNE_DIVISOR`).
    Other,
}

#[derive(Serialize, Clone, Debug)]
pub struct DiskNode {
    /// File or folder name; the root's is its full path.
    pub name: String,
    pub kind: NodeKind,
    /// Bytes on disk (allocated blocks on Unix, so sparse files count what they really use).
    pub size: u64,
    /// Number of files at or under this node.
    pub files: u64,
    /// Sorted biggest first.
    pub children: Vec<DiskNode>,
}

#[derive(Serialize, Clone, Debug)]
pub struct ExtensionStat {
    /// Lowercase, without the dot; empty for files with no extension.
    pub ext: String,
    pub size: u64,
    pub files: u64,
}

#[derive(Serialize, Clone, Debug)]
pub struct DiskScan {
    /// The absolute path that was scanned.
    pub path: String,
    pub root: DiskNode,
    /// Biggest first.
    pub extensions: Vec<ExtensionStat>,
    /// Folders that couldn't be read (usually permission denied).
    pub errors: u64,
    pub cancelled: bool,
}

pub fn home_dir() -> Option<PathBuf> {
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" })
        .filter(|v| !v.is_empty())
        .map(PathBuf::from)
}

/// Lowercase extension of a file name, or "" if it has none (dotfiles like `.bashrc` have none).
pub fn extension_of(name: &str) -> String {
    match name.rfind('.') {
        Some(i) if i > 0 && i + 1 < name.len() => name[i + 1..].to_lowercase(),
        _ => String::new(),
    }
}

#[cfg(unix)]
fn allocated_size(meta: &Metadata) -> u64 {
    use std::os::unix::fs::MetadataExt;
    meta.blocks() * 512
}

#[cfg(not(unix))]
fn allocated_size(meta: &Metadata) -> u64 {
    meta.len()
}

#[cfg(unix)]
fn device_of(meta: &Metadata) -> Option<u64> {
    use std::os::unix::fs::MetadataExt;
    Some(meta.dev())
}

#[cfg(not(unix))]
fn device_of(_meta: &Metadata) -> Option<u64> {
    None
}

/// For files with more than one hard link: an id to count them only once.
#[cfg(unix)]
fn hard_link_id(meta: &Metadata) -> Option<(u64, u64)> {
    use std::os::unix::fs::MetadataExt;
    (meta.nlink() > 1).then(|| (meta.dev(), meta.ino()))
}

#[cfg(not(unix))]
fn hard_link_id(_meta: &Metadata) -> Option<(u64, u64)> {
    None
}

struct Walk<'a> {
    progress: &'a ScanProgress,
    /// Stay on the starting filesystem, like WinDirStat per drive or `du -x`: scanning `/`
    /// shouldn't wander into /proc, network mounts or other drives.
    device: Option<u64>,
    errors: AtomicU64,
    hard_links: Mutex<HashSet<(u64, u64)>>,
}

impl Walk<'_> {
    fn dir(&self, path: &Path, name: String) -> DiskNode {
        let mut node = DiskNode { name, kind: NodeKind::Dir, size: 0, files: 0, children: Vec::new() };
        if self.progress.is_cancelled() {
            return node;
        }
        let entries = match fs::read_dir(path) {
            Ok(entries) => entries,
            Err(_) => {
                self.errors.fetch_add(1, Ordering::Relaxed);
                return node;
            }
        };

        let mut subdirs = Vec::new();
        for entry in entries.flatten() {
            // DirEntry::metadata doesn't follow symlinks, so links are sized as themselves.
            let Ok(meta) = entry.metadata() else { continue };
            let name = entry.file_name().to_string_lossy().into_owned();
            if meta.is_dir() {
                if self.device.is_none() || device_of(&meta) == self.device {
                    subdirs.push((entry.path(), name));
                }
                continue;
            }
            self.progress.files.fetch_add(1, Ordering::Relaxed);
            let counted = hard_link_id(&meta).is_none_or(|id| self.hard_links.lock().unwrap().insert(id));
            let size = if counted { allocated_size(&meta) } else { 0 };
            node.children.push(DiskNode { name, kind: NodeKind::File, size, files: 1, children: Vec::new() });
        }

        let dirs: Vec<DiskNode> = subdirs.into_par_iter().map(|(path, name)| self.dir(&path, name)).collect();
        node.children.extend(dirs);
        node.size = node.children.iter().map(|c| c.size).sum();
        node.files = node.children.iter().map(|c| c.files).sum();
        node.children.sort_by(|a, b| b.size.cmp(&a.size).then_with(|| a.name.cmp(&b.name)));
        node
    }
}

fn tally_extensions(node: &DiskNode, out: &mut HashMap<String, (u64, u64)>) {
    match node.kind {
        NodeKind::File => {
            let entry = out.entry(extension_of(&node.name)).or_default();
            entry.0 += node.size;
            entry.1 += 1;
        }
        _ => node.children.iter().for_each(|c| tally_extensions(c, out)),
    }
}

/// Folds every child smaller than `threshold` into one `Other` node, recursively.
fn prune(node: &mut DiskNode, threshold: u64) {
    let split = node.children.partition_point(|c| c.size >= threshold);
    let small = node.children.split_off(split);
    if small.len() == 1 {
        node.children.extend(small);
    } else if !small.is_empty() {
        node.children.push(DiskNode {
            name: format!("{} smaller items", small.len()),
            kind: NodeKind::Other,
            size: small.iter().map(|c| c.size).sum(),
            files: small.iter().map(|c| c.files).sum(),
            children: Vec::new(),
        });
    }
    for child in &mut node.children {
        prune(child, threshold);
    }
}

/// Scans `path` (a folder) and everything under it on the same filesystem. Blocks until done
/// or cancelled through `progress`; runs folders in parallel on rayon's pool.
pub fn scan_disk_usage(path: &Path, progress: &ScanProgress) -> Result<DiskScan, String> {
    progress.reset();
    let path = fs::canonicalize(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let meta = fs::metadata(&path).map_err(|e| format!("{}: {e}", path.display()))?;
    if !meta.is_dir() {
        return Err(format!("{} is not a folder", path.display()));
    }
    let display = path.to_string_lossy().into_owned();

    let walk = Walk { progress, device: device_of(&meta), errors: AtomicU64::new(0), hard_links: Mutex::default() };
    let mut root = walk.dir(&path, display.clone());

    let mut by_ext = HashMap::new();
    tally_extensions(&root, &mut by_ext);
    let mut extensions: Vec<ExtensionStat> =
        by_ext.into_iter().map(|(ext, (size, files))| ExtensionStat { ext, size, files }).collect();
    extensions.sort_by(|a, b| b.size.cmp(&a.size).then_with(|| a.ext.cmp(&b.ext)));
    extensions.truncate(MAX_EXTENSIONS);

    let threshold = (root.size / PRUNE_DIVISOR).max(1);
    prune(&mut root, threshold);

    Ok(DiskScan {
        path: display,
        root,
        extensions,
        errors: walk.errors.into_inner(),
        cancelled: progress.is_cancelled(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_tree() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("otm-disk-usage-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("videos/old")).unwrap();
        fs::create_dir_all(dir.join("empty")).unwrap();
        fs::write(dir.join("videos/big.mkv"), vec![1u8; 400_000]).unwrap();
        fs::write(dir.join("videos/old/clip.mkv"), vec![1u8; 100_000]).unwrap();
        fs::write(dir.join("notes.txt"), vec![1u8; 20_000]).unwrap();
        fs::write(dir.join(".bashrc"), vec![1u8; 10_000]).unwrap();
        dir
    }

    #[test]
    fn extension_parsing() {
        assert_eq!(extension_of("movie.MKV"), "mkv");
        assert_eq!(extension_of("archive.tar.gz"), "gz");
        assert_eq!(extension_of(".bashrc"), "");
        assert_eq!(extension_of("Makefile"), "");
        assert_eq!(extension_of("trailing."), "");
    }

    #[test]
    fn scans_sizes_and_extensions() {
        let dir = temp_tree();
        let scan = scan_disk_usage(&dir, &ScanProgress::new()).unwrap();
        let _ = fs::remove_dir_all(&dir);

        let root = &scan.root;
        assert_eq!(root.kind, NodeKind::Dir);
        assert_eq!(root.files, 4);
        assert!(!scan.cancelled);
        assert_eq!(root.size, root.children.iter().map(|c| c.size).sum::<u64>());
        // Biggest first: the videos folder holds most of the bytes.
        assert_eq!(root.children[0].name, "videos");
        assert_eq!(root.children[0].files, 2);
        assert!(root.children.windows(2).all(|w| w[0].size >= w[1].size));
        assert!(root.children.iter().any(|c| c.name == "empty" && c.size == 0 && c.kind == NodeKind::Dir));

        assert_eq!(scan.extensions[0].ext, "mkv");
        assert_eq!(scan.extensions[0].files, 2);
        assert!(scan.extensions.iter().any(|e| e.ext.is_empty() && e.files == 1));
    }

    #[test]
    fn prune_folds_small_items() {
        let file = |name: &str, size| DiskNode {
            name: name.to_string(),
            kind: NodeKind::File,
            size,
            files: 1,
            children: Vec::new(),
        };
        let mut root = DiskNode {
            name: "/".into(),
            kind: NodeKind::Dir,
            size: 1_000,
            files: 4,
            children: vec![file("a", 900), file("b", 50), file("c", 30), file("d", 20)],
        };
        prune(&mut root, 40);
        let names: Vec<&str> = root.children.iter().map(|c| c.name.as_str()).collect();
        assert_eq!(names, ["a", "b", "2 smaller items"]);
        assert_eq!(root.children[2].kind, NodeKind::Other);
        assert_eq!(root.children[2].size, 50);
        assert_eq!(root.children[2].files, 2);
    }

    #[test]
    fn rejects_files_and_missing_paths() {
        assert!(scan_disk_usage(Path::new("/definitely/not/here"), &ScanProgress::new()).is_err());
        let file = std::env::temp_dir().join(format!("otm-disk-usage-file-{}", std::process::id()));
        fs::write(&file, b"x").unwrap();
        let result = scan_disk_usage(&file, &ScanProgress::new());
        let _ = fs::remove_file(&file);
        assert!(result.unwrap_err().contains("not a folder"));
    }
}
