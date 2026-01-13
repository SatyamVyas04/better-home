import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(
  (await import("node:fs")).readFileSync("./package.json", "utf-8")
);
const version = pkg.version;
const name = pkg.name;

const distDir = "dist";
const releaseDir = "release";

// Clean up old release artifacts
if (existsSync(releaseDir)) {
  rmSync(releaseDir, { recursive: true });
}
execSync(`mkdir ${releaseDir}`, { stdio: "inherit" });

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
const sevenZipFile = join(releaseDir, `${baseName}.7z`);

// Create ZIP (using PowerShell on Windows)
try {
  execSync(
    `powershell -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipFile}' -Force"`,
    { stdio: "inherit" }
  );
  console.log(`  -> Created ${zipFile}`);
} catch {
  console.error("[error] Failed to create ZIP archive");
}

// Create TAR.GZ (using tar if available)
try {
  execSync(`tar -czvf "${tarFile}" -C "${distDir}" .`, { stdio: "inherit" });
  console.log(`  -> Created ${tarFile}`);
} catch {
  console.error(
    "[warn] Failed to create TAR.GZ archive (tar may not be available)"
  );
}

// Create 7z (using 7z if available)
try {
  execSync(`7z a "${sevenZipFile}" "./${distDir}/*"`, { stdio: "inherit" });
  console.log(`  -> Created ${sevenZipFile}`);
} catch {
  console.error(
    "[warn] Failed to create 7z archive (7-Zip may not be installed)"
  );
}

console.log("[done] Release packaging complete!");
