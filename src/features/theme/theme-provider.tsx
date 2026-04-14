import { createContext, useContext, useEffect, useState } from "react";
import { readAppStorageRaw, writeAppStorageRaw } from "@/lib/extension-storage";
import {
  captureUserIntentMutation,
  runTrackedUserAction,
} from "@/lib/session-history";

declare const chrome: {
  tabs?: {
    query: (
      query: { active: boolean; currentWindow: boolean },
      callback: (tabs: Array<{ id?: number }>) => void
    ) => void;
    sendMessage: (
      tabId: number,
      message: { type: string; theme?: Theme }
    ) => void;
  };
};

type Theme = "dark" | "light" | "system";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);

  useEffect(() => {
    readAppStorageRaw(storageKey)
      .then((storedTheme) => {
        if (
          storedTheme === "light" ||
          storedTheme === "dark" ||
          storedTheme === "system"
        ) {
          setTheme(storedTheme);
          return;
        }

        setTheme(defaultTheme);
      })
      .catch(() => {
        setTheme(defaultTheme);
      });
  }, [defaultTheme, storageKey]);

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);

    chrome.tabs?.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId) {
        chrome.tabs?.sendMessage(tabId, {
          type: "THEME_CHANGED",
          theme,
        });
      }
    });
  }, [theme]);

  const value = {
    theme,
    setTheme: (nextTheme: Theme) => {
      runTrackedUserAction("change theme", () => {
        captureUserIntentMutation(storageKey, theme, nextTheme);
        writeAppStorageRaw(storageKey, nextTheme).catch(() => null);
        setTheme(nextTheme);
      });
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};
