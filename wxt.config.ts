import type {} from "@wxt-dev/auto-icons";
import type {} from "@wxt-dev/module-react";
import { defineConfig } from "wxt";
import viteConfig from "./vite.config.ts";

// See https://wxt.dev/api/config.html
export default defineConfig({
  entrypointsDir: "../entrypoints",
  manifest: {
    action: {
      default_icon: {
        16: "icons/16.png",
        32: "icons/32.png",
        48: "icons/48.png",
        128: "icons/128.png",
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
    host_permissions: ["http://*/*", "https://*/*"],
    permissions: ["storage", "bookmarks"],
  },
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  autoIcons: {
    baseIconPath: "../icons/icon.png",
    developmentIndicator: "overlay",
  },
  react: {
    vite: {
      compiler: true,
    },
  },
  outDir: "dist",
  srcDir: "src",
  vite: () => viteConfig,
});
