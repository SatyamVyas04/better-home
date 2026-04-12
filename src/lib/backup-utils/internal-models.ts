export const BACKUP_STATUS_KEY = "better-home-backup-status";
export const AUTO_BACKUPS_KEY = "better-home-auto-backups";
export const AUTO_BACKUP_META_KEY = "better-home-auto-backup-meta";
export const BACKUP_FILE_CONFIG_KEY = "better-home-backup-file-config";
export const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const BACKUP_HISTORY_LIMIT = 30;
export const BACKUP_FILE_HISTORY_LIMIT = 30;
export const AUTOSAVE_DEBOUNCE_MS = 1500;
export const BACKUP_SCHEMA_VERSION = 1;

export type BackupState =
  | "idle"
  | "saving"
  | "saved"
  | "restored"
  | "auto-saved"
  | "error";

export type BackupSource =
  | "download"
  | "file-picker"
  | "restore"
  | "auto"
  | "auto-restore"
  | "manual"
  | "autosave";

export type BackupFilePermissionState =
  | "unconfigured"
  | "granted"
  | "prompt"
  | "denied";

export type BackupFileHistoryReason =
  | "daily"
  | "manual"
  | "autosave"
  | "restore-checkpoint";

export interface BackupStatus {
  state: BackupState;
  updatedAt: string;
  source: BackupSource;
  detail?: string;
}

export interface BackupData {
  [key: string]: unknown;
}

export interface AutoBackupEntry {
  id: string;
  createdAt: string;
  reason: BackupFileHistoryReason;
  checksum?: string;
  payload: BackupData;
}

export interface AutoBackupMeta {
  lastDailySnapshotAt?: string;
  lastHistorySnapshotAt?: string;
}

export interface AutoBackupSnapshot {
  id: string;
  createdAt: string;
  reason: BackupFileHistoryReason;
}

export interface BackupHistoryState {
  snapshots: AutoBackupSnapshot[];
  canUndoLastRestore: boolean;
}

export interface BackupTimelineState extends BackupHistoryState {
  hasChangesSinceLatestSnapshot: boolean;
  latestSnapshot?: AutoBackupSnapshot;
}

export interface BackupLocationStatus {
  configured: boolean;
  fileName?: string;
  permissionState: BackupFilePermissionState;
  needsReauthorization: boolean;
  lastError?: string;
  lastSuccessfulWriteAt?: string;
  lastFailedWriteAt?: string;
  consecutiveFailures: number;
  lastWriteErrorMessage?: string;
}

export interface BackupFileConfig {
  configured: boolean;
  updatedAt: string;
  fileName?: string;
  permissionState: BackupFilePermissionState;
  lastError?: string;
  lastSuccessfulWriteAt?: string;
  lastFailedWriteAt?: string;
  consecutiveFailures: number;
  lastWriteErrorMessage?: string;
}

export interface BackupFileHistoryEntry {
  id: string;
  createdAt: string;
  reason: BackupFileHistoryReason;
  checksum?: string;
  payload: BackupData;
}

export interface BackupFileDocument {
  version: 1;
  schemaVersion?: number;
  updatedAt: string;
  currentChecksum?: string;
  current: BackupData;
  history: BackupFileHistoryEntry[];
}

export interface BackupFilePickerWindow extends Window {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
    excludeAcceptAllOption?: boolean;
  }) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
    excludeAcceptAllOption?: boolean;
  }) => Promise<FileSystemFileHandle[]>;
}

export interface PermissionCapableFileHandle extends FileSystemFileHandle {
  queryPermission?: (options?: {
    mode: "read" | "readwrite";
  }) => Promise<PermissionState>;
  requestPermission?: (options?: {
    mode: "read" | "readwrite";
  }) => Promise<PermissionState>;
}

export const DEFAULT_BACKUP_FILE_CONFIG: BackupFileConfig = {
  configured: false,
  updatedAt: "",
  permissionState: "unconfigured",
  consecutiveFailures: 0,
};

export function parseJSON<T>(rawValue: string | null): T | null {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function createUniqueId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

export function createBackupFileName(date: Date): string {
  return `better-home-backup-${date.toISOString().split("T")[0]}.json`;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).sort(([firstKey], [secondKey]) =>
      firstKey.localeCompare(secondKey)
    );

    return entries.reduce<Record<string, unknown>>(
      (result, [key, nextValue]) => {
        result[key] = canonicalize(nextValue);
        return result;
      },
      {}
    );
  }

  return value;
}

export function calculateChecksum(payload: BackupData): string {
  const HASH_MODULUS = 2_147_483_647;
  const normalizedPayload = canonicalize(payload);
  const serializedPayload = JSON.stringify(normalizedPayload);
  let hash = 0;

  for (let index = 0; index < serializedPayload.length; index += 1) {
    const characterCode = serializedPayload.charCodeAt(index);
    hash = (hash * 31 + characterCode) % HASH_MODULUS;
  }

  return hash.toString(36);
}

export function hasValidChecksum(
  payload: BackupData,
  checksum?: string
): boolean {
  if (!checksum) {
    return true;
  }

  return calculateChecksum(payload) === checksum;
}

export function toTimestamp(value: string): number {
  const parsedTime = Date.parse(value);

  if (Number.isNaN(parsedTime)) {
    return 0;
  }

  return parsedTime;
}

export function getSnapshotSignature(
  payload: BackupData,
  checksum?: string
): string {
  const resolvedChecksum = checksum ?? calculateChecksum(payload);
  return `${resolvedChecksum}:${JSON.stringify(canonicalize(payload))}`;
}
