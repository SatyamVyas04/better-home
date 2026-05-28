import { PREVIEW_EXISTING_LINKS_HYDRATION_MARKER_KEY } from "@/constants/quick-links";
import {
  listChromeStorageKeys,
  listLocalStorageKeys,
  removeChromeStorageKeys,
  removeLocalStorageKeys,
  waitForPendingStorageWrites,
} from "@/lib/extension-storage";
import { resetLinkPreviewImageRuntimeCache } from "@/lib/link-preview";
import {
  CLEARABLE_CACHE_STORAGE_KEYS,
  KNOWN_APP_STORAGE_KEYS,
  STORAGE_KEY_PREFIXES,
} from "@/lib/storage-keys";

const MAINTENANCE_WRITE_DRAIN_TIMEOUT_MS = 500;

export interface StorageCleanupResult {
  preservedKnownKeyCount: number;
  removedCacheKeys: string[];
  removedKeyCount: number;
  removedKeys: string[];
  removedLegacyKeys: string[];
}

function hasManagedPrefix(key: string): boolean {
  return STORAGE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((firstValue, secondValue) =>
    firstValue.localeCompare(secondValue)
  );
}

export async function clearNonUsefulStorageData(): Promise<StorageCleanupResult> {
  const knownAppStorageKeySet = new Set<string>(KNOWN_APP_STORAGE_KEYS);
  const clearableCacheKeySet = new Set<string>([
    ...CLEARABLE_CACHE_STORAGE_KEYS,
    PREVIEW_EXISTING_LINKS_HYDRATION_MARKER_KEY,
  ]);

  await waitForPendingStorageWrites(MAINTENANCE_WRITE_DRAIN_TIMEOUT_MS);

  const localKeysBefore = listLocalStorageKeys();
  const chromeKeysBefore = await listChromeStorageKeys();
  const presentKnownKeys = uniqueSorted(
    [...localKeysBefore, ...chromeKeysBefore].filter((key) =>
      knownAppStorageKeySet.has(key)
    )
  );

  const clearableLocalKeys = localKeysBefore.filter((key) =>
    clearableCacheKeySet.has(key)
  );
  const clearableChromeKeys = chromeKeysBefore.filter((key) =>
    clearableCacheKeySet.has(key)
  );

  const sweepableLegacyLocalKeys = localKeysBefore.filter(
    (key) =>
      hasManagedPrefix(key) &&
      !knownAppStorageKeySet.has(key) &&
      !clearableCacheKeySet.has(key)
  );
  const sweepableLegacyChromeKeys = chromeKeysBefore.filter(
    (key) =>
      hasManagedPrefix(key) &&
      !knownAppStorageKeySet.has(key) &&
      !clearableCacheKeySet.has(key)
  );

  const removedLocalCacheKeys = removeLocalStorageKeys(clearableLocalKeys);
  const removedChromeCacheKeys =
    await removeChromeStorageKeys(clearableChromeKeys);
  const removedLocalLegacyKeys = removeLocalStorageKeys(
    sweepableLegacyLocalKeys
  );
  const removedChromeLegacyKeys = await removeChromeStorageKeys(
    sweepableLegacyChromeKeys
  );

  resetLinkPreviewImageRuntimeCache();
  await waitForPendingStorageWrites(MAINTENANCE_WRITE_DRAIN_TIMEOUT_MS);

  const removedCacheKeys = uniqueSorted([
    ...removedLocalCacheKeys,
    ...removedChromeCacheKeys,
  ]);
  const removedLegacyKeys = uniqueSorted([
    ...removedLocalLegacyKeys,
    ...removedChromeLegacyKeys,
  ]);
  const removedKeys = uniqueSorted([...removedCacheKeys, ...removedLegacyKeys]);

  return {
    removedKeyCount: removedKeys.length,
    removedKeys,
    removedCacheKeys,
    removedLegacyKeys,
    preservedKnownKeyCount: presentKnownKeys.length,
  };
}
