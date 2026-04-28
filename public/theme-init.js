(() => {
  const STORAGE_KEY = "vite-ui-theme";
  const FONT_VAR = "--better-home-app-font";
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
  ];
  const FONT_FAMILY_VALUES = {
    DMMono: '"DMMono", monospace',
    ApercuMono: '"ApercuMono", monospace',
    GeistMono: '"GeistMono", monospace',
    IBMPlexMono: '"IBMPlexMono", monospace',
    Inconsolata: '"Inconsolata", monospace',
    JetBrainsMono: '"JetBrainsMono", monospace',
    RobotoMono: '"RobotoMono", monospace',
    SpaceMono: '"SpaceMono", monospace',
  };
  const DEFAULT_SETTINGS = {
    palette: "zinc",
    mode: "system",
    font: "DMMono",
  };

  const root = document.documentElement;
  const defaultThemeMeta = document.querySelector(
    'meta[name="better-home-default-theme"]'
  );
  const pageDefaultTheme =
    defaultThemeMeta && typeof defaultThemeMeta.content === "string"
      ? defaultThemeMeta.content
      : "system";

  function isRecord(value) {
    return typeof value === "object" && value !== null;
  }

  function isThemePalette(value) {
    return (
      value === "zinc" ||
      value === "neutral" ||
      value === "stone" ||
      value === "mauve" ||
      value === "olive" ||
      value === "mist" ||
      value === "taupe"
    );
  }

  function isThemeMode(value) {
    return value === "light" || value === "dark" || value === "system";
  }

  function isThemeFont(value) {
    return Object.hasOwn(FONT_FAMILY_VALUES, value);
  }

  function normalizeThemeSettings(value, fallback) {
    if (!isRecord(value)) {
      return fallback;
    }

    return {
      palette:
        typeof value.palette === "string" && isThemePalette(value.palette)
          ? value.palette
          : fallback.palette,
      mode:
        typeof value.mode === "string" && isThemeMode(value.mode)
          ? value.mode
          : fallback.mode,
      font:
        typeof value.font === "string" && isThemeFont(value.font)
          ? value.font
          : fallback.font,
    };
  }

  function parseThemeSettings(rawValue, fallback) {
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

  function resolveMode(mode, prefersDark) {
    if (mode === "system") {
      return prefersDark ? "dark" : "light";
    }

    return mode;
  }

  function getThemeClassName(palette, resolvedMode) {
    if (palette === "zinc") {
      return resolvedMode === "dark" ? "dark" : null;
    }

    return `${palette}-${resolvedMode}`;
  }

  function getBackgroundColor(_palette, _resolvedMode) {
    return "var(--background)";
  }

  let storedTheme = null;
  try {
    storedTheme = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    storedTheme = null;
  }

  const parsedDefaultTheme = parseThemeSettings(
    pageDefaultTheme,
    DEFAULT_SETTINGS
  );
  const themeSettings = parseThemeSettings(storedTheme, parsedDefaultTheme);
  const prefersDarkMode = window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches;
  const resolvedThemeMode = resolveMode(themeSettings.mode, prefersDarkMode);
  const themeClassName = getThemeClassName(
    themeSettings.palette,
    resolvedThemeMode
  );

  root.classList.remove(...THEME_CLASS_NAMES);

  if (themeClassName) {
    root.classList.add(themeClassName);
  }

  if (themeSettings.palette !== "zinc" && resolvedThemeMode === "dark") {
    root.classList.add("dark");
  }

  root.style.setProperty(FONT_VAR, FONT_FAMILY_VALUES[themeSettings.font]);
  root.style.backgroundColor = getBackgroundColor(
    themeSettings.palette,
    resolvedThemeMode
  );
  root.style.colorScheme = resolvedThemeMode;
})();
