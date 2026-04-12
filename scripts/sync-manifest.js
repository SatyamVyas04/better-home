import { readFileSync, writeFileSync } from "node:fs";

const MANIFEST_PATH = "./public/manifest.json";
const EXTENSION_STORAGE_PATH = "./src/lib/extension-storage.ts";
const APP_VERSION_PATTERN = /export const APP_VERSION = "[^"]+";/;

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));

const updates = [];

if (manifest.version !== pkg.version) {
  manifest.version = pkg.version;
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  updates.push("manifest.json");
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
