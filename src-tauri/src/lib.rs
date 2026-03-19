mod sidecar;
mod commands;

use tauri::Manager;

pub fn run() {
    let _ = env_logger::try_init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let sidecar_manager = sidecar::SidecarManager::new();

            // Spawn sidecar on startup
            let manager = sidecar_manager.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = manager.start(&handle).await {
                    log::error!("Failed to start sidecar: {}", e);
                }
            });

            app.manage(sidecar_manager);

            // Auto-open devtools in debug builds
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ping::ping,
            commands::connection::connection_list,
            commands::connection::connection_get,
            commands::connection::connection_save,
            commands::connection::connection_delete,
            commands::connection::connection_test,
            commands::connection::connection_connect,
            commands::connection::connection_disconnect,
            commands::explorer::explorer_databases,
            commands::explorer::explorer_tables,
            commands::explorer::explorer_views,
            commands::explorer::explorer_columns,
            commands::explorer::explorer_keys,
            commands::explorer::explorer_indexes,
            commands::explorer::explorer_procedures,
            commands::explorer::explorer_functions,
            commands::explorer::explorer_users,
            commands::explorer::explorer_object_definition,
            commands::query::query_execute,
            commands::query::query_cancel,
            commands::query::intellisense_get_metadata,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
