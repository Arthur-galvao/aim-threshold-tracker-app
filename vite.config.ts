import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/target/**", "**/node_modules/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: {
    // Tauri 2 WebView2 (Windows) is evergreen Chromium; fixed target.
    target: "chrome120",
    minify: process.env.TAURI_ENV_DEBUG ? false : "esbuild",
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    rollupOptions: {
      output: {
        // T8.9: vendors em chunks próprios (cache estável, entry < 600 KB); chart.js só é
        // carregado quando os gráficos do dashboard montam.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\/]node_modules[\/](chart\.js|react-chartjs-2|@kurkle)[\/]/.test(id)) return "chart";
          if (/[\/]node_modules[\/](motion|motion-dom|motion-utils|framer-motion)[\/]/.test(id)) return "motion";
          if (/[\/]node_modules[\/](react|react-dom|scheduler)[\/]/.test(id)) return "react";
          if (/[\/]node_modules[\/](@base-ui|@floating-ui)[\/]/.test(id)) return "base-ui";
          return undefined;
        },
      },
    },
  },
});
