import {
  type AutoBackupEntry,
  type AutoBackupMeta,
  BACKUP_SCHEMA_VERSION,
  type BackupFileConfig,
  type BackupFileDocument,
  type BackupFileHistoryEntry,
  type BackupFileHistoryReason,
  type BackupFilePermissionState,
  type BackupSource,
  type BackupState,
  type BackupStatus,
  DEFAULT_BACKUP_FILE_CONFIG,
  getSnapshotSignature,
  hasValidChecksum,
  isRecord,
  parseJSON,
  toTimestamp,
} from "./internal-models";

export function mergeDuplicateAutoBackupEntries(
  entries: AutoBackupEntry[]
): AutoBackupEntry[] {
  const restoreCheckpoints: AutoBackupEntry[] = [];
  const mergedSnapshots: AutoBackupEntry[] = [];
  const mergedSnapshotIndexes = new Map<string, number>();

  for (const entry of entries) {
    if (entry.reason === "restore-checkpoint") {
      restoreCheckpoints.push(entry);
      continue;
    }

    const signature = getSnapshotSignature(entry.payload, entry.checksum);
    const existingEntryIndex = mergedSnapshotIndexes.get(signature);

    if (existingEntryIndex === undefined) {
      mergedSnapshotIndexes.set(signature, mergedSnapshots.length);
      mergedSnapshots.push(entry);
      continue;
    }

    const existingEntry = mergedSnapshots[existingEntryIndex];
    const existingTime = toTimestamp(existingEntry.createdAt);
    const nextTime = toTimestamp(entry.createdAt);

    if (nextTime < existingTime) {
      mergedSnapshots[existingEntryIndex] = {
        ...existingEntry,
        createdAt: entry.createdAt,
      };
    }
  }

  return [...restoreCheckpoints, ...mergedSnapshots];
}

export function mergeDuplicateFileHistoryEntries(
  entries: BackupFileHistoryEntry[]
): BackupFileHistoryEntry[] {
  const mergedBySignature = new Map<string, BackupFileHistoryEntry>();

  for (const entry of entries) {
    const signature = getSnapshotSignature(entry.payload, entry.checksum);
    const existingEntry = mergedBySignature.get(signature);

    if (!existingEntry) {
      mergedBySignature.set(signature, entry);
      continue;
    }

    const existingTime = toTimestamp(existingEntry.createdAt);
    const nextTime = toTimestamp(entry.createdAt);

    if (nextTime < existingTime) {
      mergedBySignature.set(signature, entry);
    }
  }

  const mergedEntries = [...mergedBySignature.values()];

  mergedEntries.sort((first, second) => {
    return toTimestamp(first.createdAt) - toTimestamp(second.createdAt);
  });

  return mergedEntries;
}

export function parseBackupStatus(
  rawValue: string | null
): BackupStatus | null {
  const parsedValue = parseJSON<unknown>(rawValue);

  if (!isRecord(parsedValue)) {
    return null;
  }

  const { state, updatedAt, source, detail } = parsedValue;

  if (
    typeof state !== "string" ||
    typeof updatedAt !== "string" ||
    typeof source !== "string"
  ) {
    return null;
  }

  const nextStatus: BackupStatus = {
    state: state as BackupState,
    updatedAt,
    source: source as BackupSource,
  };

  if (typeof detail === "string") {
    nextStatus.detail = detail;
  }

  return nextStatus;
}

export function parseAutoBackupMeta(
  rawValue: string | null
): AutoBackupMeta | null {
  const parsedValue = parseJSON<unknown>(rawValue);

  if (!isRecord(parsedValue)) {
    return null;
  }

  const { lastDailySnapshotAt, lastHistorySnapshotAt } = parsedValue;

  if (
    lastDailySnapshotAt !== undefined &&
    typeof lastDailySnapshotAt !== "string"
  ) {
    return null;
  }

  if (
    lastHistorySnapshotAt !== undefined &&
    typeof lastHistorySnapshotAt !== "string"
  ) {
    return null;
  }

  return {
    lastDailySnapshotAt,
    lastHistorySnapshotAt,
  };
}

export function parseAutoBackupEntries(
  rawValue: string | null
): AutoBackupEntry[] {
  const parsedValue = parseJSON<unknown>(rawValue);

  if (!Array.isArray(parsedValue)) {
    return [];
  }

  const entries: AutoBackupEntry[] = [];

  for (const item of parsedValue) {
    if (!isRecord(item)) {
      continue;
    }

    const { id, createdAt, payload, reason, checksum } = item;

    if (
      typeof id !== "string" ||
      typeof createdAt !== "string" ||
      !isRecord(payload)
    ) {
      continue;
    }

    entries.push({
      id,
      createdAt,
      reason:
        reason === "manual" ||
        reason === "daily" ||
        reason === "autosave" ||
        reason === "restore-checkpoint"
          ? reason
          : "daily",
      checksum: typeof checksum === "string" ? checksum : undefined,
      payload,
    });
  }

  return entries;
}

