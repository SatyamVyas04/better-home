import { defineConfig } from "wxt";
import viteConfig from "./vite.config.ts";

// See https://wxt.dev/api/config.html
export default defineConfig({
  entrypointsDir: "../entrypoints",
  manifest: {
    action: {
      default_icon: {
        16: "better-home-logo-16.png",
        32: "better-home-logo-32.png",
        48: "better-home-logo-48.png",
        128: "better-home-logo-128.png",
      },
      default_popup: "popup.html",
      default_title: "better-home",
    },
    chrome_url_overrides: {
      newtab: "newtab.html",
    },
    name: "better-home",
    description:
      "A minimal, delightful new-tab replacement with tasks, quick links, and a mood calendar.",
    icons: {
      16: "better-home-logo-16.png",
      32: "better-home-logo-32.png",
      48: "better-home-logo-48.png",
      128: "better-home-logo-128.png",
    },
    host_permissions: ["http://*/*", "https://*/*"],
    permissions: ["storage", "bookmarks"],
  },
  modules: ["@wxt-dev/module-react"],
  outDir: "dist",
  srcDir: "src",
  vite: () => viteConfig,
});
