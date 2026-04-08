import {
  readPrimaryBackupFileHandle,
  savePrimaryBackupFileHandle,
} from "@/lib/backup-file-handle-store";
import {
  readAppStorageRaw,
  writeAppStorageRaw,
  writeMirrorStorageRaw,
} from "@/lib/extension-storage";
import { USER_STORAGE_KEYS } from "@/lib/storage-keys";

const BACKUP_STATUS_KEY = "better-home-backup-status";
const AUTO_BACKUPS_KEY = "better-home-auto-backups";
const AUTO_BACKUP_META_KEY = "better-home-auto-backup-meta";
const BACKUP_FILE_CONFIG_KEY = "better-home-backup-file-config";
const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const BACKUP_HISTORY_LIMIT = 30;
const BACKUP_FILE_HISTORY_LIMIT = 30;
const AUTOSAVE_DEBOUNCE_MS = 1500;

type BackupState =
  | "idle"
  | "saving"
  | "saved"
  | "restored"
  | "auto-saved"
  | "error";
type BackupSource =
  | "download"
  | "file-picker"
  | "restore"
  | "auto"
  | "auto-restore"
  | "manual"
  | "autosave";

type BackupFilePermissionState =
  | "unconfigured"
  | "granted"
  | "prompt"
  | "denied";

type BackupFileHistoryReason =
  | "daily"
  | "manual"
  | "autosave"
  | "restore-checkpoint";

const BACKUP_SCHEMA_VERSION = 1;

export interface BackupStatus {
  state: BackupState;
  updatedAt: string;
  source: BackupSource;
  detail?: string;
}

export interface BackupData {
  [key: string]: unknown;
}

interface AutoBackupEntry {
  id: string;
  createdAt: string;
  reason: BackupFileHistoryReason;
  checksum?: string;
  payload: BackupData;
}

interface AutoBackupMeta {
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

interface BackupFileConfig {
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

interface BackupFileHistoryEntry {
  id: string;
  createdAt: string;
  reason: BackupFileHistoryReason;
  checksum?: string;
  payload: BackupData;
}

interface BackupFileDocument {
  version: 1;
  schemaVersion?: number;
  updatedAt: string;
  currentChecksum?: string;
  current: BackupData;
  history: BackupFileHistoryEntry[];
}

interface BackupFilePickerWindow extends Window {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
    excludeAcceptAllOption?: boolean;
  }) => Promise<FileSystemFileHandle>;
}

interface PermissionCapableFileHandle extends FileSystemFileHandle {
  queryPermission?: (options?: {
    mode: "read" | "readwrite";
  }) => Promise<PermissionState>;
  requestPermission?: (options?: {
    mode: "read" | "readwrite";
  }) => Promise<PermissionState>;
}

const DEFAULT_BACKUP_FILE_CONFIG: BackupFileConfig = {
  configured: false,
  updatedAt: "",
  permissionState: "unconfigured",
  consecutiveFailures: 0,
};

let autosaveTimer: number | null = null;

