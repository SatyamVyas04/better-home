import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { readAppStorageRaw } from "@/lib/extension-storage";

export const THEME_PALETTES = [
  "zinc",
  "neutral",
  "stone",
  "mauve",
  "olive",
  "mist",
  "taupe",
] as const;
export const THEME_MODES = ["light", "dark", "system"] as const;
export const THEME_FONTS = [
  "DMMono",
  "ApercuMono",
  "GeistMono",
  "IBMPlexMono",
  "Inconsolata",
  "JetBrainsMono",
  "RobotoMono",
  "SpaceMono",
] as const;

export type ThemePalette = (typeof THEME_PALETTES)[number];
export type ThemeMode = (typeof THEME_MODES)[number];
export type ThemeFont = (typeof THEME_FONTS)[number];

export interface ThemeSettings {
  palette: ThemePalette;
  mode: ThemeMode;
  font: ThemeFont;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
  defaultPalette?: ThemePalette;
  defaultFont?: ThemeFont;
  storageKey?: string;
}

interface ThemeProviderState {
  settings: ThemeSettings;
  resolvedMode: Exclude<ThemeMode, "system">;
  themeClassName: string | null;
  setThemePalette: (palette: ThemePalette) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setThemeFont: (font: ThemeFont) => void;
}

const THEME_CLASS_NAMES = [
  "dark",
  "neutral-light",
  "neutral-dark",
  "stone-light",
  "stone-dark",
  "mauve-light",
  "mauve-dark",
  "olive-light",
  "olive-dark",
  "mist-light",
  "mist-dark",
  "taupe-light",
  "taupe-dark",
] as const;

const FONT_FAMILY_VALUES: Record<ThemeFont, string> = {
  DMMono: '"DMMono", monospace',
  ApercuMono: '"ApercuMono", monospace',
  GeistMono: '"GeistMono", monospace',
  IBMPlexMono: '"IBMPlexMono", monospace',
  Inconsolata: '"Inconsolata", monospace',
  JetBrainsMono: '"JetBrainsMono", monospace',
  RobotoMono: '"RobotoMono", monospace',
  SpaceMono: '"SpaceMono", monospace',
};

const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  palette: "zinc",
  mode: "system",
  font: "DMMono",
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isThemePalette(value: string): value is ThemePalette {
  return THEME_PALETTES.includes(value as ThemePalette);
}

function isThemeMode(value: string): value is ThemeMode {
  return THEME_MODES.includes(value as ThemeMode);
}

function isThemeFont(value: string): value is ThemeFont {
  return THEME_FONTS.includes(value as ThemeFont);
}

function normalizeThemeSettings(
  value: unknown,
  fallback: ThemeSettings = DEFAULT_THEME_SETTINGS
): ThemeSettings {
  if (!isRecord(value)) {
    return fallback;
  }

  const palette =
    typeof value.palette === "string" && isThemePalette(value.palette)
      ? value.palette
      : fallback.palette;
  const mode =
    typeof value.mode === "string" && isThemeMode(value.mode)
      ? value.mode
      : fallback.mode;
  const font =
    typeof value.font === "string" && isThemeFont(value.font)
      ? value.font
      : fallback.font;

  return { palette, mode, font };
}

function parseThemeSettings(
  rawValue: string | null,
  fallback: ThemeSettings = DEFAULT_THEME_SETTINGS
): ThemeSettings {
  if (rawValue === null) {
    return fallback;
  }

  try {
    return normalizeThemeSettings(JSON.parse(rawValue), fallback);
  } catch {
    if (isThemeMode(rawValue)) {
      return { ...fallback, mode: rawValue };
    }

    const [palette, mode] = rawValue.split("-");

    if (isThemePalette(palette) && isThemeMode(mode)) {
      return { ...fallback, palette, mode };
    }

    return fallback;
  }
}

function getSystemMode(): Exclude<ThemeMode, "system"> {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveMode(
  mode: ThemeMode,
  prefersDark: boolean
): Exclude<ThemeMode, "system"> {
  if (mode === "system") {
    return prefersDark ? "dark" : "light";
  }

  return mode;
}

function getThemeClassName(
  palette: ThemePalette,
  resolvedMode: Exclude<ThemeMode, "system">
): string | null {
  if (palette === "zinc") {
    return resolvedMode === "dark" ? "dark" : null;
  }

  return `${palette}-${resolvedMode}`;
}

function getBackgroundColor(
  _palette: ThemePalette,
  _resolvedMode: Exclude<ThemeMode, "system">
): string {
  return "var(--background)";
}

function applyThemeToRoot(settings: ThemeSettings, prefersDark: boolean): void {
  const root = window.document.documentElement;
  const resolvedMode = resolveMode(settings.mode, prefersDark);
  const themeClassName = getThemeClassName(settings.palette, resolvedMode);

  root.classList.remove(...THEME_CLASS_NAMES);

  if (themeClassName) {
    root.classList.add(themeClassName);
  }

  if (settings.palette !== "zinc" && resolvedMode === "dark") {
    root.classList.add("dark");
  }

  root.style.setProperty(
    "--better-home-app-font",
    FONT_FAMILY_VALUES[settings.font]
  );
  root.style.backgroundColor = getBackgroundColor(
    settings.palette,
    resolvedMode
  );
  root.style.colorScheme = resolvedMode;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  defaultPalette = "zinc",
  defaultFont = "DMMono",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const defaultSettings = useMemo<ThemeSettings>(() => {
    return {
      palette: defaultPalette,
      mode: defaultTheme,
      font: defaultFont,
    };
  }, [defaultFont, defaultPalette, defaultTheme]);

  const [settings, setSettings] = useLocalStorage<ThemeSettings>(
    storageKey,
    defaultSettings
  );
  const [prefersDark, setPrefersDark] = useState<boolean>(() => {
    return getSystemMode() === "dark";
  });

  useEffect(() => {
    readAppStorageRaw(storageKey)
      .then((rawValue) => {
        const nextSettings = parseThemeSettings(rawValue, defaultSettings);

        setSettings((previousSettings) => {
          if (
            previousSettings.palette === nextSettings.palette &&
            previousSettings.mode === nextSettings.mode &&
            previousSettings.font === nextSettings.font
          ) {
            return previousSettings;
          }

          return nextSettings;
        });
      })
      .catch(() => null);
  }, [defaultSettings, setSettings, storageKey]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const updatePrefersDark = () => {
      setPrefersDark(mediaQuery.matches);
    };

    updatePrefersDark();
    mediaQuery.addEventListener("change", updatePrefersDark);

    return () => {
      mediaQuery.removeEventListener("change", updatePrefersDark);
    };
  }, []);

  useEffect(() => {
    applyThemeToRoot(settings, prefersDark);
  }, [prefersDark, settings]);

  const value = useMemo<ThemeProviderState>(() => {
    const resolvedMode = resolveMode(settings.mode, prefersDark);

    return {
      settings,
      resolvedMode,
      themeClassName: getThemeClassName(settings.palette, resolvedMode),
      setThemePalette: (palette: ThemePalette) => {
        setSettings((previousSettings) => {
          return { ...previousSettings, palette };
        });
      },
      setThemeMode: (mode: ThemeMode) => {
        setSettings((previousSettings) => {
          return { ...previousSettings, mode };
        });
      },
      setThemeFont: (font: ThemeFont) => {
        setSettings((previousSettings) => {
          return { ...previousSettings, font };
        });
      },
    };
  }, [prefersDark, setSettings, settings]);

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};
