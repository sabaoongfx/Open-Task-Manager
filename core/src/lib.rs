//! System data collection shared by the Tauri GUI (`src-tauri`) and the terminal UI (`tui`).

use serde::Serialize;
use std::collections::HashMap;
use std::time::Instant;
use sysinfo::{DiskKind, Disks, Networks, Pid, System, Users};

mod disk_usage;
pub use disk_usage::{home_dir, scan_disk_usage, DiskNode, DiskScan, ExtensionStat, NodeKind, ScanProgress};

#[cfg(target_os = "linux")]
fn read_disk_io_ticks() -> HashMap<String, u64> {
    let mut map = HashMap::new();
    if let Ok(content) = std::fs::read_to_string("/proc/diskstats") {
        for line in content.lines() {
            let fields: Vec<&str> = line.split_whitespace().collect();
            if fields.len() >= 13 {
                if let Ok(io_ticks_ms) = fields[12].parse::<u64>() {
                    map.insert(fields[2].to_string(), io_ticks_ms);
                }
            }
        }
    }
    map
}

#[cfg(not(target_os = "linux"))]
fn read_disk_io_ticks() -> HashMap<String, u64> {
    HashMap::new()
}

#[derive(Serialize, Clone)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    /// Percent of the whole CPU (all cores), like Windows Task Manager: every process together
    /// adds up to at most the system-wide `SystemStats::cpu_usage`.
    pub cpu_usage: f32,
    pub memory: u64,
    pub disk_bytes_per_sec: f64,
    pub status: String,
    pub user_name: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct CpuInfo {
    pub brand: String,
    pub frequency_mhz: u64,
    pub physical_cores: usize,
    pub logical_cores: usize,
}

#[derive(Serialize, Clone)]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub kind: String,
    pub total_bytes: u64,
    pub available_bytes: u64,
    pub active_percent: f64,
}

#[derive(Serialize, Clone)]
pub struct NetworkInterface {
    pub name: String,
    pub rx_bytes_per_sec: f64,
    pub tx_bytes_per_sec: f64,
}

#[derive(Serialize, Clone)]
pub struct SystemStats {
    pub cpu_usage: f32,
    pub total_memory: u64,
    pub used_memory: u64,
    pub total_swap: u64,
    pub used_swap: u64,
    pub disk_bytes_per_sec: f64,
    pub disk_active_percent: f64,
    pub network_rx_bytes_per_sec: f64,
    pub network_tx_bytes_per_sec: f64,
    pub uptime_secs: u64,
    pub process_count: usize,
    pub cpu_info: CpuInfo,
    pub disks: Vec<DiskInfo>,
    pub network_interfaces: Vec<NetworkInterface>,
}

#[derive(Serialize, Clone)]
pub struct AppHistoryEntry {
    pub name: String,
    pub cpu_seconds: f64,
}

#[derive(Serialize, Clone)]
pub struct Snapshot {
    pub processes: Vec<ProcessInfo>,
    pub stats: SystemStats,
    pub app_history: Vec<AppHistoryEntry>,
}

#[derive(Serialize, Clone)]
pub struct ServiceInfo {
    pub name: String,
    pub description: String,
    pub status: String,
}

#[derive(Serialize, Clone)]
pub struct StartupAppInfo {
    pub name: String,
    pub publisher: String,
    pub enabled: bool,
}

#[cfg(target_os = "linux")]
pub fn prettify_process_name(raw: &str) -> String {
    // Linux process names come from /proc/[pid]/comm: always lowercase,
    // often hyphenated (e.g. "chromium", "task-manager"), unlike Windows/macOS
    // exe names which are usually already properly cased.
    if raw.is_empty() || raw.chars().any(|c| c.is_uppercase()) {
        return raw.to_string();
    }
    raw.split(['-', '_'])
        .filter(|s| !s.is_empty())
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(not(target_os = "linux"))]
pub fn prettify_process_name(raw: &str) -> String {
    raw.to_string()
}

