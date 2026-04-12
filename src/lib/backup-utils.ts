import {
  loadBackupFromFilePicker as loadBackupFromFilePickerInternal,
  parseBackupFile as parseBackupFileInternal,
} from "@/lib/backup-utils/file-import";
import {
  readBackupFileConfig,
  writeBackupToConfiguredFile,
} from "@/lib/backup-utils/internal-file";
import {
  AUTO_BACKUP_INTERVAL_MS,
  AUTOSAVE_DEBOUNCE_MS,
  type AutoBackupEntry,
  type AutoBackupSnapshot,
  BACKUP_STATUS_KEY,
  type BackupData,
  type BackupHistoryState,
  type BackupLocationStatus,
  type BackupSource,
  type BackupStatus,
  type BackupTimelineState,
  createBackupFileName,
  getSnapshotSignature,
  hasValidChecksum,
  toTimestamp,
} from "@/lib/backup-utils/internal-models";
import { parseBackupStatus } from "@/lib/backup-utils/internal-parsers";
import {
  readBackupLocationStatus as readBackupLocationStatusInternal,
  selectBackupLocation as selectBackupLocationInternal,
} from "@/lib/backup-utils/location-actions";
import {
  appendBackupHistoryEntry,
  applyBackupPayload,
  readAutoBackupEntries,
  readAutoBackupMeta,
  writeAutoBackupMeta,
} from "@/lib/backup-utils/storage-history";
import {
  readAppStorageRaw,
  writeMirrorStorageRaw,
} from "@/lib/extension-storage";
import { USER_STORAGE_KEYS } from "@/lib/storage-keys";

let autosaveTimer: number | null = null;
const QUICK_LINKS_PREVIEWS_STORAGE_KEY = "better-home-quick-links-previews";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stripPreviewImageDataForBackup(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  let hasChanges = false;
  const nextValue: Record<string, unknown> = {};

  for (const [comparableUrl, entry] of Object.entries(value)) {
    if (!isRecord(entry)) {
      nextValue[comparableUrl] = entry;
      continue;
    }

    if (typeof entry.imageDataUrl !== "string") {
      nextValue[comparableUrl] = entry;
      continue;
    }

    const { imageDataUrl: _unusedImageDataUrl, ...sanitizedEntry } = entry;
    nextValue[comparableUrl] = sanitizedEntry;
    hasChanges = true;
  }

  return hasChanges ? nextValue : value;
}

function sanitizeBackupPayload(backup: BackupData): BackupData {
  const previewValue = backup[QUICK_LINKS_PREVIEWS_STORAGE_KEY];
  const sanitizedPreviewValue = stripPreviewImageDataForBackup(previewValue);

  if (sanitizedPreviewValue === previewValue) {
    return backup;
  }

  return {
    ...backup,
    [QUICK_LINKS_PREVIEWS_STORAGE_KEY]: sanitizedPreviewValue,
  };
}

function updateBackupStatus(
  state: BackupStatus["state"],
  source: BackupSource,
  detail?: string
): void {
  const status: BackupStatus = {
    state,
    updatedAt: new Date().toISOString(),
    source,
  };
  if (detail) {
    status.detail = detail;
  }

  writeMirrorStorageRaw(BACKUP_STATUS_KEY, JSON.stringify(status));
}

function readStorageRawWithFallback(key: string): Promise<string | null> {
  return readAppStorageRaw(key);
}

export async function createBackup(): Promise<BackupData> {
  const backup: BackupData = {};

  for (const key of USER_STORAGE_KEYS) {
    const rawValue = await readAppStorageRaw(key);

    if (rawValue === null) {
      continue;
    }

    let parsedValue: unknown;

    try {
      parsedValue = JSON.parse(rawValue);
    } catch {
      parsedValue = rawValue;
    }

    backup[key] =
      key === QUICK_LINKS_PREVIEWS_STORAGE_KEY
        ? stripPreviewImageDataForBackup(parsedValue)
        : parsedValue;
  }

  return sanitizeBackupPayload(backup);
}

