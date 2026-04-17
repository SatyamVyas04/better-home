(() => {
  const STORAGE_KEY = "vite-ui-theme";
  const LIGHT_BG = "#ffffff";
  const DARK_BG = "oklch(0.141 0.005 285.823)";

  const root = document.documentElement;
  const defaultThemeMeta = document.querySelector(
    'meta[name="better-home-default-theme"]'
  );
  const pageDefaultTheme =
    defaultThemeMeta && typeof defaultThemeMeta.content === "string"
      ? defaultThemeMeta.content
      : "system";

  let storedTheme = null;
  try {
    storedTheme = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    storedTheme = null;
  }

  const normalizedTheme =
    storedTheme === "light" ||
    storedTheme === "dark" ||
    storedTheme === "system"
      ? storedTheme
      : pageDefaultTheme;

  const prefersDarkMode = window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches;
  let resolvedTheme = normalizedTheme;

  if (normalizedTheme === "system") {
    resolvedTheme = prefersDarkMode ? "dark" : "light";
  }

  root.classList.remove("light", "dark");
  root.classList.add(resolvedTheme);

  root.style.backgroundColor = resolvedTheme === "dark" ? DARK_BG : LIGHT_BG;
  root.style.colorScheme = resolvedTheme;
})();