/// Linux cuts a process's name to 15 bytes ("WebKitWebProces", "open-task-manag"). When a name is
/// exactly that long, find the full one: the executable's file name, or failing that (other
/// users' executables can't be read) the first word of the command line, which anyone can read.
/// Either only counts if it starts with the cut name.
fn full_process_name(p: &sysinfo::Process) -> String {
    let name = p.name().to_string_lossy().into_owned();
    if !cfg!(target_os = "linux") || name.len() != 15 {
        return name;
    }
    let from_exe = p.exe().and_then(|e| e.file_name()).map(|f| f.to_string_lossy().into_owned());
    let from_cmdline = || {
        let raw = std::fs::read(format!("/proc/{}/cmdline", p.pid())).ok()?;
        let arg0 = raw.split(|&b| b == 0).next()?;
        let arg0 = String::from_utf8_lossy(arg0);
        Some(arg0.rsplit('/').next()?.to_string())
    };
    [from_exe, from_cmdline()]
        .into_iter()
        .flatten()
        .map(|full| full.trim_end_matches(" (deleted)").to_string())
        .find(|full| full.starts_with(&name))
        .unwrap_or(name)
}

fn disk_kind_name(kind: DiskKind) -> String {
    match kind {
        DiskKind::HDD => "HDD".to_string(),
        DiskKind::SSD => "SSD".to_string(),
        DiskKind::Unknown(_) => "Unknown".to_string(),
    }
}

/// Owns the `sysinfo` handles plus the bits of state that turn cumulative counters into
/// per-second rates (last refresh time, previous disk io ticks) and the running per-app CPU
/// time totals behind App history. Call `snapshot()` on a fixed interval.
pub struct Monitor {
    sys: System,
    networks: Networks,
    disks: Disks,
    users: Users,
    disk_io_prev: HashMap<String, u64>,
    last_refresh: Instant,
    /// When the account list was last re-read; accounts rarely change, so not every snapshot.
    users_refreshed: Instant,
    app_cpu_seconds: HashMap<String, f64>,
}

/// How often `snapshot()` re-reads the list of user accounts.
const USERS_REFRESH_INTERVAL: std::time::Duration = std::time::Duration::from_secs(60);

impl Default for Monitor {
    fn default() -> Self {
        Self::new()
    }
}

impl Monitor {
    pub fn new() -> Self {
        Monitor {
            sys: System::new_all(),
            networks: Networks::new_with_refreshed_list(),
            disks: Disks::new_with_refreshed_list(),
            users: Users::new_with_refreshed_list(),
            disk_io_prev: HashMap::new(),
            last_refresh: Instant::now(),
            users_refreshed: Instant::now(),
            app_cpu_seconds: HashMap::new(),
        }
    }

