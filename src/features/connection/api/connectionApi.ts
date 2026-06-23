import { invoke } from "@tauri-apps/api/core";
import type {
  ConnectionInfo,
  ConnectionTestResult,
  ConnectionConnectResult,
  ConnectionDeleteResult,
} from "../types";

export async function connectionList(): Promise<ConnectionInfo[]> {
  const result = await invoke<string>("connection_list");
  return JSON.parse(result);
}

export async function connectionGet(id: string): Promise<ConnectionInfo | null> {
  const result = await invoke<string>("connection_get", { id });
  return JSON.parse(result);
}

export async function connectionSave(
  connection: ConnectionInfo,
  password?: string,
  clearCredential?: boolean
): Promise<ConnectionInfo> {
  const result = await invoke<string>("connection_save", { connection, password, clearCredential: clearCredential ?? false });
  return JSON.parse(result);
}

export async function connectionDelete(id: string): Promise<ConnectionDeleteResult> {
  const result = await invoke<string>("connection_delete", { id });
  return JSON.parse(result);
}

export async function connectionTest(
  connection: ConnectionInfo,
  password?: string,
  requestId?: string
): Promise<ConnectionTestResult> {
  const result = await invoke<string>("connection_test", { connection, password, requestId });
  return JSON.parse(result);
}

export async function connectionConnect(
  id: string,
  requestId?: string
): Promise<ConnectionConnectResult> {
  const result = await invoke<string>("connection_connect", { id, requestId });
  return JSON.parse(result);
}

export async function connectionCancelRequest(requestId: string): Promise<boolean> {
  return invoke<boolean>("connection_cancel_request", { requestId });
}

export async function connectionDisconnect(id: string): Promise<void> {
  await invoke<string>("connection_disconnect", { id });
}
