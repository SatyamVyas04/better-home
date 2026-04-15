import { useCallback, useEffect, useRef, useState } from "react";
import { queueAutosaveBackup } from "@/lib/backup-utils";
import {
  readAppStorageRaw,
  readLocalStorageRaw,
  subscribeToAppStorageChanges,
  subscribeToChromeStorageChanges,
  writeAppStorageRaw,
} from "@/lib/extension-storage";
import { captureUserIntentMutation } from "@/lib/session-history";

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const initialValueRef = useRef(initialValue);

  const parseStoredValue = useCallback((rawValue: string | null): T => {
    if (!rawValue) {
      return initialValueRef.current;
    }

    try {
      return JSON.parse(rawValue) as T;
    } catch {
      return initialValueRef.current;
    }
  }, []);

  const [storedValue, setStoredValue] = useState<T>(() => {
    const localStorageValue = readLocalStorageRaw(key);
    return parseStoredValue(localStorageValue);
  });
  const storedValueRef = useRef(storedValue);

  const updateStoredValue = useCallback((nextValue: T) => {
    storedValueRef.current = nextValue;
    setStoredValue(nextValue);
  }, []);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      const previousValue = storedValueRef.current;
      const valueToStore =
        typeof value === "function"
          ? (value as (prev: T) => T)(previousValue)
          : value;

      updateStoredValue(valueToStore);

      try {
        const serializedValue = JSON.stringify(valueToStore);
        writeAppStorageRaw(key, serializedValue).catch(() => null);
        captureUserIntentMutation(key, previousValue, valueToStore);
        queueAutosaveBackup();
      } catch {
        return;
      }
    },
    [key, updateStoredValue]
  );

  useEffect(() => {
    storedValueRef.current = storedValue;
  }, [storedValue]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== key) {
        return;
      }

      updateStoredValue(parseStoredValue(e.newValue));
    };

    const syncWithChromeStorage = async () => {
      const chromeStorageValue = await readAppStorageRaw(key);

      if (chromeStorageValue) {
        updateStoredValue(parseStoredValue(chromeStorageValue));
        return;
      }

      const localStorageValue = readLocalStorageRaw(key);
      if (localStorageValue) {
        writeAppStorageRaw(key, localStorageValue).catch(() => null);
      }
    };

    syncWithChromeStorage().catch(() => null);

    const unsubscribeFromChromeStorage = subscribeToChromeStorageChanges(
      (changes, areaName) => {
        if (areaName !== "local") {
          return;
        }

        const valueChange = changes[key];
        if (!valueChange) {
          return;
        }

        const nextRawValue =
          typeof valueChange.newValue === "string"
            ? valueChange.newValue
            : null;
        updateStoredValue(parseStoredValue(nextRawValue));
      }
    );

    const unsubscribeFromAppStorage = subscribeToAppStorageChanges(
      (changedKey, rawValue) => {
        if (changedKey !== key) {
          return;
        }

        updateStoredValue(parseStoredValue(rawValue));
      }
    );

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      unsubscribeFromChromeStorage();
      unsubscribeFromAppStorage();
    };
  }, [key, parseStoredValue, updateStoredValue]);

  return [storedValue, setValue];
}
