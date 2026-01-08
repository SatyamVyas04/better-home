<div align="center">

# better-home

[![Version](https://img.shields.io/badge/version-1.0.0-blue?style=flat-square)](https://github.com/SatyamVyas04/better-home/releases)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev)
[![Bun](https://img.shields.io/badge/Bun-Package%20Manager-FBF0DF?style=flat-square&logo=bun&logoColor=black)](https://bun.sh)

**A minimal, delightful new-tab replacement for Chrome/Edge.  
Tasks · Quick Links · Mood Calendar - everything you need, nothing you don't.**

</div>

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
  - [Prerequisites](#prerequisites)
  - [From Source](#from-source-development)
  - [Development Mode](#development-mode)
- [Troubleshooting](#troubleshooting)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)
- [License](#license)
- [Author](#author)

---

## Features

| Widget | Description |
|--------|-------------|
| **Tasks** | A lightweight to-do list that remembers your items across sessions. Add, check-off, and delete tasks in a snap. |
| **Quick Links** | One-click bookmarks with auto-fetched favicons. Save your most-visited sites and jump to them instantly. |
| **Mood Calendar** | Track how you feel every day of 2026 with a beautiful, color-coded calendar. Supports quadrimester and full-year views with smooth Motion animations, optional day-number toggle, and inline notes. |
| **Dark / Light Mode** | Toggle themes to match your vibe or system preference. |
| **Responsive Layout** | Works seamlessly from ultrawide monitors to small laptops. |
| **Customizable** | Enable or disable any widget via the extension popup - make it *your* home. |
| **Backup & Restore** | Download your data as JSON to backup or transfer to another browser. Upload to restore your tasks, links, calendar entries, and settings. |

---

## Installation

### Prerequisites

This project uses **[Bun](https://bun.sh)** as the package manager. If you don't have it installed:

**macOS / Linux / WSL:**
```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows (PowerShell):**
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

**Or via npm (if you have Node.js):**
```bash
npm install -g bun
```

> [!TIP]
> After installation, restart your terminal and verify with `bun --version`.

### From Source (Development)

```bash
# Clone the repository
git clone https://github.com/SatyamVyas04/better-home.git
cd better-home

# Install dependencies
bun install

# Build the extension
bun run build
```

> [!NOTE]
> The production build outputs to the `dist/` folder.

**Load into Chrome/Edge:**

1. Navigate to `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `dist` folder
5. Open a **new tab** - welcome home!

### Development Mode

Spin up a local dev server with hot reload:

```bash
bun run dev
```

> [!WARNING]
> Hot reload works in the browser preview (`localhost:5173`), but to test the full extension experience you must rebuild and reload the extension after code changes.

---

## Troubleshooting

Below are common issues you might encounter while developing with **Vite + React + TypeScript** - and how to fix them.

<details>
<summary><strong>"Cannot find module" or path alias errors</strong></summary>

This usually means `@/` path aliases aren't resolving correctly.

**Fix:**
1. Ensure `vite.config.ts` contains the alias:
   ```ts
   resolve: {
     alias: {
       "@": path.resolve(__dirname, "./src"),
     },
   },
   ```
2. Confirm `tsconfig.json` mirrors the alias:
   ```json
   "paths": {
     "@/*": ["./src/*"]
   }
   ```
3. Restart the dev server.

</details>

<details>
<summary><strong>TypeScript build errors (tsc)</strong></summary>

If `bun run build` fails with type errors:

```bash
# Run type-check only to see all issues
bunx tsc --noEmit
```

- Check for missing types - install `@types/...` packages as needed.
- Ensure `strict` mode settings in `tsconfig.json` match your code expectations.

</details>

<details>
<summary><strong>Vite HMR not working / stale cache</strong></summary>

Try clearing the cache and restarting:

```bash
rm -rf node_modules/.vite
bun run dev
```

If issues persist, delete `node_modules` entirely and reinstall:

```bash
rm -rf node_modules bun.lockb
bun install
```

</details>

<details>
<summary><strong>Motion / Framer-motion import errors</strong></summary>

This project uses `motion` (v11). If you see bundler errors about missing exports:

```bash
# Remove conflicting packages and reinstall motion
bun remove framer-motion
bun add motion@11
```

Then verify imports use:
```ts
import { motion, AnimatePresence } from "motion/react";
```

</details>

<details>
<summary><strong>Extension not updating after changes</strong></summary>

Chrome aggressively caches unpacked extensions.

**Steps:**
1. Go to `chrome://extensions`
2. Click the **refresh** icon on the better-home card
3. Open a fresh new tab

> [!TIP]
> During active development, keep DevTools open on the new-tab page - it sometimes forces a reload.

</details>

<details>
<summary><strong>Bun command not found after installation</strong></summary>

Your shell may not have reloaded the PATH.

**Fix:**
1. Close and reopen your terminal completely.
2. If still not working, manually add Bun to your PATH:
   - **macOS/Linux:** Add `export BUN_INSTALL="$HOME/.bun"` and `export PATH="$BUN_INSTALL/bin:$PATH"` to your `~/.bashrc` or `~/.zshrc`.
   - **Windows:** Ensure `%USERPROFILE%\.bun\bin` is in your system PATH.
3. Verify with `bun --version`.

</details>

<details>
<summary><strong>Port 5173 already in use</strong></summary>

Another process is using the default Vite port.

**Fix:**
```bash
# Find and kill the process (Linux/macOS)
lsof -ti:5173 | xargs kill -9

# Or run Vite on a different port
bun run dev -- --port 3000
```

</details>

<details>
<summary><strong>New tab shows blank page or old content</strong></summary>

This can happen when the extension files are outdated or corrupted.

**Fix:**
1. Rebuild the project: `bun run build`
2. Go to `chrome://extensions`
3. Remove the existing better-home extension
4. Re-load it by clicking **Load unpacked** and selecting the fresh `dist` folder
5. Hard-refresh any open new-tab pages with `Ctrl+Shift+R` (or `Cmd+Shift+R` on macOS)

</details>

<details>
<summary><strong>localStorage data not persisting</strong></summary>

Extension storage can behave differently in certain scenarios.

**Possible causes:**
- Running the extension in Incognito mode (storage is cleared on close)
- Browser privacy settings blocking local storage
- Extension was reinstalled (clears extension-specific storage)

**Fix:**
- Ensure you're not in Incognito/Private mode
- Check `chrome://settings/content/cookies` - ensure "Block third-party cookies" isn't affecting extensions
- Use the **Backup & Restore** feature in the extension popup to save and restore your data
- Your data lives in localStorage under keys prefixed with `better-home-`

</details>

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [React 19](https://react.dev) | UI framework |
| [TypeScript 5.9](https://www.typescriptlang.org) | Type safety |
| [Vite 7](https://vite.dev) | Lightning-fast bundler |
| [Tailwind CSS 4](https://tailwindcss.com) | Utility-first styling |
| [shadcn/ui](https://ui.shadcn.com) | Accessible, beautiful components |
| [Motion](https://motion.dev) | Smooth animations |
| [Tabler Icons](https://tabler.io/icons) | Crisp iconography |
| [Bun](https://bun.sh) | Ultra-fast package manager & runtime |
| [Biome](https://biomejs.dev) | Linting & formatting (via Ultracite preset) |

---

## Contributing

Contributions, issues, and feature requests are welcome!

1. **Fork** this repository
2. **Create** a feature branch: `git checkout -b feat/amazing-feature`
3. **Commit** your changes: `git commit -m "feat: add amazing feature"`
4. **Push** to your branch: `git push origin feat/amazing-feature`
5. **Open** a Pull Request

> [!NOTE]
> Please run `bun run lint` and `bun run build` before submitting to ensure your code passes all checks.

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](./LICENSE) file for details.

---

## Author

**Satyam Vyas** · [LinkedIn](https://www.linkedin.com/in/satyam-vyas/) · [GitHub](https://github.com/SatyamVyas04) · [X](https://x.com/SatyamVyas04)