async function ensureAutosaveHistoryBackup(
  precomputedBackup?: BackupData
): Promise<boolean> {
  const autoBackupMeta = await readAutoBackupMeta();

  const backupPayload = precomputedBackup ?? (await createBackup());
  await appendBackupHistoryEntry(backupPayload, "autosave");
  await writeAutoBackupMeta({
    ...autoBackupMeta,
    lastHistorySnapshotAt: new Date().toISOString(),
  });

  return true;
}

async function readBackupReadiness(): Promise<{
  ready: boolean;
  detail: string;
}> {
  const locationStatus = await readBackupLocationStatus();

  if (!locationStatus.configured) {
    return {
      ready: false,
      detail: "select backup location first",
    };
  }

  if (locationStatus.needsReauthorization) {
    return {
      ready: false,
      detail: "reauthorize backup location",
    };
  }

  return {
    ready: true,
    detail: "ready",
  };
}

export async function ensureDailyAutoBackup(
  precomputedBackup?: BackupData,
  options?: {
    skipReadinessCheck?: boolean;
  }
): Promise<boolean> {
  if (!options?.skipReadinessCheck) {
    const readiness = await readBackupReadiness();

    if (!readiness.ready) {
      updateBackupStatus("error", "auto", readiness.detail);
      return false;
    }
  }

  const autoBackupMeta = await readAutoBackupMeta();

  if (autoBackupMeta?.lastDailySnapshotAt) {
    const lastSnapshotTime = Date.parse(autoBackupMeta.lastDailySnapshotAt);

    if (!Number.isNaN(lastSnapshotTime)) {
      const elapsedMs = Date.now() - lastSnapshotTime;

      if (elapsedMs < AUTO_BACKUP_INTERVAL_MS) {
        return false;
      }
    }
  }

  const backupPayload = precomputedBackup ?? (await createBackup());
  await appendBackupHistoryEntry(backupPayload, "daily");
  await writeAutoBackupMeta({
    ...autoBackupMeta,
    lastDailySnapshotAt: new Date().toISOString(),
  });

  const fileWritten = await writeBackupToConfiguredFile(
    backupPayload,
    {
      appendHistory: true,
      historyReason: "daily",
      requestPermission: true,
    },
    updateBackupStatus
  );

  if (!fileWritten) {
    return false;
  }

  updateBackupStatus("auto-saved", "auto");

  return true;
}

export function queueAutosaveBackup(): void {
  if (autosaveTimer !== null) {
    window.clearTimeout(autosaveTimer);
  }

  autosaveTimer = window.setTimeout(() => {
    flushAutosaveBackup().catch(() => null);
  }, AUTOSAVE_DEBOUNCE_MS);
}

async function flushAutosaveBackup(): Promise<void> {
  autosaveTimer = null;

  const readiness = await readBackupReadiness();

  if (!readiness.ready) {
    updateBackupStatus("error", "autosave", readiness.detail);
    return;
  }

  updateBackupStatus("saving", "autosave");

  try {
    const backupPayload = await createBackup();

    const fileWritten = await writeBackupToConfiguredFile(
      backupPayload,
      {
        appendHistory: false,
        historyReason: "autosave",
        requestPermission: true,
      },
      updateBackupStatus
    );

    if (!fileWritten) {
      return;
    }

    await ensureAutosaveHistoryBackup(backupPayload);
    await ensureDailyAutoBackup(backupPayload, {
      skipReadinessCheck: true,
    });

    updateBackupStatus("saved", "autosave");
  } catch (error) {
    updateBackupStatus(
      "error",
      "autosave",
      error instanceof Error ? error.message : "autosave failed"
    );
    throw error;
  }
}

async function createRestoreCheckpoint(): Promise<void> {
  const currentBackup = await createBackup();
  await appendBackupHistoryEntry(currentBackup, "restore-checkpoint");
}

