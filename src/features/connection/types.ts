export type AuthType = "SqlAuth" | "ConnectionString" | "EntraMfa";
export type EncryptMode = "Mandatory" | "Optional" | "Strict";

export interface ConnectionInfo {
  id: string;
  name?: string | null;
  serverName: string;
  authType: AuthType;
  username?: string;
  credentialRef?: string;
  database?: string;
  encrypt: EncryptMode;
  trustServerCertificate: boolean;
  connectionString?: string;
  colorProfileId?: string;
  /** Legacy foreground hex persisted by earlier releases. */
  color?: string;
  lastUsed?: string;
  createdAt: string;
}

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
}

export interface ConnectionConnectResult {
  connectionId: string;
}

export interface ConnectionDeleteResult {
  deleted: boolean;
}

export interface ConnectionColorProfileReassignResult {
  updatedCount: number;
}

const AUTH_TYPE_VALUES: ReadonlySet<string> = new Set(["SqlAuth", "ConnectionString", "EntraMfa"]);
const ENCRYPT_MODE_VALUES: ReadonlySet<string> = new Set(["Mandatory", "Optional", "Strict"]);

export function isAuthType(value: string): value is AuthType {
  return AUTH_TYPE_VALUES.has(value);
}

export function isEncryptMode(value: string): value is EncryptMode {
  return ENCRYPT_MODE_VALUES.has(value);
}
