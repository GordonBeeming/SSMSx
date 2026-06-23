export const CONNECTION_CANCELLED_MESSAGE = "Connection attempt cancelled.";

export function isConnectionCancellation(error?: string | null): boolean {
  if (!error) return false;
  return error.trim().toLowerCase() === CONNECTION_CANCELLED_MESSAGE.toLowerCase();
}
