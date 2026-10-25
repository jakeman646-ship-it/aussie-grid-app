/**
 * Aussie Grid — Vite Config
 * File: vite.config.ts
 * Version: v0.1.2.19
 * Updated: 26 Oct 2026 — do not inline a pilot invite code into the client.
 */
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

function sanitizeEnv(value: string | undefined): string {
  return (value ?? "").trim().replace(/^['"]|['"]$/g, "");
}

const SUPABASE_ENV_KEYS = [
  "VITE_SUPABASE_URL",
  "SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
] as const;

/** Merge Vercel/CI process.env over file-based env so production builds never bake empty creds. */
function mergeSupabaseEnv(fileEnv: Record<string, string>): Record<string, string> {
  const merged = { ...fileEnv };
  for (const key of SUPABASE_ENV_KEYS) {
    const value = process.env[key];
    if (value) merged[key] = value;
  }
  return merged;
}

/** Resolve Supabase creds from VITE_* or common Vercel alias names at build time. */
function resolveSupabaseEnv(env: Record<string, string>) {
  const url = sanitizeEnv(env.VITE_SUPABASE_URL || env.SUPABASE_URL);
  const anonKey = sanitizeEnv(
    env.VITE_SUPABASE_ANON_KEY ||
      env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      env.SUPABASE_ANON_KEY ||
      env.SUPABASE_PUBLISHABLE_KEY
  );
  return { url, anonKey };
}

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "");
  const env = mergeSupabaseEnv(fileEnv);
  const { url: supabaseUrl, anonKey: supabaseAnonKey } = resolveSupabaseEnv(env);

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // Bake Supabase URL + publishable/anon key into the client bundle.
    // Do not define VITE_PILOT_INVITE_CODE. Vite would inline it, and a
    // browser compare can be skipped by calling signUp directly.
    // The invite is PILOT_INVITE_CODE on the Edge Functions. See .env.example.
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabaseAnonKey),
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
  };
});
