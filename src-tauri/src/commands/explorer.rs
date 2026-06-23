use crate::sidecar::SidecarManager;

#[tauri::command]
pub async fn explorer_databases(
    sidecar: tauri::State<'_, SidecarManager>,
    connection_id: String,
) -> Result<String, String> {
    let params = serde_json::json!({ "connectionId": connection_id });
    let result = sidecar
        .send_request("explorer.databases", Some(params))
        .await?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn explorer_tables(
    sidecar: tauri::State<'_, SidecarManager>,
    connection_id: String,
    database: String,
) -> Result<String, String> {
    let params = serde_json::json!({ "connectionId": connection_id, "database": database });
    let result = sidecar
        .send_request("explorer.tables", Some(params))
        .await?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn explorer_views(
    sidecar: tauri::State<'_, SidecarManager>,
    connection_id: String,
    database: String,
) -> Result<String, String> {
    let params = serde_json::json!({ "connectionId": connection_id, "database": database });
    let result = sidecar.send_request("explorer.views", Some(params)).await?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn explorer_columns(
    sidecar: tauri::State<'_, SidecarManager>,
    connection_id: String,
    database: String,
    schema: String,
    object_name: String,
) -> Result<String, String> {
    let params = serde_json::json!({
        "connectionId": connection_id,
        "database": database,
        "schema": schema,
        "objectName": object_name
    });
    let result = sidecar
        .send_request("explorer.columns", Some(params))
        .await?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn explorer_keys(
    sidecar: tauri::State<'_, SidecarManager>,
    connection_id: String,
    database: String,
    schema: String,
    table_name: String,
) -> Result<String, String> {
    let params = serde_json::json!({
        "connectionId": connection_id,
        "database": database,
        "schema": schema,
        "tableName": table_name
    });
    let result = sidecar.send_request("explorer.keys", Some(params)).await?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn explorer_indexes(
    sidecar: tauri::State<'_, SidecarManager>,
    connection_id: String,
    database: String,
    schema: String,
    table_name: String,
) -> Result<String, String> {
    let params = serde_json::json!({
        "connectionId": connection_id,
        "database": database,
        "schema": schema,
        "tableName": table_name
    });
    let result = sidecar
        .send_request("explorer.indexes", Some(params))
        .await?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn explorer_procedures(
    sidecar: tauri::State<'_, SidecarManager>,
    connection_id: String,
    database: String,
) -> Result<String, String> {
    let params = serde_json::json!({ "connectionId": connection_id, "database": database });
    let result = sidecar
        .send_request("explorer.procedures", Some(params))
        .await?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn explorer_functions(
    sidecar: tauri::State<'_, SidecarManager>,
    connection_id: String,
    database: String,
) -> Result<String, String> {
    let params = serde_json::json!({ "connectionId": connection_id, "database": database });
    let result = sidecar
        .send_request("explorer.functions", Some(params))
        .await?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn explorer_users(
    sidecar: tauri::State<'_, SidecarManager>,
    connection_id: String,
    database: String,
) -> Result<String, String> {
    let params = serde_json::json!({ "connectionId": connection_id, "database": database });
    let result = sidecar.send_request("explorer.users", Some(params)).await?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn explorer_object_definition(
    sidecar: tauri::State<'_, SidecarManager>,
    connection_id: String,
    database: String,
    schema: String,
    object_name: String,
    object_type: String,
) -> Result<String, String> {
    let params = serde_json::json!({
        "connectionId": connection_id,
        "database": database,
        "schema": schema,
        "objectName": object_name,
        "objectType": object_type
    });
    let result = sidecar
        .send_request("explorer.objectDefinition", Some(params))
        .await?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn explorer_database_diagram(
    sidecar: tauri::State<'_, SidecarManager>,
    connection_id: String,
    database: String,
) -> Result<String, String> {
    let params = serde_json::json!({ "connectionId": connection_id, "database": database });
    let result = sidecar
        .send_request("explorer.databaseDiagram", Some(params))
        .await?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}
