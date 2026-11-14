import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import type { PluginOption, UserConfig } from "vite";

export const viteConfig: UserConfig = {
  build: {
    target: "esnext",
  },
  plugins: [
    tailwindcss() as PluginOption,
    {
      name: "dev-root-redirect",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === "/" || req.url === "/index.html") {
            res.statusCode = 307;
            res.setHeader("Location", "/entrypoints/newtab/index.html");
            return res.end();
          }
          next();
        });
      },
    },
  ],
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client"],
    entries: ["entrypoints/**/*.html"],
  },
  server: {
    open: "/entrypoints/newtab/index.html",
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
};

export default viteConfig;
