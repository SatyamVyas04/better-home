import type { BackupLocationStatus, BackupStatus } from "@/lib/backup-utils";

export const BACKUP_VISIBLE_STATUS_MIN_SAVING_MS = 700;
export const BACKUP_TIMELINE_QUERY_LIMIT = 12;
export const BACKUP_HISTORY_VISIBLE_LIMIT = 6;

export const DEFAULT_BACKUP_STATUS: BackupStatus = {
  state: "idle",
  updatedAt: "",
  source: "auto",
};

export const DEFAULT_BACKUP_LOCATION_STATUS: BackupLocationStatus = {
  configured: false,
  permissionState: "unconfigured",
  needsReauthorization: false,
  consecutiveFailures: 0,
};

export type BackupTabKey = "options" | "history";
