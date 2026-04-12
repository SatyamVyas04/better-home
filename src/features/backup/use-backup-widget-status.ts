import { useEffect, useRef, useState } from "react";
import type { BackupStatus } from "@/lib/backup-utils";

export function useVisibleBackupStatus(
  status: BackupStatus,
  minimumSavingMs: number
): BackupStatus {
  const [visibleStatus, setVisibleStatus] = useState(status);
  const savingStartedAtRef = useRef<number | null>(null);
  const pendingTransitionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (pendingTransitionTimerRef.current !== null) {
      window.clearTimeout(pendingTransitionTimerRef.current);
      pendingTransitionTimerRef.current = null;
    }

    setVisibleStatus((previousStatus) => {
      if (status.state === "saving") {
        savingStartedAtRef.current = Date.now();
        return status;
      }

      if (
        previousStatus.state === "saving" &&
        savingStartedAtRef.current !== null
      ) {
        const elapsedMs = Date.now() - savingStartedAtRef.current;

        if (elapsedMs < minimumSavingMs) {
          const remainingMs = minimumSavingMs - elapsedMs;
          pendingTransitionTimerRef.current = window.setTimeout(() => {
            setVisibleStatus(status);
            pendingTransitionTimerRef.current = null;
          }, remainingMs);
          return previousStatus;
        }
      }

      return status;
    });

    return () => {
      if (pendingTransitionTimerRef.current !== null) {
        window.clearTimeout(pendingTransitionTimerRef.current);
        pendingTransitionTimerRef.current = null;
      }
    };
  }, [minimumSavingMs, status]);

  return visibleStatus;
}
