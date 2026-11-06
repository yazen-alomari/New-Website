import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "/TrueMedLIStracker/",
  esbuild: { jsx: "automatic" },
  build: {
    outDir: fileURLToPath(
      new URL("../dist/TrueMedLIStracker", import.meta.url),
    ),
    emptyOutDir: true,
  },
});
