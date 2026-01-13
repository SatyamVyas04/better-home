import { readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));
const manifest = JSON.parse(readFileSync("./public/manifest.json", "utf-8"));

manifest.version = pkg.version;

writeFileSync(
  "./public/manifest.json",
  `${JSON.stringify(manifest, null, 2)}\n`
);

console.log(`[sync] Updated manifest.json to v${pkg.version}`);
