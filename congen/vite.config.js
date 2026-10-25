import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "/consultative-genomics/",
  plugins: [react()],
  build: {
    outDir: fileURLToPath(
      new URL("../dist/consultative-genomics", import.meta.url),
    ),
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 5176,
    strictPort: true,
    proxy: {
      "/consultative-genomics/api": {
        target: "http://127.0.0.1:5177",
        changeOrigin: true,
      },
    },
  },
});
