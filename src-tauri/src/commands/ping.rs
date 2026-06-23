use crate::sidecar::SidecarManager;

#[tauri::command]
pub async fn ping(sidecar: tauri::State<'_, SidecarManager>) -> Result<String, String> {
    let result = sidecar.send_request("ping", None).await?;
    serde_json::to_string_pretty(&result).map_err(|e| e.to_string())
}
