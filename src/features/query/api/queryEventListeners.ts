import { useQueryStore } from "../store/queryStore";
import { onQueryResults, onQueryComplete, onQueryError } from "./queryApi";
import { isTauriRuntime } from "../../../shared/utils/tauri";

let initialized = false;

/**
 * Register Tauri event listeners for query streaming.
 *
 * This is called ONCE at app startup (from main.tsx), not from a React effect.
 * Tying listener lifecycle to component mount/unmount caused problems in
 * React strict mode: the async setup/cleanup race would leave Tauri's
 * internal listener registry in an inconsistent state, breaking the
 * listener chain (symptom: "listeners[eventId].handlerId" undefined error).
 *
 * Listeners are wired directly to the zustand store (which is already a
 * global singleton), so there's no reason to scope them to a component.
 */
export async function initQueryEventListeners(): Promise<void> {
  if (initialized) return;
  if (!isTauriRuntime()) return;
  initialized = true;

  try {
    await onQueryResults((payload) => {
      useQueryStore.getState().handleResultsBatch(payload);
    });

    await onQueryComplete((payload) => {
      useQueryStore.getState().handleQueryComplete(payload);
    });

    await onQueryError((payload) => {
      useQueryStore
        .getState()
        .handleQueryError(payload.queryId, payload.requestId, payload.error);
    });
  } catch (e) {
    console.error("Failed to initialize query event listeners:", e);
    // Reset flag so we can try again if needed
    initialized = false;
  }
}
