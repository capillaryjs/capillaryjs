import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@capillaryjs\/capillary-ui\/jsx-runtime$/,
        replacement: fileURLToPath(
          new URL("../../packages/capillary-ui/src/jsx-runtime.ts", import.meta.url),
        ),
      },
      {
        find: /^@capillaryjs\/capillary-ui\/jsx-dev-runtime$/,
        replacement: fileURLToPath(
          new URL("../../packages/capillary-ui/src/jsx-dev-runtime.ts", import.meta.url),
        ),
      },
      {
        find: /^@capillaryjs\/capillary-ui$/,
        replacement: fileURLToPath(
          new URL("../../packages/capillary-ui/src/index.ts", import.meta.url),
        ),
      },
      {
        find: /^@capillaryjs\/capillary$/,
        replacement: fileURLToPath(
          new URL("../../packages/capillary/src/index.ts", import.meta.url),
        ),
      },
      {
        find: /^@capillaryjs\/capillary-viz$/,
        replacement: fileURLToPath(
          new URL("../../packages/capillary-viz/src/index.ts", import.meta.url),
        ),
      },
    ],
  },
  server: { port: 5173, strictPort: true, proxy: { "/api": "http://127.0.0.1:4176" } },
  preview: { port: 4173, strictPort: true, proxy: { "/api": "http://127.0.0.1:4176" } },
  worker: { format: "es" },
  build: { target: "es2022" },
});
