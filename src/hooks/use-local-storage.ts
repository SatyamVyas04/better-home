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

  const [initialSnapshot] = useState(() => {
    const rawValue = readLocalStorageRaw(key);
    return {
      parsedValue: parseStoredValue(rawValue),
      rawValue,
    };
  });

  const [storedValue, setStoredValue] = useState<T>(
    initialSnapshot.parsedValue
  );
  const storedValueRef = useRef(storedValue);

  const currentRawValueRef = useRef<string | null>(initialSnapshot.rawValue);

  const updateStoredValue = useCallback((nextValue: T) => {
    storedValueRef.current = nextValue;
    setStoredValue(nextValue);
  }, []);

  const applyExternalRawValue = useCallback(
    (rawValue: string | null) => {
      if (rawValue === currentRawValueRef.current) {
        return;
      }

      currentRawValueRef.current = rawValue;
      updateStoredValue(parseStoredValue(rawValue));
    },
    [parseStoredValue, updateStoredValue]
  );

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      const previousValue = storedValueRef.current;
      const valueToStore =
        typeof value === "function"
          ? (value as (prev: T) => T)(previousValue)
          : value;

      let serializedValue: string;
      try {
        serializedValue = JSON.stringify(valueToStore);
      } catch {
        return;
      }

      if (serializedValue === currentRawValueRef.current) {
        if (!Object.is(storedValueRef.current, valueToStore)) {
          updateStoredValue(valueToStore);
        }
        return;
      }

      currentRawValueRef.current = serializedValue;
      updateStoredValue(valueToStore);

      writeAppStorageRaw(key, serializedValue).catch(() => null);
      captureUserIntentMutation(key, previousValue, valueToStore);
      queueAutosaveBackup();
    },
    [key, updateStoredValue]
  );

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== key) {
        return;
      }

      applyExternalRawValue(e.newValue);
    };

    const syncWithChromeStorage = async () => {
      const chromeStorageValue = await readAppStorageRaw(key);

      if (chromeStorageValue) {
        applyExternalRawValue(chromeStorageValue);
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
        applyExternalRawValue(nextRawValue);
      }
    );

    const unsubscribeFromAppStorage = subscribeToAppStorageChanges(
      (changedKey, rawValue) => {
        if (changedKey !== key) {
          return;
        }

        applyExternalRawValue(rawValue);
      }
    );

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      unsubscribeFromChromeStorage();
      unsubscribeFromAppStorage();
    };
  }, [applyExternalRawValue, key]);

  return [storedValue, setValue];
}
