import { readAppStorageRaw, writeAppStorageRaw } from "@/lib/extension-storage";
import {
  AUTO_BACKUP_META_KEY,
  AUTO_BACKUPS_KEY,
  type AutoBackupEntry,
  type AutoBackupMeta,
  BACKUP_HISTORY_LIMIT,
  type BackupData,
  type BackupSource,
  createUniqueId,
  getSnapshotSignature,
} from "./internal-models";
import {
  mergeDuplicateAutoBackupEntries,
  parseAutoBackupEntries,
  parseAutoBackupMeta,
} from "./internal-parsers";

type UpdateBackupStatusFn = (
  state: "idle" | "saving" | "saved" | "restored" | "auto-saved" | "error",
  source: BackupSource,
  detail?: string
) => void;

function readStorageRawWithFallback(key: string): Promise<string | null> {
  return readAppStorageRaw(key);
}

export async function readAutoBackupEntries(): Promise<AutoBackupEntry[]> {
  return parseAutoBackupEntries(
    await readStorageRawWithFallback(AUTO_BACKUPS_KEY)
  );
}

export async function writeAutoBackupEntries(
  entries: AutoBackupEntry[]
): Promise<void> {
  await writeAppStorageRaw(AUTO_BACKUPS_KEY, JSON.stringify(entries));
}

export async function readAutoBackupMeta(): Promise<AutoBackupMeta> {
  return (
    parseAutoBackupMeta(
      await readStorageRawWithFallback(AUTO_BACKUP_META_KEY)
    ) ?? {}
  );
}

export async function writeAutoBackupMeta(meta: AutoBackupMeta): Promise<void> {
  await writeAppStorageRaw(AUTO_BACKUP_META_KEY, JSON.stringify(meta));
}

export async function appendBackupHistoryEntry(
  payload: BackupData,
  reason: AutoBackupEntry["reason"]
): Promise<void> {
  const signature = getSnapshotSignature(payload);
  const nextEntry: AutoBackupEntry = {
    id: createUniqueId("history"),
    createdAt: new Date().toISOString(),
    reason,
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

      return getSnapshotSignature(entry.payload, entry.checksum) === signature;
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

export async function applyBackupPayload(
  backup: BackupData,
  source: BackupSource,
  updateBackupStatus: UpdateBackupStatusFn
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