function parseJSON<T>(rawValue: string | null): T | null {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createUniqueId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

function createBackupFileName(date: Date): string {
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

function calculateChecksum(payload: BackupData): string {
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

function hasValidChecksum(payload: BackupData, checksum?: string): boolean {
  if (!checksum) {
    return true;
  }

  return calculateChecksum(payload) === checksum;
}

function toTimestamp(value: string): number {
  const parsedTime = Date.parse(value);

  if (Number.isNaN(parsedTime)) {
    return 0;
  }

  return parsedTime;
}

function getSnapshotSignature(payload: BackupData, checksum?: string): string {
  const resolvedChecksum = checksum ?? calculateChecksum(payload);
  return `${resolvedChecksum}:${JSON.stringify(canonicalize(payload))}`;
}

function mergeDuplicateAutoBackupEntries(
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

function mergeDuplicateFileHistoryEntries(
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

function parseBackupStatus(rawValue: string | null): BackupStatus | null {
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

function updateBackupStatus(
  state: BackupState,
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

function parseAutoBackupMeta(rawValue: string | null): AutoBackupMeta | null {
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

function parseAutoBackupEntries(rawValue: string | null): AutoBackupEntry[] {
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

function parseBackupFileConfig(rawValue: string | null): BackupFileConfig {
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

function isBackupFileHistoryReason(
  reason: unknown
): reason is BackupFileHistoryReason {
  return (
    reason === "daily" ||
    reason === "manual" ||
    reason === "autosave" ||
    reason === "restore-checkpoint"
  );
}

function normalizeBackupFileHistoryEntry(
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

function parseBackupFileDocument(rawValue: string): BackupFileDocument | null {
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

async function readBackupFileConfig(): Promise<BackupFileConfig> {
  const rawValue = await readAppStorageRaw(BACKUP_FILE_CONFIG_KEY);
  return parseBackupFileConfig(rawValue);
}

async function writeBackupFileConfig(config: BackupFileConfig): Promise<void> {
  await writeAppStorageRaw(BACKUP_FILE_CONFIG_KEY, JSON.stringify(config));
}

async function ensureReadWritePermission(
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

async function writeBackupFileDocument(
  fileHandle: PermissionCapableFileHandle,
  backup: BackupData,
  options: {
    appendHistory: boolean;
    historyReason: BackupFileHistoryReason;
    requestPermission: boolean;
  }
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

async function writeBackupToConfiguredFile(
  backup: BackupData,
  options: {
    appendHistory: boolean;
    historyReason: BackupFileHistoryReason;
    requestPermission: boolean;
  }
): Promise<boolean> {
  const fileHandle =
    (await readPrimaryBackupFileHandle()) as PermissionCapableFileHandle | null;

  if (!fileHandle) {
    return false;
  }

  return writeBackupFileDocument(fileHandle, backup, options);
}

function readStorageRawWithFallback(key: string): Promise<string | null> {
  return readAppStorageRaw(key);
}

async function readAutoBackupEntries(): Promise<AutoBackupEntry[]> {
  return parseAutoBackupEntries(
    await readStorageRawWithFallback(AUTO_BACKUPS_KEY)
  );
}

async function writeAutoBackupEntries(
  entries: AutoBackupEntry[]
): Promise<void> {
  await writeAppStorageRaw(AUTO_BACKUPS_KEY, JSON.stringify(entries));
}

async function readAutoBackupMeta(): Promise<AutoBackupMeta> {
  return (
    parseAutoBackupMeta(
      await readStorageRawWithFallback(AUTO_BACKUP_META_KEY)
    ) ?? {}
  );
}

async function writeAutoBackupMeta(meta: AutoBackupMeta): Promise<void> {
  await writeAppStorageRaw(AUTO_BACKUP_META_KEY, JSON.stringify(meta));
}

async function appendBackupHistoryEntry(
  payload: BackupData,
  reason: BackupFileHistoryReason
): Promise<void> {
  const nextChecksum = calculateChecksum(payload);
  const nextSignature = getSnapshotSignature(payload, nextChecksum);
  const nextEntry: AutoBackupEntry = {
    id: createUniqueId("history"),
    createdAt: new Date().toISOString(),
    reason,
    checksum: nextChecksum,
    payload,
  };

  const existingEntries = await readAutoBackupEntries();
  const compactedExistingEntries = mergeDuplicateAutoBackupEntries(
    existingEntries
  ).slice(0, BACKUP_HISTORY_LIMIT);

  const shouldSkipAppend =
    reason !== "restore-checkpoint" &&
    compactedExistingEntries.some((entry) => {
      if (entry.reason === "restore-checkpoint") {
        return false;
      }

      return (
        getSnapshotSignature(entry.payload, entry.checksum) === nextSignature
      );
    });

  if (shouldSkipAppend) {
    if (compactedExistingEntries.length !== existingEntries.length) {
      await writeAutoBackupEntries(compactedExistingEntries);
    }
    return;
  }

  const nextEntries = mergeDuplicateAutoBackupEntries([
    nextEntry,
    ...compactedExistingEntries,
  ]).slice(0, BACKUP_HISTORY_LIMIT);

  await writeAutoBackupEntries(nextEntries);
}

async function applyBackupPayload(
  backup: BackupData,
  source: BackupSource
): Promise<void> {
  for (const key of Object.keys(backup)) {
    const value = backup[key];

    if (typeof value === "string" && key === "vite-ui-theme") {
      await writeAppStorageRaw(key, value);
      continue;
    }

    await writeAppStorageRaw(key, JSON.stringify(value));
  }

  updateBackupStatus("restored", source);
}

export async function createBackup(): Promise<BackupData> {
  const backup: BackupData = {};

  for (const key of USER_STORAGE_KEYS) {
    const rawValue = await readAppStorageRaw(key);

    if (rawValue === null) {
      continue;
    }

    try {
      backup[key] = JSON.parse(rawValue);
    } catch {
      backup[key] = rawValue;
    }
  }

  return backup;
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

  const fileWritten = await writeBackupToConfiguredFile(backupPayload, {
    appendHistory: true,
    historyReason: "daily",
    requestPermission: true,
  });

  if (!fileWritten) {
    return false;
  }

  updateBackupStatus("auto-saved", "auto");

  return true;
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

  const fileHandle = await readPrimaryBackupFileHandle();

  if (!fileHandle) {
    return {
      ready: false,
      detail: "select backup location first",
    };
  }

  return {
    ready: true,
    detail: "ready",
  };
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

    const fileWritten = await writeBackupToConfiguredFile(backupPayload, {
      appendHistory: false,
      historyReason: "autosave",
      requestPermission: true,
    });

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

  await applyBackupPayload(targetSnapshot.payload, "auto-restore");
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

  await applyBackupPayload(latestCheckpoint.payload, "auto-restore");
  return true;
}

export async function restoreLatestBackupHistoryEntry(): Promise<boolean> {
  const [latestSnapshot] = await readAutoBackupEntries();

  if (!latestSnapshot) {
    return false;
  }

  return restoreBackupHistoryEntry(latestSnapshot.id);
}

export async function selectBackupLocation(): Promise<boolean> {
  const runtimeWindow = window as BackupFilePickerWindow;

  if (!runtimeWindow.showSaveFilePicker) {
    updateBackupStatus("error", "file-picker", "file picker not supported");
    return false;
  }

  try {
    const fileHandle = await runtimeWindow.showSaveFilePicker({
      suggestedName: createBackupFileName(new Date()),
      types: [
        {
          description: "JSON backup",
          accept: {
            "application/json": [".json"],
          },
        },
      ],
      excludeAcceptAllOption: false,
    });

    await savePrimaryBackupFileHandle(fileHandle);

    const permissionState = await ensureReadWritePermission(fileHandle, true);
    const needsReauthorization = permissionState !== "granted";
    const existingConfig = await readBackupFileConfig();

    await writeBackupFileConfig({
      configured: true,
      updatedAt: new Date().toISOString(),
      fileName: fileHandle.name,
      permissionState,
      lastError: needsReauthorization
        ? "Backup file permission is not granted"
        : undefined,
      lastSuccessfulWriteAt: existingConfig.lastSuccessfulWriteAt,
      lastFailedWriteAt: existingConfig.lastFailedWriteAt,
      consecutiveFailures: needsReauthorization
        ? existingConfig.consecutiveFailures + 1
        : 0,
      lastWriteErrorMessage: needsReauthorization
        ? `Permission is ${permissionState}`
        : undefined,
    });

    if (needsReauthorization) {
      updateBackupStatus("error", "file-picker", "reauthorize backup location");
    } else {
      updateBackupStatus("saved", "file-picker", "backup location ready");
    }

    return true;
  } catch {
    return false;
  }
}

export async function readBackupLocationStatus(): Promise<BackupLocationStatus> {
  const config = await readBackupFileConfig();

  return {
    configured: config.configured,
    fileName: config.fileName,
    permissionState: config.permissionState,
    needsReauthorization:
      config.configured && config.permissionState !== "granted",
    lastError: config.lastError,
    lastSuccessfulWriteAt: config.lastSuccessfulWriteAt,
    lastFailedWriteAt: config.lastFailedWriteAt,
    consecutiveFailures: config.consecutiveFailures,
    lastWriteErrorMessage: config.lastWriteErrorMessage,
  };
}

export async function backupNow(): Promise<boolean> {
  const fileHandle = await readPrimaryBackupFileHandle();

  if (!fileHandle) {
    updateBackupStatus("error", "manual", "select backup location first");
    return false;
  }

  const backupPayload = await createBackup();
  const fileWritten = await writeBackupFileDocument(fileHandle, backupPayload, {
    appendHistory: true,
    historyReason: "manual",
    requestPermission: true,
  });

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
  const selected = await selectBackupLocation();

  if (!selected) {
    return false;
  }

  const fileWritten = await writeBackupToConfiguredFile(backup, {
    appendHistory: true,
    historyReason: "manual",
    requestPermission: true,
  });

  if (!fileWritten) {
    return false;
  }

  await appendBackupHistoryEntry(backup, "manual");
  updateBackupStatus("saved", "file-picker");
  return true;
}

export function downloadBackup(backup: BackupData): void {
  const dataString = JSON.stringify(backup, null, 2);
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
  await applyBackupPayload(backup, "restore");
}

function extractBackupPayload(
  parsedContent: unknown
): { payload: BackupData } | { error: string } {
  if (!isRecord(parsedContent)) {
    return { error: "invalid backup format" };
  }

  const maybeCurrent = parsedContent.current;
  const maybeSchemaVersion = parsedContent.schemaVersion;

  if (
    maybeSchemaVersion !== undefined &&
    maybeSchemaVersion !== BACKUP_SCHEMA_VERSION
  ) {
    return { error: "unsupported backup schema" };
  }

  if (isRecord(maybeCurrent)) {
    const maybeCurrentChecksum = parsedContent.currentChecksum;

    if (
      typeof maybeCurrentChecksum === "string" &&
      !hasValidChecksum(maybeCurrent, maybeCurrentChecksum)
    ) {
      return { error: "backup integrity check failed" };
    }

    return { payload: maybeCurrent };
  }

  const maybeChecksum = parsedContent.checksum;
  const {
    checksum: _unusedChecksum,
    schemaVersion: _unusedSchemaVersion,
    ...normalizedPayload
  } = parsedContent;

  if (
    typeof maybeChecksum === "string" &&
    !hasValidChecksum(normalizedPayload, maybeChecksum)
  ) {
    return { error: "backup integrity check failed" };
  }

  return { payload: normalizedPayload };
}

export function parseBackupFile(
  file: File,
  onSuccess: (backup: BackupData) => void
): void {
  const reader = new FileReader();

  reader.onload = (event) => {
    const rawContent = event.target?.result;

    if (typeof rawContent !== "string") {
      return;
    }

    const parsedContent = parseJSON<unknown>(rawContent);
    const backupPayloadResult = extractBackupPayload(parsedContent);

    if ("error" in backupPayloadResult) {
      updateBackupStatus("error", "restore", backupPayloadResult.error);
      return;
    }

    onSuccess(backupPayloadResult.payload);
  };

  reader.readAsText(file);
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
