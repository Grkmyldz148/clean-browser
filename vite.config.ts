import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  clearScreen: false,
  server: {
    strictPort: true
  },
  envPrefix: ["VITE_", "TAURI_"]
});
