import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/client"
  },
  test: {
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**"]
  },
  server: {
    proxy: {
      "/api": "http://localhost:4174"
    }
  }
});