export function parseBackupFileConfig(
  rawValue: string | null
): BackupFileConfig {
  const parsedValue = parseJSON<unknown>(rawValue);

  if (!isRecord(parsedValue)) {
    return DEFAULT_BACKUP_FILE_CONFIG;
  }

  const configured = parsedValue.configured;
  const updatedAt = parsedValue.updatedAt;
  const fileName = parsedValue.fileName;
  const permissionState = parsedValue.permissionState;
  const lastError = parsedValue.lastError;
  const lastSuccessfulWriteAt = parsedValue.lastSuccessfulWriteAt;
  const lastFailedWriteAt = parsedValue.lastFailedWriteAt;
  const consecutiveFailures = parsedValue.consecutiveFailures;
  const lastWriteErrorMessage = parsedValue.lastWriteErrorMessage;

  if (typeof configured !== "boolean" || typeof updatedAt !== "string") {
    return DEFAULT_BACKUP_FILE_CONFIG;
  }

  const normalizedPermissionState: BackupFilePermissionState =
    permissionState === "granted" ||
    permissionState === "prompt" ||
    permissionState === "denied" ||
    permissionState === "unconfigured"
      ? permissionState
      : "unconfigured";

  return {
    configured,
    updatedAt,
    fileName: typeof fileName === "string" ? fileName : undefined,
    permissionState: normalizedPermissionState,
    lastError: typeof lastError === "string" ? lastError : undefined,
    lastSuccessfulWriteAt:
      typeof lastSuccessfulWriteAt === "string"
        ? lastSuccessfulWriteAt
        : undefined,
    lastFailedWriteAt:
      typeof lastFailedWriteAt === "string" ? lastFailedWriteAt : undefined,
    consecutiveFailures:
      typeof consecutiveFailures === "number" && consecutiveFailures >= 0
        ? consecutiveFailures
        : 0,
    lastWriteErrorMessage:
      typeof lastWriteErrorMessage === "string"
        ? lastWriteErrorMessage
        : undefined,
  };
}

export function isBackupFileHistoryReason(
  reason: unknown
): reason is BackupFileHistoryReason {
  return (
    reason === "daily" ||
    reason === "manual" ||
    reason === "autosave" ||
    reason === "restore-checkpoint"
  );
}

export function normalizeBackupFileHistoryEntry(
  entry: unknown
): BackupFileHistoryEntry | null {
  if (!isRecord(entry)) {
    return null;
  }

  const { id, createdAt, reason, payload, checksum } = entry;

  if (
    typeof id !== "string" ||
    typeof createdAt !== "string" ||
    !isBackupFileHistoryReason(reason) ||
    !isRecord(payload)
  ) {
    return null;
  }

  if (typeof checksum === "string" && !hasValidChecksum(payload, checksum)) {
    return null;
  }

  return {
    id,
    createdAt,
    reason,
    checksum: typeof checksum === "string" ? checksum : undefined,
    payload,
  };
}

export function parseBackupFileDocument(
  rawValue: string
): BackupFileDocument | null {
  const parsedValue = parseJSON<unknown>(rawValue);

  if (!isRecord(parsedValue)) {
    return null;
  }

  const {
    version,
    schemaVersion,
    updatedAt,
    current,
    currentChecksum,
    history,
  } = parsedValue;

  if (
    version !== 1 ||
    typeof updatedAt !== "string" ||
    !isRecord(current) ||
    !Array.isArray(history)
  ) {
    return null;
  }

  if (schemaVersion !== undefined && schemaVersion !== BACKUP_SCHEMA_VERSION) {
    return null;
  }

  if (
    typeof currentChecksum === "string" &&
    !hasValidChecksum(current, currentChecksum)
  ) {
    return null;
  }

  const normalizedHistory: BackupFileHistoryEntry[] = [];

  for (const entry of history) {
    const normalizedEntry = normalizeBackupFileHistoryEntry(entry);

    if (!normalizedEntry) {
      continue;
    }

    normalizedHistory.push(normalizedEntry);
  }

  return {
    version: 1,
    schemaVersion:
      schemaVersion === BACKUP_SCHEMA_VERSION
        ? BACKUP_SCHEMA_VERSION
        : undefined,
    updatedAt,
    currentChecksum:
      typeof currentChecksum === "string" ? currentChecksum : undefined,
    current,
    history: normalizedHistory,
  };
}
