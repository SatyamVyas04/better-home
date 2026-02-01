const STORAGE_KEYS = [
  "better-home-widget-settings",
  "better-home-todos",
  "better-home-todo-sort",
  "better-home-todo-filters",
  "better-home-quick-links",
  "mood-calendar-2026-data",
  "mood-calendar-show-numbers",
  "vite-ui-theme",
] as const;

interface BackupData {
  [key: string]: unknown;
}

export function createBackup(): BackupData {
  const backup: BackupData = {};

  for (const key of STORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (value) {
      try {
        backup[key] = JSON.parse(value);
      } catch {
        backup[key] = value;
      }
    }
  }

  return backup;
}

export function downloadBackup(backup: BackupData): void {
  const dataStr = JSON.stringify(backup, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `better-home-backup-${new Date().toISOString().split("T")[0]}.json`;
  link.style.display = "none";

  const container = document.body || document.documentElement;
  container.appendChild(link);
  link.click();
  container.removeChild(link);
  URL.revokeObjectURL(url);
}

export function restoreBackup(backup: BackupData): void {
  for (const key of Object.keys(backup)) {
    const value = backup[key];

    if (typeof value === "string" && key === "vite-ui-theme") {
      localStorage.setItem(key, value);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }
}

export function parseBackupFile(
  file: File,
  onSuccess: (backup: BackupData) => void
): void {
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const backup = JSON.parse(e.target?.result as string) as BackupData;
      onSuccess(backup);
    } catch {
      // Silently fail on invalid JSON
    }
  };

  reader.readAsText(file);
}
