// Tauri 2 application entrypoint.
// Shell only for now: registers the fs + dialog plugins so the frontend can
// later resolve local files via `convertFileSrc` and open native file dialogs.
//
// Future phases add commands here, e.g.:
//   #[tauri::command] fn fetch_og(url: String) -> Result<OgData, String> { ... }
// and wire them via `.invoke_handler(tauri::generate_handler![fetch_og])`.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|_app| {
            // app handle available here if we need to seed state / events
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
