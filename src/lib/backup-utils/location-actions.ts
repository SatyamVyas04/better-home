import { savePrimaryBackupFileHandle } from "@/lib/backup-file-handle-store";
import { readBackupFileConfig, writeBackupFileDocument } from "./internal-file";
import {
  type BackupData,
  type BackupFilePickerWindow,
  type BackupLocationStatus,
  type BackupSource,
  createBackupFileName,
} from "./internal-models";

type UpdateBackupStatusFn = (
  state: "idle" | "saving" | "saved" | "restored" | "auto-saved" | "error",
  source: BackupSource,
  detail?: string
) => void;

export async function selectBackupLocation(
  createBackup: () => Promise<BackupData>,
  updateBackupStatus: UpdateBackupStatusFn
): Promise<boolean> {
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

    const backupPayload = await createBackup();
    const fileWritten = await writeBackupFileDocument(
      fileHandle,
      backupPayload,
      {
        appendHistory: false,
        historyReason: "manual",
        requestPermission: true,
      },
      updateBackupStatus
    );

    if (!fileWritten) {
      return false;
    }

    updateBackupStatus("saved", "file-picker", "backup location ready");

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
