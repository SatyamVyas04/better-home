import { execSync } from "node:child_process";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import archiver from "archiver";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));
const version = pkg.version;
const name = pkg.name;

const distDir = "dist";
const releaseDir = "release";

// Clean up old release artifacts
if (existsSync(releaseDir)) {
  rmSync(releaseDir, { recursive: true });
}
mkdirSync(releaseDir, { recursive: true });

// Build the project
console.log("[build] Building project...");
execSync("bun run build", { stdio: "inherit" });

if (!existsSync(distDir)) {
  console.error("[error] Build failed: dist folder not found");
  process.exit(1);
}

console.log("[package] Creating archives...");

const baseName = `${name}-v${version}`;
const zipFile = join(releaseDir, `${baseName}.zip`);
const tarFile = join(releaseDir, `${baseName}.tar.gz`);

function createArchive(outputPath, format, options = {}) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver(format, options);

    output.on("close", () => resolve(archive.pointer()));
    archive.on("error", (err) => reject(err));

    archive.pipe(output);
    archive.directory(distDir, false);
    archive.finalize();
  });
}

// Create ZIP
try {
  const bytes = await createArchive(zipFile, "zip", { zlib: { level: 9 } });
  console.log(`  -> Created ${zipFile} (${(bytes / 1024).toFixed(1)} KB)`);
} catch (err) {
  console.error("[error] Failed to create ZIP archive:", err.message);
}

// Create TAR.GZ
try {
  const bytes = await createArchive(tarFile, "tar", {
    gzip: true,
    gzipOptions: { level: 9 },
  });
  console.log(`  -> Created ${tarFile} (${(bytes / 1024).toFixed(1)} KB)`);
} catch (err) {
  console.error("[error] Failed to create TAR.GZ archive:", err.message);
}

console.log("[done] Release packaging complete!");