    pub fn snapshot(&mut self) -> Snapshot {
        let Monitor {
            sys,
            networks,
            disks,
            users,
            disk_io_prev,
            last_refresh,
            users_refreshed,
            app_cpu_seconds,
        } = self;

        let now = Instant::now();
        let elapsed = now.duration_since(*last_refresh).as_secs_f64().max(0.001);
        *last_refresh = now;

        sys.refresh_cpu_usage();
        sys.refresh_memory();
        sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
        networks.refresh();
        disks.refresh();
        if users_refreshed.elapsed() >= USERS_REFRESH_INTERVAL {
            users.refresh_list();
            *users_refreshed = now;
        }

        let mut total_disk_bytes = 0f64;
        // sysinfo reports a process's CPU as percent of one core (up to 100% x cores).
        let cores = sys.cpus().len().max(1) as f32;
        let processes: Vec<ProcessInfo> = sys
            .processes()
            .values()
            // On Linux sysinfo also lists every thread as its own entry, each reporting its whole
            // process's memory; keep real processes only.
            .filter(|p| p.thread_kind().is_none())
            .map(|p| {
                let disk = p.disk_usage();
                let bytes = disk.read_bytes + disk.written_bytes;
                let rate = bytes as f64 / elapsed;
                total_disk_bytes += rate;
                let user_name = p
                    .user_id()
                    .and_then(|uid| users.get_user_by_id(uid))
                    .map(|u| u.name().to_string());
                ProcessInfo {
                    pid: p.pid().as_u32(),
                    name: prettify_process_name(&full_process_name(p)),
                    cpu_usage: p.cpu_usage() / cores,
                    memory: p.memory(),
                    disk_bytes_per_sec: rate,
                    status: p.status().to_string(),
                    user_name,
                }
            })
            .collect();

        for p in &processes {
            *app_cpu_seconds.entry(p.name.clone()).or_insert(0.0) +=
                (p.cpu_usage as f64 * cores as f64 / 100.0) * elapsed;
        }
        let mut app_history: Vec<AppHistoryEntry> = app_cpu_seconds
            .iter()
            .map(|(name, &cpu_seconds)| AppHistoryEntry {
                name: name.clone(),
                cpu_seconds,
            })
            .collect();
        app_history.sort_by(|a, b| b.cpu_seconds.partial_cmp(&a.cpu_seconds).unwrap());

        let (rx, tx) = networks.iter().fold((0u64, 0u64), |(rx, tx), (_, data)| {
            (rx + data.received(), tx + data.transmitted())
        });

        let network_interfaces = networks
            .iter()
            .map(|(name, data)| NetworkInterface {
                name: name.clone(),
                rx_bytes_per_sec: data.received() as f64 / elapsed,
                tx_bytes_per_sec: data.transmitted() as f64 / elapsed,
            })
            .collect();

        let current_io_ticks = read_disk_io_ticks();
        let disk_list: Vec<DiskInfo> = disks
            .iter()
            .map(|d| {
                let name = d.name().to_string_lossy().to_string();
                let active_percent = match (current_io_ticks.get(&name), disk_io_prev.get(&name)) {
                    (Some(&cur), Some(&prev)) => {
                        let delta_ms = cur.saturating_sub(prev) as f64;
                        (delta_ms / (elapsed * 1000.0) * 100.0).min(100.0)
                    }
                    _ => 0.0,
                };
                DiskInfo {
                    name,
                    mount_point: d.mount_point().to_string_lossy().to_string(),
                    kind: disk_kind_name(d.kind()),
                    total_bytes: d.total_space(),
                    available_bytes: d.available_space(),
                    active_percent,
                }
            })
            .collect();
        *disk_io_prev = current_io_ticks;

        let disk_active_percent = disk_list
            .iter()
            .find(|d| d.mount_point == "/")
            .or_else(|| disk_list.first())
            .map(|d| d.active_percent)
            .unwrap_or(0.0);

        let cpus = sys.cpus();
        let cpu_info = CpuInfo {
            brand: cpus
                .first()
                .map(|c| c.brand().trim().to_string())
                .unwrap_or_default(),
            frequency_mhz: cpus.first().map(|c| c.frequency()).unwrap_or(0),
            physical_cores: sys.physical_core_count().unwrap_or(0),
            logical_cores: cpus.len(),
        };

        let process_count = processes.len();
        Snapshot {
            processes,
            app_history,
            stats: SystemStats {
                cpu_usage: sys.global_cpu_usage(),
                total_memory: sys.total_memory(),
                used_memory: sys.used_memory(),
                total_swap: sys.total_swap(),
                used_swap: sys.used_swap(),
                disk_bytes_per_sec: total_disk_bytes,
                disk_active_percent,
                network_rx_bytes_per_sec: rx as f64 / elapsed,
                network_tx_bytes_per_sec: tx as f64 / elapsed,
                uptime_secs: System::uptime(),
                process_count,
                cpu_info,
                disks: disk_list,
                network_interfaces,
            },
        }
    }

    pub fn kill_process(&self, pid: u32) -> bool {
        match self.sys.process(Pid::from_u32(pid)) {
            Some(process) => process.kill(),
            None => false,
        }
    }

