/**
 * Aussie Grid — Supabase client
 * File: src/lib/supabase.ts
 * Version: v0.1.2.13
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

/** True when both env vars are present (set them in Vercel project settings). */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.error(
    'Missing Supabase environment variables (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Data loading is disabled.'
  )
}

// Never throw at module scope: this file is bundled into the lazy view chunks,
// and a top-level throw during chunk evaluation leaves every page stuck on its
// Suspense fallback. With a placeholder client, queries fail fast and the UI
// surfaces the error instead.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key'
)

/** Per-query abort timeout so loading states can never hang forever. */
export const QUERY_TIMEOUT_MS = 15000

export function queryTimeout(): AbortSignal {
  return AbortSignal.timeout(QUERY_TIMEOUT_MS)
}
