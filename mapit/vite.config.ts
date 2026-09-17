import { fileURLToPath } from "node:url";
import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const apiOrigin = process.env.MAPIT_API_ORIGIN || "https://mapit-lab-inventory.yazinalomary.chatgpt.site";
const proxy: Record<string, ProxyOptions> = {
  "/Inventory/Mapit/api": {
    target: apiOrigin,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/Inventory\/Mapit/, ""),
    configure: (server) => {
      server.on("proxyReq", (request) => {
        request.setHeader("origin", new URL(apiOrigin).origin);
      });
    },
  },
};

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "/Inventory/Mapit/",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: fileURLToPath(new URL("../dist/Inventory/Mapit", import.meta.url)),
    emptyOutDir: true,
  },
  server: { host: "127.0.0.1", port: 5174, strictPort: true, proxy },
  preview: { host: "127.0.0.1", port: 5174, strictPort: true, proxy },
});
