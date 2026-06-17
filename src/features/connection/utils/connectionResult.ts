export const CONNECTION_CANCELLED_MESSAGE = "Connection attempt cancelled.";

export function isConnectionCancellation(error?: string | null): boolean {
  return error?.toLowerCase().includes("cancel") ?? false;
}