function hasValidHistoryEntry(entry: AutoBackupEntry): boolean {
  return hasValidChecksum(entry.payload, entry.checksum);
}

function shouldEnableUndo(
  snapshots: AutoBackupEntry[],
  currentBackup: BackupData
): boolean {
  const latestRestoreCheckpoint = snapshots.find(
    (snapshot) => snapshot.reason === "restore-checkpoint"
  );

  if (
    !(latestRestoreCheckpoint && hasValidHistoryEntry(latestRestoreCheckpoint))
  ) {
    return false;
  }

  const restoreCheckpointSignature = getSnapshotSignature(
    latestRestoreCheckpoint.payload,
    latestRestoreCheckpoint.checksum
  );
  const currentBackupSignature = getSnapshotSignature(currentBackup);

  return restoreCheckpointSignature !== currentBackupSignature;
}

function getLatestSnapshot(
  snapshots: AutoBackupEntry[]
): AutoBackupEntry | undefined {
  return snapshots
    .filter((snapshot) => snapshot.reason !== "restore-checkpoint")
    .sort((first, second) => {
      return toTimestamp(second.createdAt) - toTimestamp(first.createdAt);
    })[0];
}

export async function readBackupHistoryState(
  limit = 12
): Promise<BackupHistoryState> {
  const snapshots = await readAutoBackupEntries();
  const currentBackup = await createBackup();

  return {
    snapshots: snapshots.slice(0, limit).map((snapshot) => ({
      id: snapshot.id,
      createdAt: snapshot.createdAt,
      reason: snapshot.reason,
    })),
    canUndoLastRestore: shouldEnableUndo(snapshots, currentBackup),
  };
}

export async function readBackupTimelineState(
  limit = 12
): Promise<BackupTimelineState> {
  const snapshots = await readAutoBackupEntries();
  const currentBackup = await createBackup();
  const latestSnapshot = getLatestSnapshot(snapshots);
  const currentSignature = getSnapshotSignature(currentBackup);
  const latestSignature = latestSnapshot
    ? getSnapshotSignature(latestSnapshot.payload, latestSnapshot.checksum)
    : null;

  return {
    snapshots: snapshots.slice(0, limit).map((snapshot) => ({
      id: snapshot.id,
      createdAt: snapshot.createdAt,
      reason: snapshot.reason,
    })),
    canUndoLastRestore: shouldEnableUndo(snapshots, currentBackup),
    hasChangesSinceLatestSnapshot:
      latestSignature === null ? true : currentSignature !== latestSignature,
    latestSnapshot: latestSnapshot
      ? {
          id: latestSnapshot.id,
          createdAt: latestSnapshot.createdAt,
          reason: latestSnapshot.reason,
        }
      : undefined,
  };
}

export async function listBackupHistory(
  limit = 5
): Promise<AutoBackupSnapshot[]> {
  const { snapshots } = await readBackupHistoryState(limit);
  return snapshots;
}

export async function restoreBackupHistoryEntry(
  snapshotId: string
): Promise<boolean> {
  const snapshots = await readAutoBackupEntries();
  const targetSnapshot = snapshots.find(
    (snapshot) => snapshot.id === snapshotId
  );

  if (!targetSnapshot) {
    return false;
  }

  if (!hasValidHistoryEntry(targetSnapshot)) {
    updateBackupStatus(
      "error",
      "auto-restore",
      "backup integrity check failed"
    );
    return false;
  }

  await createRestoreCheckpoint();

  await applyBackupPayload(
    targetSnapshot.payload,
    "auto-restore",
    updateBackupStatus
  );
  return true;
}

export async function restoreMostRecentRestoreCheckpoint(): Promise<boolean> {
  const snapshots = await readAutoBackupEntries();
  const latestCheckpoint = snapshots.find(
    (snapshot) => snapshot.reason === "restore-checkpoint"
  );

  if (!latestCheckpoint) {
    return false;
  }

  if (!hasValidHistoryEntry(latestCheckpoint)) {
    updateBackupStatus(
      "error",
      "auto-restore",
      "backup integrity check failed"
    );
    return false;
  }

  await applyBackupPayload(
    latestCheckpoint.payload,
    "auto-restore",
    updateBackupStatus
  );
  return true;
}

