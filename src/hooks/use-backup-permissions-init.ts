import { useEffect } from "react";
import { readPrimaryBackupFileHandle } from "@/lib/backup-file-handle-store";
import {
  type PermissionCapableFileHandle,
  proactivelyRequestPermissionForSavedHandle,
} from "@/lib/backup-utils/internal-file";

/**
 * Hook that proactively requests file permissions on app initialization.
 * This ensures that any previously saved backup file handles have their
 * permissions refreshed, which provides better UX across Chromium browsers
 * especially Brave, where permission state might be "prompt" or "denied"
 * after browser restart.
 *
 * This runs once on app mount and attempts to restore permission state
 * without user interaction. If it fails, the user will still be able to
 * click "choose folder" again to grant permissions.
 */
export function useBackupPermissionsInit(): void {
  useEffect(() => {
    const initializeBackupPermissions = async () => {
      try {
        const fileHandle = await readPrimaryBackupFileHandle();

        if (!fileHandle) {
          // No saved file handle, nothing to do
          return;
        }

        // Attempt to proactively request permissions for the saved handle
        const result = await proactivelyRequestPermissionForSavedHandle(
          fileHandle as PermissionCapableFileHandle
        );

        // Log for debugging purposes (can be helpful when diagnosing browser-specific issues)
        if (!result.wasSuccessful) {
          console.debug(
            "[backup-init] Permission request for saved file handle was unsuccessful",
            {
              permissionState: result.permissionState,
              fileName: fileHandle.name,
            }
          );
        }
      } catch (error) {
        // Silently ignore errors during init - user can still manually set up backup
        console.debug(
          "[backup-init] Error initializing backup permissions",
          error
        );
      }
    };

    initializeBackupPermissions();
  }, []);
}