    pub fn reset_app_history(&mut self) {
        self.app_cpu_seconds.clear();
    }
}

#[cfg(target_os = "linux")]
#[derive(serde::Deserialize)]
struct RawUnit {
    unit: String,
    active: String,
    description: String,
}

#[cfg(target_os = "linux")]
pub fn get_services() -> Vec<ServiceInfo> {
    let Ok(output) = std::process::Command::new("systemctl")
        .args([
            "list-units",
            "--type=service",
            "--all",
            "--no-legend",
            "--no-pager",
            "-o",
            "json",
        ])
        .output()
    else {
        return Vec::new();
    };
    let Ok(raw): Result<Vec<RawUnit>, _> = serde_json::from_slice(&output.stdout) else {
        return Vec::new();
    };
    raw.into_iter()
        .map(|u| ServiceInfo {
            name: u.unit.trim_end_matches(".service").to_string(),
            description: u.description,
            status: if u.active == "active" {
                "Running".to_string()
            } else {
                "Stopped".to_string()
            },
        })
        .collect()
}

#[cfg(not(target_os = "linux"))]
pub fn get_services() -> Vec<ServiceInfo> {
    Vec::new()
}

#[cfg(target_os = "linux")]
fn parse_autostart_desktop_file(path: &std::path::Path) -> Option<(String, String, bool)> {
    let content = std::fs::read_to_string(path).ok()?;
    let mut name = None;
    let mut comment = None;
    let mut hidden = false;
    let mut gnome_enabled = true;
    for line in content.lines() {
        let line = line.trim();
        if let Some(v) = line.strip_prefix("Name=") {
            if name.is_none() {
                name = Some(v.to_string());
            }
        } else if let Some(v) = line.strip_prefix("Comment=") {
            if comment.is_none() {
                comment = Some(v.to_string());
            }
        } else if let Some(v) = line.strip_prefix("Hidden=") {
            hidden = v.trim().eq_ignore_ascii_case("true");
        } else if let Some(v) = line.strip_prefix("X-GNOME-Autostart-enabled=") {
            gnome_enabled = !v.trim().eq_ignore_ascii_case("false");
        }
    }
    Some((name?, comment.unwrap_or_default(), !hidden && gnome_enabled))
}

#[cfg(target_os = "linux")]
pub fn get_startup_apps() -> Vec<StartupAppInfo> {
    let mut entries: HashMap<String, (String, String, bool)> = HashMap::new();

    let mut dirs = vec![std::path::PathBuf::from("/etc/xdg/autostart")];
    if let Some(home) = std::env::var_os("HOME") {
        dirs.push(std::path::PathBuf::from(home).join(".config/autostart"));
    }

    for dir in dirs {
        let Ok(read_dir) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in read_dir.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("desktop") {
                continue;
            }
            let Some(filename) = path.file_name().and_then(|f| f.to_str()) else {
                continue;
            };
            if let Some(parsed) = parse_autostart_desktop_file(&path) {
                entries.insert(filename.to_string(), parsed);
            }
        }
    }

    let mut apps: Vec<StartupAppInfo> = entries
        .into_values()
        .map(|(name, publisher, enabled)| StartupAppInfo {
            name,
            publisher,
            enabled,
        })
        .collect();
    apps.sort_by(|a, b| a.name.cmp(&b.name));
    apps
}