export async function restoreLatestBackupHistoryEntry(): Promise<boolean> {
  const [latestSnapshot] = await readAutoBackupEntries();

  if (!latestSnapshot) {
    return false;
  }

  return restoreBackupHistoryEntry(latestSnapshot.id);
}

export function selectBackupLocation(): Promise<boolean> {
  return selectBackupLocationInternal(createBackup, updateBackupStatus);
}

export function readBackupLocationStatus(): Promise<BackupLocationStatus> {
  return readBackupLocationStatusInternal();
}

export async function backupNow(): Promise<boolean> {
  const backupPayload = await createBackup();
  const fileWritten = await writeBackupToConfiguredFile(
    backupPayload,
    {
      appendHistory: true,
      historyReason: "manual",
      requestPermission: true,
    },
    updateBackupStatus
  );

  if (!fileWritten) {
    return false;
  }

  await appendBackupHistoryEntry(backupPayload, "manual");
  await writeAutoBackupMeta({
    ...(await readAutoBackupMeta()),
    lastHistorySnapshotAt: new Date().toISOString(),
  });

  updateBackupStatus("saved", "manual");
  return true;
}

export async function saveBackupWithFilePicker(
  backup: BackupData
): Promise<boolean> {
  const sanitizedBackup = sanitizeBackupPayload(backup);
  const selected = await selectBackupLocation();

  if (!selected) {
    return false;
  }

  const fileWritten = await writeBackupToConfiguredFile(
    sanitizedBackup,
    {
      appendHistory: true,
      historyReason: "manual",
      requestPermission: true,
    },
    updateBackupStatus
  );

  if (!fileWritten) {
    return false;
  }

  await appendBackupHistoryEntry(sanitizedBackup, "manual");
  updateBackupStatus("saved", "file-picker");
  return true;
}

export function downloadBackup(backup: BackupData): void {
  const sanitizedBackup = sanitizeBackupPayload(backup);
  const dataString = JSON.stringify(sanitizedBackup, null, 2);
  const dataBlob = new Blob([dataString], { type: "application/json" });
  const objectURL = URL.createObjectURL(dataBlob);

  const link = document.createElement("a");
  link.href = objectURL;
  link.download = createBackupFileName(new Date());
  link.style.display = "none";

  const container = document.body || document.documentElement;
  container.appendChild(link);
  link.click();
  container.removeChild(link);

  URL.revokeObjectURL(objectURL);
  updateBackupStatus("saved", "download");
}

export async function restoreBackup(backup: BackupData): Promise<void> {
  await createRestoreCheckpoint();
  await applyBackupPayload(backup, "restore", updateBackupStatus);
}

export function loadBackupFromFilePicker(): Promise<BackupData | null> {
  return loadBackupFromFilePickerInternal(updateBackupStatus);
}

export function parseBackupFile(
  file: File,
  onSuccess: (backup: BackupData) => void
): void {
  parseBackupFileInternal(file, onSuccess, updateBackupStatus);
}

export async function readLatestBackupStatus(): Promise<BackupStatus> {
  const status = parseBackupStatus(
    await readStorageRawWithFallback(BACKUP_STATUS_KEY)
  );

  if (status) {
    return status;
  }

  return {
    state: "idle",
    updatedAt: "",
    source: "auto",
  };
}

export async function hasConfiguredBackupFile(): Promise<boolean> {
  const config = await readBackupFileConfig();
  return config.configured;
}

export type {
  AutoBackupSnapshot,
  BackupData,
  BackupHistoryState,
  BackupLocationStatus,
  BackupStatus,
  BackupTimelineState,
} from "@/lib/backup-utils/internal-models";
