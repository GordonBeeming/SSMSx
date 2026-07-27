use crate::sidecar::SidecarManager;
use serde_json::Value;

const REASSIGN_COLOR_PROFILE_METHOD: &str = "connection.reassignColorProfile";

fn reassign_color_profile_params(from_profile_id: String, to_profile_id: String) -> Value {
    serde_json::json!({
        "fromProfileId": from_profile_id,
        "toProfileId": to_profile_id
    })
}

#[tauri::command]
pub async fn connection_list(sidecar: tauri::State<'_, SidecarManager>) -> Result<String, String> {
    let result = sidecar.send_request("connection.list", None).await?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn connection_get(
    sidecar: tauri::State<'_, SidecarManager>,
    id: String,
) -> Result<String, String> {
    let params = serde_json::json!({ "id": id });
    let result = sidecar.send_request("connection.get", Some(params)).await?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn connection_save(
    sidecar: tauri::State<'_, SidecarManager>,
    connection: Value,
    password: Option<String>,
    clear_credential: Option<bool>,
) -> Result<String, String> {
    let params = serde_json::json!({
        "connection": connection,
        "password": password,
        "clearCredential": clear_credential.unwrap_or(false)
    });
    let result = sidecar
        .send_request("connection.save", Some(params))
        .await?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn connection_delete(
    sidecar: tauri::State<'_, SidecarManager>,
    id: String,
) -> Result<String, String> {
    let params = serde_json::json!({ "id": id });
    let result = sidecar
        .send_request("connection.delete", Some(params))
        .await?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn connection_reassign_color_profile(
    sidecar: tauri::State<'_, SidecarManager>,
    from_profile_id: String,
    to_profile_id: String,
) -> Result<String, String> {
    let params = reassign_color_profile_params(from_profile_id, to_profile_id);
    let result = sidecar
        .send_request(REASSIGN_COLOR_PROFILE_METHOD, Some(params))
        .await?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn connection_test(
    sidecar: tauri::State<'_, SidecarManager>,
    connection: Value,
    password: Option<String>,
    request_id: Option<String>,
) -> Result<String, String> {
    let params = serde_json::json!({
        "connection": connection,
        "password": password
    });
    let request_id = request_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let result = sidecar
        .send_interactive_request("connection.test", Some(params), request_id)
        .await?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn connection_connect(
    sidecar: tauri::State<'_, SidecarManager>,
    id: String,
    request_id: Option<String>,
) -> Result<String, String> {
    let params = serde_json::json!({ "id": id });
    let request_id = request_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let result = sidecar
        .send_interactive_request("connection.connect", Some(params), request_id)
        .await?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn connection_cancel_request(
    sidecar: tauri::State<'_, SidecarManager>,
    request_id: String,
) -> Result<bool, String> {
    sidecar.cancel_request(request_id).await
}

#[tauri::command]
pub async fn connection_disconnect(
    sidecar: tauri::State<'_, SidecarManager>,
    id: String,
) -> Result<String, String> {
    let params = serde_json::json!({ "id": id });
    let result = sidecar
        .send_request("connection.disconnect", Some(params))
        .await?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::{reassign_color_profile_params, REASSIGN_COLOR_PROFILE_METHOD};

    #[test]
    fn reassign_color_profile_bridge_uses_sidecar_contract() {
        assert_eq!(
            REASSIGN_COLOR_PROFILE_METHOD,
            "connection.reassignColorProfile"
        );
        assert_eq!(
            reassign_color_profile_params("custom".into(), "red".into()),
            serde_json::json!({
                "fromProfileId": "custom",
                "toProfileId": "red"
            })
        );
    }
}
