import type { BrailleSpinnerName } from "unicode-animations";
import type { BackupStatus } from "@/lib/backup-utils";

export function formatBackupAge(updatedAt: string): string {
  if (!updatedAt) {
    return "never";
  }

  const parsedTime = Date.parse(updatedAt);
  if (Number.isNaN(parsedTime)) {
    return "unknown";
  }

  const diffMs = Date.now() - parsedTime;
  if (diffMs < 60_000) {
    return "now";
  }

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

export function getFooterBackupLabel(
  status: BackupStatus,
  isBackupLocationReady: boolean
): string {
  if (!isBackupLocationReady) {
    return "BLOCKED";
  }

  if (status.state === "saving") {
    return "SYNCING";
  }

  if (status.state === "error") {
    return "BLOCKED";
  }

  if (
    status.state === "saved" ||
    status.state === "auto-saved" ||
    status.state === "restored"
  ) {
    return "SUCCESS";
  }

  return "STANDBY";
}

export function formatHistoryAge(updatedAt: string): string {
  const backupAge = formatBackupAge(updatedAt);

  if (backupAge === "now") {
    return "just now";
  }

  if (backupAge === "unknown") {
    return "recent";
  }

  if (backupAge === "never") {
    return "unknown";
  }

  return `${backupAge} ago`;
}

export function getFooterLoaderName(
  state: BackupStatus["state"],
  isBackupLocationReady: boolean
): BrailleSpinnerName {
  if (!isBackupLocationReady || state === "error") {
    return "columns";
  }

  if (state === "saving") {
    return "checkerboard";
  }

  return "pulse";
}

export function getBackupStatusTone(
  state: BackupStatus["state"],
  isBackupLocationReady: boolean
): string {
  if (!isBackupLocationReady || state === "error") {
    return "text-destructive";
  }

  if (state === "saving") {
    return "text-amber-500";
  }

  if (state === "saved" || state === "auto-saved" || state === "restored") {
    return "text-emerald-500";
  }

  return "text-muted-foreground";
}

export function resolveFooterBackupState(
  status: BackupStatus,
  isBackupLocationReady: boolean
): BackupStatus["state"] {
  if (!isBackupLocationReady) {
    return "error";
  }

  return status.state;
}
