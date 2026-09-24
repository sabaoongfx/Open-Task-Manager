use otm_core::{Monitor, ServiceInfo, Snapshot, StartupAppInfo};
use std::sync::Mutex;
use tauri::State;

// All data collection lives in the `otm-core` crate (shared with the terminal UI in `tui/`);
// these commands are thin wrappers that expose it to the frontend.
struct AppState(Mutex<Monitor>);

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState(Mutex::new(Monitor::new())))
        .invoke_handler(tauri::generate_handler![
            get_snapshot,
            kill_process,
            reset_app_history,
            get_services,
            get_startup_apps
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
