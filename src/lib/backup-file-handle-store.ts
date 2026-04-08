const BACKUP_FILE_DB_NAME = "better-home-backup-file-db";
const BACKUP_FILE_STORE_NAME = "backup-file-handles";
const BACKUP_FILE_HANDLE_KEY = "primary";

function openBackupFileDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(BACKUP_FILE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(BACKUP_FILE_STORE_NAME)) {
        database.createObjectStore(BACKUP_FILE_STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function savePrimaryBackupFileHandle(
  fileHandle: FileSystemFileHandle
): Promise<void> {
  const database = await openBackupFileDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      BACKUP_FILE_STORE_NAME,
      "readwrite"
    );
    const store = transaction.objectStore(BACKUP_FILE_STORE_NAME);

    store.put(fileHandle, BACKUP_FILE_HANDLE_KEY);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };

    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

export async function readPrimaryBackupFileHandle(): Promise<FileSystemFileHandle | null> {
  const database = await openBackupFileDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      BACKUP_FILE_STORE_NAME,
      "readonly"
    );
    const store = transaction.objectStore(BACKUP_FILE_STORE_NAME);
    const request = store.get(BACKUP_FILE_HANDLE_KEY);

    request.onsuccess = () => {
      const result = request.result;

      if (result && typeof result === "object") {
        resolve(result as FileSystemFileHandle);
      } else {
        resolve(null);
      }
    };

    request.onerror = () => {
      reject(request.error);
    };

    transaction.oncomplete = () => {
      database.close();
    };
  });
}
