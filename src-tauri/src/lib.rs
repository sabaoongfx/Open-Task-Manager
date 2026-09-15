use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;
use sysinfo::{DiskKind, Disks, Networks, Pid, System};
use tauri::State;

struct AppState {
    sys: Mutex<System>,
    networks: Mutex<Networks>,
    disks: Mutex<Disks>,
    disk_io_prev: Mutex<HashMap<String, u64>>,
    last_refresh: Mutex<Instant>,
}

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
struct ProcessInfo {
    pid: u32,
    name: String,
    cpu_usage: f32,
    memory: u64,
    disk_bytes_per_sec: f64,
}

#[derive(Serialize, Clone)]
struct CpuInfo {
    brand: String,
    frequency_mhz: u64,
    physical_cores: usize,
    logical_cores: usize,
}

#[derive(Serialize, Clone)]
struct DiskInfo {
    name: String,
    mount_point: String,
    kind: String,
    total_bytes: u64,
    available_bytes: u64,
    active_percent: f64,
}

#[derive(Serialize, Clone)]
struct NetworkInterface {
    name: String,
    rx_bytes_per_sec: f64,
    tx_bytes_per_sec: f64,
}

#[derive(Serialize, Clone)]
struct SystemStats {
    cpu_usage: f32,
    total_memory: u64,
    used_memory: u64,
    total_swap: u64,
    used_swap: u64,
    disk_bytes_per_sec: f64,
    disk_active_percent: f64,
    network_rx_bytes_per_sec: f64,
    network_tx_bytes_per_sec: f64,
    uptime_secs: u64,
    process_count: usize,
    cpu_info: CpuInfo,
    disks: Vec<DiskInfo>,
    network_interfaces: Vec<NetworkInterface>,
}

#[derive(Serialize, Clone)]
struct Snapshot {
    processes: Vec<ProcessInfo>,
    stats: SystemStats,
}

#[cfg(target_os = "linux")]
fn prettify_process_name(raw: &str) -> String {
    // Linux process names come from /proc/[pid]/comm: always lowercase,
    // often hyphenated (e.g. "chromium", "task-manager"), unlike Windows/macOS
    // exe names which are usually already properly cased.
    if raw.is_empty() || raw.chars().any(|c| c.is_uppercase()) {
        return raw.to_string();
    }
    raw.split(|c: char| c == '-' || c == '_')
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
fn prettify_process_name(raw: &str) -> String {
    raw.to_string()
}

fn disk_kind_name(kind: DiskKind) -> String {
    match kind {
        DiskKind::HDD => "HDD".to_string(),
        DiskKind::SSD => "SSD".to_string(),
        DiskKind::Unknown(_) => "Unknown".to_string(),
    }
}

#[tauri::command]
fn get_snapshot(state: State<AppState>) -> Snapshot {
    let mut sys = state.sys.lock().unwrap();
    let mut networks = state.networks.lock().unwrap();
    let mut disks = state.disks.lock().unwrap();
    let mut disk_io_prev = state.disk_io_prev.lock().unwrap();
    let mut last_refresh = state.last_refresh.lock().unwrap();

    let now = Instant::now();
    let elapsed = now.duration_since(*last_refresh).as_secs_f64().max(0.001);
    *last_refresh = now;

    sys.refresh_cpu_usage();
    sys.refresh_memory();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    networks.refresh();
    disks.refresh();

    let mut total_disk_bytes = 0f64;
    let processes: Vec<ProcessInfo> = sys
        .processes()
        .values()
        .map(|p| {
            let disk = p.disk_usage();
            let bytes = disk.read_bytes + disk.written_bytes;
            let rate = bytes as f64 / elapsed;
            total_disk_bytes += rate;
            ProcessInfo {
                pid: p.pid().as_u32(),
                name: prettify_process_name(&p.name().to_string_lossy()),
                cpu_usage: p.cpu_usage(),
                memory: p.memory(),
                disk_bytes_per_sec: rate,
            }
        })
        .collect();

    let (rx, tx) = networks
        .iter()
        .fold((0u64, 0u64), |(rx, tx), (_, data)| {
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
        brand: cpus.first().map(|c| c.brand().trim().to_string()).unwrap_or_default(),
        frequency_mhz: cpus.first().map(|c| c.frequency()).unwrap_or(0),
        physical_cores: sys.physical_core_count().unwrap_or(0),
        logical_cores: cpus.len(),
    };

    Snapshot {
        processes,
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
            process_count: sys.processes().len(),
            cpu_info,
            disks: disk_list,
            network_interfaces,
        },
    }
}

#[tauri::command]
fn kill_process(state: State<AppState>, pid: u32) -> bool {
    let sys = state.sys.lock().unwrap();
    match sys.process(Pid::from_u32(pid)) {
        Some(process) => process.kill(),
        None => false,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            sys: Mutex::new(System::new_all()),
            networks: Mutex::new(Networks::new_with_refreshed_list()),
            disks: Mutex::new(Disks::new_with_refreshed_list()),
            disk_io_prev: Mutex::new(HashMap::new()),
            last_refresh: Mutex::new(Instant::now()),
        })
        .invoke_handler(tauri::generate_handler![get_snapshot, kill_process])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
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
    fn handles_empty_name() {
        assert_eq!(prettify_process_name(""), "");
    }
}