#[cfg(not(target_os = "linux"))]
pub fn get_startup_apps() -> Vec<StartupAppInfo> {
    Vec::new()
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::prettify_process_name;

    #[test]
    fn prettifies_lowercase_slug_names() {
        assert_eq!(prettify_process_name("chromium"), "Chromium");
        assert_eq!(prettify_process_name("task-manager"), "Task Manager");
        assert_eq!(prettify_process_name("gnome-shell"), "Gnome Shell");
        assert_eq!(prettify_process_name("code"), "Code");
    }

    #[test]
    fn leaves_already_cased_names_alone() {
        assert_eq!(prettify_process_name("Xorg"), "Xorg");
        assert_eq!(prettify_process_name("NetworkManager"), "NetworkManager");
    }

    #[test]
    fn snapshot_lists_processes_not_threads() {
        let (tx, rx) = std::sync::mpsc::channel::<()>();
        let helper = std::thread::spawn(move || rx.recv());
        let own_threads: Vec<u32> = std::fs::read_dir("/proc/self/task")
            .unwrap()
            .flatten()
            .filter_map(|e| e.file_name().to_str()?.parse().ok())
            .filter(|&tid| tid != std::process::id())
            .collect();
        assert!(!own_threads.is_empty());

        let mut monitor = super::Monitor::new();
        let snapshot = monitor.snapshot();
        let _ = tx.send(());
        helper.join().unwrap().unwrap();

        let me = std::process::id();
        assert_eq!(snapshot.processes.iter().filter(|p| p.pid == me).count(), 1);
        for tid in own_threads {
            assert!(snapshot.processes.iter().all(|p| p.pid != tid), "thread {tid} listed as a process");
        }
        assert_eq!(snapshot.stats.process_count, snapshot.processes.len());
    }

    #[test]
    fn shows_full_names_longer_than_15_characters() {
        let dir = std::env::temp_dir().join(format!("otm-name-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        // A copy, not a symlink: the name has to come from the executable's own file name.
        let exe = dir.join("otm-long-name-test-sleeper");
        std::fs::copy("/bin/sleep", &exe).unwrap();
        let mut child = std::process::Command::new(&exe).arg("5").spawn().unwrap();

        let mut monitor = super::Monitor::new();
        let snapshot = monitor.snapshot();
        let _ = child.kill();
        let _ = child.wait();
        let _ = std::fs::remove_dir_all(&dir);

        let listed = snapshot.processes.iter().find(|p| p.pid == child.id()).expect("child listed");
        assert_eq!(listed.name, "Otm Long Name Test Sleeper");
    }

    #[test]
    fn process_cpu_is_a_share_of_the_whole_cpu() {
        use std::sync::atomic::{AtomicBool, Ordering};
        use std::sync::Arc;
        let stop = Arc::new(AtomicBool::new(false));
        let spin = {
            let stop = stop.clone();
            std::thread::spawn(move || {
                while !stop.load(Ordering::Relaxed) {
                    std::hint::spin_loop();
                }
            })
        };
        let mut monitor = super::Monitor::new();
        monitor.snapshot();
        std::thread::sleep(std::time::Duration::from_millis(1000));
        let snapshot = monitor.snapshot();
        stop.store(true, Ordering::Relaxed);
        spin.join().unwrap();

        // One fully busy thread is one core: 100% / cores of the whole CPU, never ~100%.
        let one_core = 100.0 / snapshot.stats.cpu_info.logical_cores as f32;
        let me = snapshot.processes.iter().find(|p| p.pid == std::process::id()).unwrap();
        assert!(
            me.cpu_usage > one_core * 0.4 && me.cpu_usage < one_core * 1.3,
            "{} vs one core = {one_core}",
            me.cpu_usage
        );
    }

    #[test]
    fn handles_empty_name() {
        assert_eq!(prettify_process_name(""), "");
    }

    #[test]
    fn get_services_returns_real_running_services() {
        let services = super::get_services();
        assert!(
            !services.is_empty(),
            "expected at least one systemd service"
        );
        assert!(
            services.iter().any(|s| s.status == "Running"),
            "expected at least one Running service on a live system"
        );
        assert!(services.iter().all(|s| !s.name.is_empty()));
    }

    #[test]
    fn get_startup_apps_reads_real_autostart_entries() {
        let apps = super::get_startup_apps();
        assert!(
            !apps.is_empty(),
            "expected at least one autostart .desktop entry"
        );
        assert!(apps.iter().all(|a| !a.name.is_empty()));
    }
}
