import { STORAGE_MIGRATION_KEY, USER_STORAGE_KEYS } from "@/lib/storage-keys";

interface ChromeStorageChange {
  newValue?: unknown;
  oldValue?: unknown;
}

type ChromeStorageChanges = Record<string, ChromeStorageChange>;
type ChromeStorageListener = (
  changes: ChromeStorageChanges,
  areaName: string
) => void;
type AppStorageListener = (key: string, value: string | null) => void;

const APP_STORAGE_UPDATED_EVENT = "better-home:storage-updated";
const pendingChromeWrites = new Set<Promise<unknown>>();

interface ChromeStorageArea {
  get(
    keys: string[] | string | Record<string, unknown> | null,
    callback: (items: Record<string, unknown>) => void
  ): void;
  set(items: Record<string, unknown>, callback?: () => void): void;
  remove(keys: string[] | string, callback?: () => void): void;
}

interface ChromeStorageAPI {
  local?: ChromeStorageArea;
  onChanged?: {
    addListener: (listener: ChromeStorageListener) => void;
    removeListener: (listener: ChromeStorageListener) => void;
  };
}

declare const chrome: {
  storage?: ChromeStorageAPI;
};

export const APP_VERSION = "1.8.0";

export interface StorageMigrationState {
  completed: boolean;
  appVersion: string;
  mirrorUntilVersion: string;
  lastAttemptAt: string;
  completedAt?: string;
  error?: string;
}

let cachedMigrationState: StorageMigrationState | null = null;

function getChromeStorageAPI(): ChromeStorageAPI | null {
  if (typeof chrome === "undefined") {
    return null;
  }

  return chrome.storage ?? null;
}

function trackPendingChromeWrite<T>(writePromise: Promise<T>): Promise<T> {
  pendingChromeWrites.add(writePromise);

  writePromise.finally(() => {
    pendingChromeWrites.delete(writePromise);
  });

  return writePromise;
}

function dispatchAppStorageUpdated(key: string, value: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(APP_STORAGE_UPDATED_EVENT, {
      detail: {
        key,
        value,
      },
    })
  );
}

function removeLocalStorageRaw(key: string): boolean {
  try {
    window.localStorage.removeItem(key);
    dispatchAppStorageUpdated(key, null);
    return true;
  } catch {
    return false;
  }
}

export function readLocalStorageRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function listLocalStorageKeys(): string[] {
  try {
    const keys: string[] = [];

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);

      if (key) {
        keys.push(key);
      }
    }

    return keys;
  } catch {
    return [];
  }
}

export function removeLocalStorageKeys(keys: string[]): string[] {
  const uniqueKeys = [...new Set(keys)];
  const removedKeys: string[] = [];

  for (const key of uniqueKeys) {
    const existingValue = readLocalStorageRaw(key);

    if (existingValue !== null && removeLocalStorageRaw(key)) {
      removedKeys.push(key);
    }
  }

  return removedKeys;
}

export function writeLocalStorageRaw(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
    dispatchAppStorageUpdated(key, value);
  } catch {
    return;
  }
}

export function writeMirrorStorageRaw(key: string, value: string): void {
  writeLocalStorageRaw(key, value);
  writeChromeStorageRaw(key, value).catch(() => null);
}

export function readChromeStorageRaw(key: string): Promise<string | null> {
  const chromeStorageArea = getChromeStorageAPI()?.local;
  if (!chromeStorageArea) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      chromeStorageArea.get([key], (items) => {
        const value = items[key];
        resolve(typeof value === "string" ? value : null);
      });
    } catch {
      resolve(null);
    }
  });
}

export function listChromeStorageKeys(): Promise<string[]> {
  const chromeStorageArea = getChromeStorageAPI()?.local;

  if (!chromeStorageArea) {
    return Promise.resolve([]);
  }

  return new Promise((resolve) => {
    try {
      chromeStorageArea.get(null, (items) => {
        resolve(Object.keys(items));
      });
    } catch {
      resolve([]);
    }
  });
}

