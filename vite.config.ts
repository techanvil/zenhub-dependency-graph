import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  publicDir: "public",
  server: {
    port: 3000,
  },
  build: {
    outDir: "build",
    sourcemap: true,
  },
  base:
    process.env.NODE_ENV === "production" ? "/zenhub-dependency-graph/" : "/",
});
