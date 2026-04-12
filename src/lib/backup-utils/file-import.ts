import { savePrimaryBackupFileHandle } from "@/lib/backup-file-handle-store";
import {
  ensureReadWritePermission,
  readBackupFileConfig,
  writeBackupFileConfig,
} from "./internal-file";
import {
  BACKUP_SCHEMA_VERSION,
  type BackupData,
  type BackupFilePickerWindow,
  type BackupSource,
  hasValidChecksum,
  isRecord,
  parseJSON,
} from "./internal-models";

type UpdateBackupStatusFn = (
  state: "idle" | "saving" | "saved" | "restored" | "auto-saved" | "error",
  source: BackupSource,
  detail?: string
) => void;

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

function parseBackupPayloadFromRawContent(
  rawContent: string
): { payload: BackupData } | { error: string } {
  const parsedContent = parseJSON<unknown>(rawContent);
  return extractBackupPayload(parsedContent);
}

export async function loadBackupFromFilePicker(
  updateBackupStatus: UpdateBackupStatusFn
): Promise<BackupData | null> {
  const runtimeWindow = window as BackupFilePickerWindow;

  if (!runtimeWindow.showOpenFilePicker) {
    return null;
  }

  try {
    const [fileHandle] = await runtimeWindow.showOpenFilePicker({
      multiple: false,
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

    if (!fileHandle) {
      return null;
    }

    const file = await fileHandle.getFile();
    const rawContent = await file.text();
    const backupPayloadResult = parseBackupPayloadFromRawContent(rawContent);

    if ("error" in backupPayloadResult) {
      updateBackupStatus("error", "restore", backupPayloadResult.error);
      return null;
    }

    await savePrimaryBackupFileHandle(fileHandle);

    const permissionState = await ensureReadWritePermission(fileHandle, true);
    const needsReauthorization = permissionState !== "granted";
    const existingConfig = await readBackupFileConfig();
    const updateTime = new Date().toISOString();

    await writeBackupFileConfig({
      configured: true,
      updatedAt: updateTime,
      fileName: fileHandle.name,
      permissionState,
      lastError: needsReauthorization
        ? "Backup file permission is not granted"
        : undefined,
      lastSuccessfulWriteAt: existingConfig.lastSuccessfulWriteAt,
      lastFailedWriteAt: needsReauthorization
        ? updateTime
        : existingConfig.lastFailedWriteAt,
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

    return backupPayloadResult.payload;
  } catch {
    return null;
  }
}

export function parseBackupFile(
  file: File,
  onSuccess: (backup: BackupData) => void,
  updateBackupStatus: UpdateBackupStatusFn
): void {
  const reader = new FileReader();

  reader.onload = (event) => {
    const rawContent = event.target?.result;

    if (typeof rawContent !== "string") {
      return;
    }

    const backupPayloadResult = parseBackupPayloadFromRawContent(rawContent);

    if ("error" in backupPayloadResult) {
      updateBackupStatus("error", "restore", backupPayloadResult.error);
      return;
    }

    onSuccess(backupPayloadResult.payload);
  };

  reader.readAsText(file);
}
