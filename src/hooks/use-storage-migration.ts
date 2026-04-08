import { useCallback, useEffect, useState } from "react";
import {
  ensureStorageMigration,
  type StorageMigrationState,
} from "@/lib/extension-storage";

type MigrationViewState = "checking" | "ready" | "error";

interface MigrationStatus {
  state: MigrationViewState;
  message: string;
  details?: string;
  migration?: StorageMigrationState;
}

const CHECKING_STATUS: MigrationStatus = {
  state: "checking",
  message: "syncing storage",
};

export function useStorageMigration() {
  const [status, setStatus] = useState<MigrationStatus>(CHECKING_STATUS);

  const runMigration = useCallback(async () => {
    setStatus(CHECKING_STATUS);

    const migrationState = await ensureStorageMigration();

    if (migrationState.completed) {
      setStatus({
        state: "ready",
        message: "storage synced",
        migration: migrationState,
      });
      return;
    }

    setStatus({
      state: "error",
      message: "storage sync needs retry",
      details: migrationState.error,
      migration: migrationState,
    });
  }, []);

  useEffect(() => {
    runMigration().catch(() => {
      setStatus({
        state: "error",
        message: "storage sync failed",
      });
    });
  }, [runMigration]);

  return {
    status,
    retryMigration: runMigration,
  };
}
