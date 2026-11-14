import { storage } from "@wxt-dev/storage";
import {
  CHANGELOG_LAST_SEEN_VERSION_KEY,
  FEEDBACK_PROMPT_STATE_KEY,
  STORAGE_MIGRATION_KEY,
  USER_STORAGE_KEYS,
} from "@/lib/storage-keys";

export { storage } from "@wxt-dev/storage";

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
  remove(keys: string[] | string, callback?: () => void): void;
  set(items: Record<string, unknown>, callback?: () => void): void;
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

export const APP_VERSION = "2.1.0";

export interface StorageMigrationState {
  appVersion: string;
  completed: boolean;
  completedAt?: string;
  error?: string;
  lastAttemptAt: string;
  mirrorUntilVersion: string;
}

export interface FeedbackPromptState {
  cadence?: "new" | "regular";
  lastAction?: "dismissed" | "opened-feedback" | "opened-review";
  lastPromptedAt: string;
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

function isChromeStorageAvailable(): boolean {
  return Boolean(getChromeStorageAPI()?.local);
}

export function readChromeStorageRaw(key: string): Promise<string | null> {
  if (!isChromeStorageAvailable()) {
    return Promise.resolve(null);
  }

  return storage
    .getItem<unknown>(`local:${key}`)
    .then((value) => {
      if (typeof value === "string") {
        return value;
      }
      if (value !== null && value !== undefined) {
        return JSON.stringify(value);
      }
      return null;
    })
    .catch(() => null);
}

export function listChromeStorageKeys(): Promise<string[]> {
  if (!isChromeStorageAvailable()) {
    return Promise.resolve([]);
  }

  return storage
    .snapshot("local")
    .then((snapshot) => {
      return Object.keys(snapshot).filter((key) => !key.endsWith("$"));
    })
    .catch(() => []);
}

export function writeChromeStorageRaw(
  key: string,
  value: string
): Promise<void> {
  if (!isChromeStorageAvailable()) {
    return Promise.resolve();
  }

  const writePromise = storage.setItem(`local:${key}`, value).then(() => {
    dispatchAppStorageUpdated(key, value);
  });

  return trackPendingChromeWrite(writePromise);
}

export function removeChromeStorageKeys(keys: string[]): Promise<string[]> {
  const uniqueKeys = [...new Set(keys)];

  if (!(isChromeStorageAvailable() && uniqueKeys.length > 0)) {
    return Promise.resolve([]);
  }

  const removePromise = (async () => {
    try {
      const removedKeys: string[] = [];
      for (const key of uniqueKeys) {
        const item = await storage.getItem(`local:${key}`);
        if (item !== null && item !== undefined) {
          await storage.removeItem(`local:${key}`);
          dispatchAppStorageUpdated(key, null);
          removedKeys.push(key);
        }
      }
      return removedKeys;
    } catch {
      return [];
    }
  })();

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

function parseFeedbackPromptState(
  rawValue: string | null
): FeedbackPromptState | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!isRecord(parsedValue)) {
      return null;
    }

    const { lastPromptedAt, lastAction, cadence } = parsedValue;

    if (typeof lastPromptedAt !== "string") {
      return null;
    }

    if (
      lastAction !== undefined &&
      lastAction !== "dismissed" &&
      lastAction !== "opened-feedback" &&
      lastAction !== "opened-review"
    ) {
      return null;
    }

    if (cadence !== undefined && cadence !== "new" && cadence !== "regular") {
      return null;
    }

    return {
      cadence,
      lastPromptedAt,
      lastAction,
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
  const lastAttemptAt = new Date().toISOString();

  if (existingState?.completed) {
    return existingState;
  }

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

export async function readChangelogLastSeenVersion(): Promise<string | null> {
  const rawValue = await readAppStorageRaw(CHANGELOG_LAST_SEEN_VERSION_KEY);

  if (typeof rawValue !== "string") {
    return null;
  }

  const normalizedValue = rawValue.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

export async function persistChangelogLastSeenVersion(
  version: string
): Promise<void> {
  await writeAppStorageRaw(CHANGELOG_LAST_SEEN_VERSION_KEY, version);
}

export async function readFeedbackPromptState(): Promise<FeedbackPromptState | null> {
  const rawValue = await readAppStorageRaw(FEEDBACK_PROMPT_STATE_KEY);
  return parseFeedbackPromptState(rawValue);
}

export async function persistFeedbackPromptState(
  state: FeedbackPromptState
): Promise<void> {
  await writeAppStorageRaw(FEEDBACK_PROMPT_STATE_KEY, JSON.stringify(state));
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

export async function removeAppStorageKeys(keys: string[]): Promise<void> {
  const uniqueKeys = [...new Set(keys)];

  if (uniqueKeys.length === 0) {
    return;
  }

  removeLocalStorageKeys(uniqueKeys);
  await removeChromeStorageKeys(uniqueKeys).catch(() => null);
}
