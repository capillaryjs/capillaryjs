import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@sylwellsoftware\/fray\/jsx-runtime$/,
        replacement: fileURLToPath(
          new URL("../../packages/fray/src/jsx-runtime.ts", import.meta.url),
        ),
      },
      {
        find: /^@sylwellsoftware\/fray\/jsx-dev-runtime$/,
        replacement: fileURLToPath(
          new URL("../../packages/fray/src/jsx-dev-runtime.ts", import.meta.url),
        ),
      },
      {
        find: /^@sylwellsoftware\/fray$/,
        replacement: fileURLToPath(
          new URL("../../packages/fray/src/index.ts", import.meta.url),
        ),
      },
      {
        find: /^@sylwellsoftware\/glue$/,
        replacement: fileURLToPath(
          new URL("../../packages/glue/src/index.ts", import.meta.url),
        ),
      },
      {
        find: /^@sylwellsoftware\/fray-visualization$/,
        replacement: fileURLToPath(
          new URL("../../packages/fray-visualization/src/index.ts", import.meta.url),
        ),
      },
    ],
  },
  server: { port: 5173, strictPort: true, proxy: { "/api": "http://127.0.0.1:4176" } },
  preview: { port: 4173, strictPort: true, proxy: { "/api": "http://127.0.0.1:4176" } },
  worker: { format: "es" },
  build: { target: "es2022" },
});
