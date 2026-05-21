mod sidecar;
mod commands;

use tauri::{Manager, Emitter};
use tauri::menu::{MenuBuilder, SubmenuBuilder, MenuItemBuilder, PredefinedMenuItem};

pub fn run() {
    let _ = env_logger::try_init();

    #[cfg_attr(not(feature = "dev-mcp"), allow(unused_mut))]
    let mut builder = tauri::Builder::default()
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

            // Build application menu
            build_menu(app)?;

            // Auto-open devtools in debug builds
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }

            Ok(())
        });

    #[cfg(feature = "dev-mcp")]
    {
        builder = builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    builder
        .on_menu_event(|app, event| {
            let id = event.id().0.as_str();
            if let Some(window) = app.get_webview_window("main") {
                // Emit menu events to the frontend so React can handle them
                if let Err(e) = window.emit(&format!("menu:{}", id), ()) {
                    log::error!("Failed to emit menu event '{}': {}", id, e);
                }
            }
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
            commands::explorer::explorer_database_diagram,
            commands::query::query_execute,
            commands::query::query_cancel,
            commands::query::intellisense_get_metadata,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn build_menu(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle();

    // -- File menu --
    let file_menu = SubmenuBuilder::new(handle, "File")
        .item(&MenuItemBuilder::with_id("new-connection", "New Connection...")
            .accelerator("CmdOrCtrl+Shift+N")
            .build(handle)?)
        .item(&MenuItemBuilder::with_id("new-query", "New Query")
            .accelerator("CmdOrCtrl+N")
            .build(handle)?)
        .separator()
        .item(&MenuItemBuilder::with_id("close-tab", "Close Tab")
            .accelerator("CmdOrCtrl+W")
            .build(handle)?)
        .separator()
        .item(&PredefinedMenuItem::quit(handle, None)?)
        .build()?;

    // -- Edit menu (standard) --
    let edit_menu = SubmenuBuilder::new(handle, "Edit")
        .item(&PredefinedMenuItem::undo(handle, None)?)
        .item(&PredefinedMenuItem::redo(handle, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(handle, None)?)
        .item(&PredefinedMenuItem::copy(handle, None)?)
        .item(&PredefinedMenuItem::paste(handle, None)?)
        .item(&PredefinedMenuItem::select_all(handle, None)?)
        .build()?;

    // -- Query menu --
    let query_menu = SubmenuBuilder::new(handle, "Query")
        .item(&MenuItemBuilder::with_id("execute-query", "Execute")
            .accelerator("F5")
            .build(handle)?)
        .item(&MenuItemBuilder::with_id("execute-selection", "Execute Selection")
            .accelerator("CmdOrCtrl+Shift+E")
            .build(handle)?)
        .separator()
        .item(&MenuItemBuilder::with_id("cancel-query", "Cancel Execution")
            .build(handle)?)
        .build()?;

    // -- View menu --
    let view_menu = SubmenuBuilder::new(handle, "View")
        .item(&MenuItemBuilder::with_id("toggle-explorer", "Object Explorer")
            .build(handle)?)
        .build()?;

    let menu = MenuBuilder::new(handle)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&query_menu)
        .item(&view_menu)
        .build()?;

    app.set_menu(menu)?;

    Ok(())
}
