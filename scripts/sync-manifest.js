import { readFileSync, writeFileSync } from "node:fs";

const POPUP_PATH = "./entrypoints/popup/index.html";
const EXTENSION_STORAGE_PATH = "./src/lib/extension-storage.ts";
const POPUP_VERSION_META_PATTERN =
  /<meta content="[^"]+" name="better-home-version">/;
const APP_VERSION_PATTERN = /export const APP_VERSION = "[^"]+";/;

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));
const popupHtml = readFileSync(POPUP_PATH, "utf-8");

const updates = [];

if (!POPUP_VERSION_META_PATTERN.test(popupHtml)) {
  throw new Error("Could not find better-home-version meta tag in popup.html");
}

const nextPopupHtml = popupHtml.replace(
  POPUP_VERSION_META_PATTERN,
  `<meta content="${pkg.version}" name="better-home-version">`
);

if (nextPopupHtml !== popupHtml) {
  writeFileSync(POPUP_PATH, nextPopupHtml);
  updates.push("popup.html");
}

const extensionStorage = readFileSync(EXTENSION_STORAGE_PATH, "utf-8");

if (!APP_VERSION_PATTERN.test(extensionStorage)) {
  throw new Error("Could not find APP_VERSION export in extension-storage.ts");
}

const nextExtensionStorage = extensionStorage.replace(
  APP_VERSION_PATTERN,
  `export const APP_VERSION = "${pkg.version}";`
);

if (nextExtensionStorage !== extensionStorage) {
  writeFileSync(EXTENSION_STORAGE_PATH, nextExtensionStorage);
  updates.push("APP_VERSION");
}

if (updates.length === 0) {
  console.log(`[sync] Version files already at v${pkg.version}`);
} else {
  console.log(`[sync] Updated ${updates.join(" and ")} to v${pkg.version}`);
}
