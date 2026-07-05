/**
 * Aussie Grid — Vite Config
 * File: vite.config.ts
 * Version: v0.1.2.13
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "vendor-recharts",
              test: /node_modules[\\/]recharts/,
              priority: 40,
            },
            {
              name: "vendor-supabase",
              test: /node_modules[\\/]@supabase[\\/]/,
              priority: 35,
            },
            {
              name: "vendor-react",
              test: /node_modules[\\/](react|react-dom)[\\/]/,
              priority: 30,
            },
            {
              name: "charts",
              test: /src[\\/]components[\\/]EnergyReadingsChart/,
              priority: 25,
            },
            {
              name: "views",
              test: /src[\\/]components[\\/](Dashboard|ConnectInverter|Requests|ConnectSungrow|Help|Profile|ChangePassword)/,
              priority: 20,
            },
          ],
        },
      },
    },
  },
});
