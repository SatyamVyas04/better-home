import { readPrimaryBackupFileHandle } from "@/lib/backup-file-handle-store";
import { readAppStorageRaw, writeAppStorageRaw } from "@/lib/extension-storage";
import {
  BACKUP_FILE_CONFIG_KEY,
  BACKUP_FILE_HISTORY_LIMIT,
  BACKUP_SCHEMA_VERSION,
  type BackupData,
  type BackupFileConfig,
  type BackupFileDocument,
  type BackupFileHistoryEntry,
  type BackupFileHistoryReason,
  type BackupFilePermissionState,
  type BackupSource,
  calculateChecksum,
  createUniqueId,
  DEFAULT_BACKUP_FILE_CONFIG,
  type PermissionCapableFileHandle,
} from "./internal-models";
import {
  mergeDuplicateFileHistoryEntries,
  parseBackupFileConfig,
  parseBackupFileDocument,
} from "./internal-parsers";

type UpdateBackupStatusFn = (
  state: "idle" | "saving" | "saved" | "restored" | "auto-saved" | "error",
  source: BackupSource,
  detail?: string
) => void;

export async function readBackupFileConfig(): Promise<BackupFileConfig> {
  const rawValue = await readAppStorageRaw(BACKUP_FILE_CONFIG_KEY);
  return parseBackupFileConfig(rawValue);
}

export async function writeBackupFileConfig(
  config: BackupFileConfig
): Promise<void> {
  await writeAppStorageRaw(BACKUP_FILE_CONFIG_KEY, JSON.stringify(config));
}

export async function ensureReadWritePermission(
  fileHandle: PermissionCapableFileHandle,
  requestIfNeeded: boolean
): Promise<BackupFilePermissionState> {
  if (!(fileHandle.queryPermission && fileHandle.requestPermission)) {
    return "granted";
  }

  try {
    const currentPermission = await fileHandle.queryPermission({
      mode: "readwrite",
    });

    if (currentPermission === "granted") {
      return "granted";
    }

    if (!requestIfNeeded) {
      return currentPermission as BackupFilePermissionState;
    }

    const requestedPermission = await fileHandle.requestPermission({
      mode: "readwrite",
    });

    return requestedPermission as BackupFilePermissionState;
  } catch {
    return "denied";
  }
}

async function readOrCreateBackupFileDocument(
  fileHandle: FileSystemFileHandle,
  backup: BackupData
): Promise<BackupFileDocument> {
  try {
    const file = await fileHandle.getFile();
    const text = await file.text();

    const existingDocument = parseBackupFileDocument(text);
    if (existingDocument) {
      return existingDocument;
    }
  } catch {
    return {
      version: 1,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      currentChecksum: calculateChecksum(backup),
      current: backup,
      history: [],
    };
  }

  return {
    version: 1,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    currentChecksum: calculateChecksum(backup),
    current: backup,
    history: [],
  };
}

function getBackupSourceFromHistoryReason(
  reason: BackupFileHistoryReason
): BackupSource {
  if (reason === "manual") {
    return "manual";
  }

  if (reason === "daily") {
    return "auto";
  }

  if (reason === "restore-checkpoint") {
    return "auto-restore";
  }

  return "autosave";
}

export async function writeBackupFileDocument(
  fileHandle: PermissionCapableFileHandle,
  backup: BackupData,
  options: {
    appendHistory: boolean;
    historyReason: BackupFileHistoryReason;
    requestPermission: boolean;
  },
  updateBackupStatus: UpdateBackupStatusFn
): Promise<boolean> {
  const source = getBackupSourceFromHistoryReason(options.historyReason);
  const permissionState = await ensureReadWritePermission(
    fileHandle,
    options.requestPermission
  );

  if (permissionState !== "granted") {
    const existingConfig = await readBackupFileConfig();
    const failureCount = existingConfig.consecutiveFailures + 1;
    const failureTime = new Date().toISOString();

    await writeBackupFileConfig({
      configured: true,
      updatedAt: failureTime,
      fileName: fileHandle.name,
      permissionState,
      lastError: "Backup file permission is not granted",
      lastSuccessfulWriteAt: existingConfig.lastSuccessfulWriteAt,
      lastFailedWriteAt: failureTime,
      consecutiveFailures: failureCount,
      lastWriteErrorMessage: `Permission is ${permissionState}`,
    });

    updateBackupStatus("error", source, "reauthorize backup location");

    return false;
  }

  const existingDocument = await readOrCreateBackupFileDocument(
    fileHandle,
    backup
  );
  const nextDocument: BackupFileDocument = {
    ...existingDocument,
    version: 1,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    currentChecksum: calculateChecksum(backup),
    current: backup,
  };

  if (options.appendHistory) {
    const nextHistoryEntry: BackupFileHistoryEntry = {
      id: createUniqueId("history"),
      createdAt: new Date().toISOString(),
      reason: options.historyReason,
      checksum: calculateChecksum(backup),
      payload: backup,
    };

    nextDocument.history = mergeDuplicateFileHistoryEntries([
      ...existingDocument.history,
      nextHistoryEntry,
    ]).slice(-BACKUP_FILE_HISTORY_LIMIT);
  }

  try {
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(nextDocument, null, 2));
    await writable.close();

    const successTime = new Date().toISOString();

    await writeBackupFileConfig({
      configured: true,
      updatedAt: successTime,
      fileName: fileHandle.name,
      permissionState: "granted",
      lastSuccessfulWriteAt: successTime,
      consecutiveFailures: 0,
    });

    return true;
  } catch (error) {
    const existingConfig = await readBackupFileConfig();
    const failureCount = existingConfig.consecutiveFailures + 1;
    const failureTime = new Date().toISOString();

    await writeBackupFileConfig({
      configured: true,
      updatedAt: failureTime,
      fileName: fileHandle.name,
      permissionState: "granted",
      lastError: "Failed writing backup file",
      lastSuccessfulWriteAt: existingConfig.lastSuccessfulWriteAt,
      lastFailedWriteAt: failureTime,
      consecutiveFailures: failureCount,
      lastWriteErrorMessage:
        error instanceof Error ? error.message : "Unknown write error",
    });

    updateBackupStatus("error", source, "failed writing backup file");
    return false;
  }
}

export async function writeBackupToConfiguredFile(
  backup: BackupData,
  options: {
    appendHistory: boolean;
    historyReason: BackupFileHistoryReason;
    requestPermission: boolean;
  },
  updateBackupStatus: UpdateBackupStatusFn
): Promise<boolean> {
  const fileHandle =
    (await readPrimaryBackupFileHandle()) as PermissionCapableFileHandle | null;

  if (!fileHandle) {
    return false;
  }

  return writeBackupFileDocument(
    fileHandle,
    backup,
    options,
    updateBackupStatus
  );
}

export function defaultBackupFileConfig(): BackupFileConfig {
  return DEFAULT_BACKUP_FILE_CONFIG;
}
