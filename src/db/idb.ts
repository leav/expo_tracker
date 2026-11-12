const DB_NAME = "expo-tracker";
const STORE = "sqlite";
const KEY = "vendor";

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open browser storage."));
  });
}

export async function idbGet(): Promise<Uint8Array | undefined> {
  const db = await openIdb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      request.onsuccess = () => {
        const value = request.result;
        if (value instanceof Uint8Array) {
          resolve(value);
          return;
        }
        if (value instanceof ArrayBuffer) {
          resolve(new Uint8Array(value));
          return;
        }
        resolve(undefined);
      };
      request.onerror = () => reject(request.error ?? new Error("Could not read the saved workspace."));
    });
  } finally {
    db.close();
  }
}

export function copySqliteBytes(bytes: Uint8Array): Uint8Array {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

export async function idbSet(bytes: Uint8Array): Promise<void> {
  const db = await openIdb();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(bytes, KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("Could not save the workspace."));
    });
  } finally {
    db.close();
  }
}
