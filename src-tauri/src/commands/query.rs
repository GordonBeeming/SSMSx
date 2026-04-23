use crate::sidecar::SidecarManager;
use tauri::Emitter;

#[tauri::command]
pub async fn query_execute(
    sidecar: tauri::State<'_, SidecarManager>,
    app_handle: tauri::AppHandle,
    request_id: String,
    connection_id: String,
    database: String,
    sql: String,
) -> Result<String, String> {
    let params = serde_json::json!({
        "connectionId": connection_id,
        "database": database,
        "sql": sql
    });

    // Use the caller-provided request_id so the frontend can store it in
    // state BEFORE invoke returns — otherwise streaming events can arrive
    // before the frontend knows which tab they belong to.
    let (request_id, mut rx) = sidecar
        .send_streaming_request_with_id("query.execute", Some(params), request_id)
        .await?;

    log::debug!(
        "Query execution started: request_id='{}', connection_id='{}', database='{}'",
        request_id,
        connection_id,
        database
    );

    let rid = request_id.clone();

    // Spawn a task to read batches and emit Tauri events.
    // Each payload gets the requestId injected so the frontend can match
    // events to tabs (the sidecar's queryId is different from requestId).
    tauri::async_runtime::spawn(async move {
        while let Some(result) = rx.recv().await {
            match result {
                Ok(value) => {
                    let done = value.get("done").and_then(|v| v.as_bool()).unwrap_or(false);
                    let has_error = value.get("error").is_some();

                    // Inject requestId into the payload so frontend can correlate
                    let mut payload = value.as_object().cloned().unwrap_or_default();
                    payload.insert("requestId".to_string(), serde_json::Value::String(rid.clone()));
                    let payload = serde_json::Value::Object(payload);

                    if has_error {
                        log::warn!("Query '{}' returned an error payload", rid);
                        let _ = app_handle.emit("query:error", &payload);
                    } else if done {
                        log::debug!("Query '{}' completed", rid);
                        let _ = app_handle.emit("query:complete", &payload);
                    } else {
                        let _ = app_handle.emit("query:results", &payload);
                    }

                    // If done or error, stop listening
                    if done || has_error {
                        break;
                    }
                }
                Err(e) => {
                    log::error!("Query '{}' stream error: {}", rid, e);
                    let error_payload = serde_json::json!({
                        "requestId": rid,
                        "error": e
                    });
                    let _ = app_handle.emit("query:error", &error_payload);
                    break;
                }
            }
        }
    });

    // Return the request ID immediately so frontend can track/cancel
    serde_json::to_string(&serde_json::json!({ "requestId": request_id }))
        .map_err(|e| format!("Failed to serialize query response: {}", e))
}

#[tauri::command]
pub async fn intellisense_get_metadata(
    sidecar: tauri::State<'_, SidecarManager>,
    connection_id: String,
    database: String,
) -> Result<String, String> {
    log::debug!(
        "IntelliSense metadata request: connection_id='{}', database='{}'",
        connection_id,
        database
    );
    let params = serde_json::json!({ "connectionId": connection_id, "database": database });
    let result = sidecar
        .send_request("intellisense.getMetadata", Some(params))
        .await?;
    serde_json::to_string(&result).map_err(|e| {
        format!(
            "Failed to serialize IntelliSense metadata for connection '{}', database '{}': {}",
            connection_id, database, e
        )
    })
}

#[tauri::command]
pub async fn query_cancel(
    sidecar: tauri::State<'_, SidecarManager>,
    query_id: String,
) -> Result<String, String> {
    log::debug!("Cancelling query: query_id='{}'", query_id);
    let params = serde_json::json!({ "queryId": query_id });
    let result = sidecar
        .send_request("query.cancel", Some(params))
        .await?;
    serde_json::to_string(&result)
        .map_err(|e| format!("Failed to serialize cancel response for query '{}': {}", query_id, e))
}
