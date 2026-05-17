import { savePrimaryBackupFileHandle } from "@/lib/backup-file-handle-store";
import {
  readBackupFileConfig,
  requestPermissionImmediately,
  writeBackupFileDocument,
} from "./internal-file";
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
    updateBackupStatus(
      "error",
      "file-picker",
      "File System Access is not available here. Use Save now, or enable Brave's File System Access API flag at brave://flags/#file-system-access-api."
    );
    return false;
  }

  try {
    let fileHandle: FileSystemFileHandle;

    try {
      fileHandle = await runtimeWindow.showSaveFilePicker({
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
    } catch (error) {
      updateBackupStatus(
        "error",
        "file-picker",
        `Brave blocked the folder picker. Enable File System Access API at brave://flags/#file-system-access-api, or use Save now to download a backup manually.${error instanceof Error ? ` (${error.message})` : ""}`
      );
      return false;
    }

    let permissionState: Awaited<
      ReturnType<typeof requestPermissionImmediately>
    >;

    try {
      permissionState = await requestPermissionImmediately(fileHandle);
    } catch (error) {
      updateBackupStatus(
        "error",
        "file-picker",
        `Folder selected, but Brave refused write access. Enable File System Access API at brave://flags/#file-system-access-api, or use Save now to download a backup manually.${error instanceof Error ? ` (${error.message})` : ""}`
      );
      return false;
    }

    if (permissionState !== "granted") {
      updateBackupStatus(
        "error",
        "file-picker",
        `Brave did not grant file editing permission (${permissionState}). Enable File System Access API at brave://flags/#file-system-access-api, or use Save now to download a backup manually.`
      );
      return false;
    }

    await savePrimaryBackupFileHandle(fileHandle);

    const backupPayload = await createBackup();
    const fileWritten = await writeBackupFileDocument(
      fileHandle,
      backupPayload,
      {
        appendHistory: false,
        historyReason: "manual",
        requestPermission: false,
      },
      updateBackupStatus
    );

    if (!fileWritten) {
      updateBackupStatus(
        "error",
        "file-picker",
        "The folder was selected, but the browser still refused to save there. Use Save now to download a backup manually."
      );
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