export function writeChromeStorageRaw(
  key: string,
  value: string
): Promise<void> {
  const chromeStorageArea = getChromeStorageAPI()?.local;
  if (!chromeStorageArea) {
    return Promise.resolve();
  }

  const writePromise = new Promise<void>((resolve, reject) => {
    try {
      chromeStorageArea.set({ [key]: value }, () => {
        dispatchAppStorageUpdated(key, value);
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });

  return trackPendingChromeWrite(writePromise);
}

export function removeChromeStorageKeys(keys: string[]): Promise<string[]> {
  const chromeStorageArea = getChromeStorageAPI()?.local;
  const uniqueKeys = [...new Set(keys)];

  if (!(chromeStorageArea && uniqueKeys.length > 0)) {
    return Promise.resolve([]);
  }

  const removePromise = new Promise<string[]>((resolve) => {
    try {
      chromeStorageArea.get(uniqueKeys, (items) => {
        const existingKeys = uniqueKeys.filter((key) => {
          return Object.hasOwn(items, key);
        });

        if (existingKeys.length === 0) {
          resolve([]);
          return;
        }

        try {
          chromeStorageArea.remove(existingKeys, () => {
            for (const removedKey of existingKeys) {
              dispatchAppStorageUpdated(removedKey, null);
            }

            resolve(existingKeys);
          });
        } catch {
          resolve([]);
        }
      });
    } catch {
      resolve([]);
    }
  });

  return trackPendingChromeWrite(removePromise);
}

export async function waitForPendingStorageWrites(
  timeoutMs = 250
): Promise<void> {
  if (pendingChromeWrites.size === 0) {
    return;
  }

  const pendingWrites = Array.from(pendingChromeWrites);
  const settledPromise = Promise.allSettled(pendingWrites).then(() => null);

  if (timeoutMs <= 0) {
    await settledPromise;
    return;
  }

  await Promise.race([
    settledPromise,
    new Promise<null>((resolve) => {
      globalThis.setTimeout(() => {
        resolve(null);
      }, timeoutMs);
    }),
  ]);
}

export function subscribeToAppStorageChanges(
  listener: AppStorageListener
): () => void {
  if (typeof window === "undefined") {
    return () => null;
  }

  const handleStorageUpdated = (event: Event) => {
    const customEvent = event as CustomEvent<{
      key?: unknown;
      value?: unknown;
    }>;
    const key = customEvent.detail?.key;
    const value = customEvent.detail?.value;

    if (typeof key !== "string") {
      return;
    }

    listener(key, typeof value === "string" ? value : null);
  };

  window.addEventListener(APP_STORAGE_UPDATED_EVENT, handleStorageUpdated);

  return () => {
    window.removeEventListener(APP_STORAGE_UPDATED_EVENT, handleStorageUpdated);
  };
}

export function subscribeToChromeStorageChanges(
  listener: ChromeStorageListener
): () => void {
  const onChanged = getChromeStorageAPI()?.onChanged;
  if (!onChanged) {
    return () => null;
  }

  onChanged.addListener(listener);

  return () => {
    onChanged.removeListener(listener);
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseMigrationState(
  rawValue: string | null
): StorageMigrationState | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;
    if (!isRecord(parsedValue)) {
      return null;
    }

    const {
      completed,
      appVersion,
      mirrorUntilVersion,
      lastAttemptAt,
      completedAt,
      error,
    } = parsedValue;

    if (
      typeof completed !== "boolean" ||
      typeof appVersion !== "string" ||
      typeof mirrorUntilVersion !== "string" ||
      typeof lastAttemptAt !== "string"
    ) {
      return null;
    }

    return {
      completed,
      appVersion,
      mirrorUntilVersion,
      lastAttemptAt,
      completedAt: typeof completedAt === "string" ? completedAt : undefined,
      error: typeof error === "string" ? error : undefined,
    };
  } catch {
    return null;
  }
}

async function persistMigrationState(
  state: StorageMigrationState
): Promise<void> {
  cachedMigrationState = state;

  const serializedState = JSON.stringify(state);
  writeLocalStorageRaw(STORAGE_MIGRATION_KEY, serializedState);
  await writeChromeStorageRaw(STORAGE_MIGRATION_KEY, serializedState);
}

export async function readStorageMigrationState(): Promise<StorageMigrationState | null> {
  if (cachedMigrationState) {
    return cachedMigrationState;
  }

  const chromeState = parseMigrationState(
    await readChromeStorageRaw(STORAGE_MIGRATION_KEY)
  );

  if (chromeState) {
    cachedMigrationState = chromeState;
    return chromeState;
  }

  const localState = parseMigrationState(
    readLocalStorageRaw(STORAGE_MIGRATION_KEY)
  );

  if (localState) {
    cachedMigrationState = localState;
    writeChromeStorageRaw(
      STORAGE_MIGRATION_KEY,
      JSON.stringify(localState)
    ).catch(() => null);
    return localState;
  }

  return null;
}

export async function ensureStorageMigration(): Promise<StorageMigrationState> {
  const existingState = await readStorageMigrationState();

  if (existingState?.completed) {
    return existingState;
  }

  const lastAttemptAt = new Date().toISOString();

  try {
    for (const key of USER_STORAGE_KEYS) {
      const chromeValue = await readChromeStorageRaw(key);

      if (chromeValue !== null) {
        continue;
      }

      const localValue = readLocalStorageRaw(key);

      if (localValue !== null) {
        await writeChromeStorageRaw(key, localValue);
      }
    }

    const nextState: StorageMigrationState = {
      completed: true,
      appVersion: APP_VERSION,
      mirrorUntilVersion: existingState?.mirrorUntilVersion ?? APP_VERSION,
      lastAttemptAt,
      completedAt: new Date().toISOString(),
    };

    await persistMigrationState(nextState);
    return nextState;
  } catch (error) {
    const nextState: StorageMigrationState = {
      completed: false,
      appVersion: APP_VERSION,
      mirrorUntilVersion: existingState?.mirrorUntilVersion ?? APP_VERSION,
      lastAttemptAt,
      completedAt: existingState?.completedAt,
      error:
        error instanceof Error
          ? error.message
          : "Storage migration failed unexpectedly",
    };

    try {
      await persistMigrationState(nextState);
    } catch {
      cachedMigrationState = nextState;
    }

    return nextState;
  }
}

export async function readAppStorageRaw(key: string): Promise<string | null> {
  const localValue = readLocalStorageRaw(key);

  if (localValue !== null) {
    return localValue;
  }

  const chromeValue = await readChromeStorageRaw(key);

  if (chromeValue !== null) {
    writeLocalStorageRaw(key, chromeValue);
  }

  return chromeValue;
}

export async function writeAppStorageRaw(
  key: string,
  value: string
): Promise<void> {
  writeLocalStorageRaw(key, value);
  await writeChromeStorageRaw(key, value).catch(() => null);
}
