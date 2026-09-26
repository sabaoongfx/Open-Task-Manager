use otm_core::{DiskScan, Monitor, ScanProgress, ServiceInfo, Snapshot, StartupAppInfo};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::State;

// All data collection lives in the `otm-core` crate (shared with the terminal UI in `tui/`);
// these commands are thin wrappers that expose it to the frontend.
struct AppState(Mutex<Monitor>);

// Progress/cancel handle of the Disk usage scan. The GUI runs one scan at a time.
struct DiskScanState(Arc<ScanProgress>);

#[tauri::command]
fn get_snapshot(state: State<AppState>) -> Snapshot {
    state.0.lock().unwrap().snapshot()
}

#[tauri::command]
fn kill_process(state: State<AppState>, pid: u32) -> bool {
    state.0.lock().unwrap().kill_process(pid)
}

#[tauri::command]
fn reset_app_history(state: State<AppState>) -> bool {
    state.0.lock().unwrap().reset_app_history();
    true
}

#[tauri::command]
fn get_services() -> Vec<ServiceInfo> {
    otm_core::get_services()
}

#[tauri::command]
fn get_startup_apps() -> Vec<StartupAppInfo> {
    otm_core::get_startup_apps()
}

/// Scans `path`, or the home folder when it's omitted. Async so the (possibly minutes-long)
/// walk runs off the main thread and the window stays responsive.
#[tauri::command]
async fn scan_disk(state: State<'_, DiskScanState>, path: Option<String>) -> Result<DiskScan, String> {
    let path = match path {
        Some(p) => PathBuf::from(p),
        None => otm_core::home_dir().ok_or("No home folder found")?,
    };
    let progress = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || otm_core::scan_disk_usage(&path, &progress))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn disk_scan_progress(state: State<DiskScanState>) -> u64 {
    state.0.files()
}

#[tauri::command]
fn cancel_disk_scan(state: State<DiskScanState>) {
    state.0.cancel();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState(Mutex::new(Monitor::new())))
        .manage(DiskScanState(Arc::new(ScanProgress::new())))
        .invoke_handler(tauri::generate_handler![
            get_snapshot,
            kill_process,
            reset_app_history,
            get_services,
            get_startup_apps,
            scan_disk,
            disk_scan_progress,
            cancel_disk_scan
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
