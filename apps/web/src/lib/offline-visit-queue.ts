"use client";

import { apiFetch, ApiError } from "./api";

// PRD §5 Offline-First — "Allow creating leads, logging visits, adding notes without
// internet... Sync data when connectivity returns." This covers the check-in half of
// visit logging specifically: a field rep's GPS position is captured the instant they tap
// "Check in" regardless of connectivity, then synced in the background. Check-out is
// intentionally NOT queued — it targets a specific visit id, and chaining it behind an
// unsynced check-in (which may not have a server id yet) adds real conflict-resolution
// complexity for comparatively little value, since a rep still at/near the location can
// simply retry check-out once back in signal.

const DB_NAME = "ai-salesos-offline";
const DB_VERSION = 1;
const STORE_NAME = "queued-check-ins";

export interface QueuedCheckInPayload {
  leadId?: string;
  customerId?: string;
  purpose: string;
  notes?: string;
  lat: number;
  lng: number;
}

export interface QueuedCheckIn {
  id: number;
  clientId: string;
  payload: QueuedCheckInPayload;
  queuedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error as unknown as Error);
  });
}

export async function queueCheckIn(payload: QueuedCheckInPayload, clientId: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).add({ clientId, payload, queuedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error as unknown as Error);
    });
  } finally {
    db.close();
  }
}

export async function getQueuedCheckIns(): Promise<QueuedCheckIn[]> {
  const db = await openDb();
  try {
    return await new Promise<QueuedCheckIn[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as QueuedCheckIn[]);
      request.onerror = () => reject(request.error as unknown as Error);
    });
  } finally {
    db.close();
  }
}

async function removeQueuedCheckIn(id: number): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error as unknown as Error);
    });
  } finally {
    db.close();
  }
}

/** Attempts to sync every queued check-in with the server, in order, stopping at the first
 * connectivity-type failure so the rest retry together next time (a permanent 4xx, e.g. a
 * lead that got deleted in the meantime, is dropped instead of blocking the queue forever). */
export async function flushQueuedCheckIns(): Promise<{ synced: number; remaining: number }> {
  const queued = await getQueuedCheckIns();
  let synced = 0;

  for (const item of queued) {
    try {
      await apiFetch("/visits/check-in", {
        method: "POST",
        body: JSON.stringify({ ...item.payload, clientId: item.clientId }),
      });
      await removeQueuedCheckIn(item.id);
      synced++;
    } catch (err) {
      const isPermanentClientError = err instanceof ApiError && err.status >= 400 && err.status < 500;
      if (isPermanentClientError) {
        await removeQueuedCheckIn(item.id);
        continue;
      }
      break; // still offline (or a server error) — keep the rest queued for next time
    }
  }

  const remaining = await getQueuedCheckIns();
  return { synced, remaining: remaining.length };
}
