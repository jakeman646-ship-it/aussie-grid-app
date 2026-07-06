/**
 * Aussie Grid — Supabase client
 * File: src/lib/supabase.ts
 * Version: v0.1.2.17
 * Lines: 101
 * Updated: 7 Jul 2026 — raise read/write/submit timeouts for slow mobile networks.
 */
import { createClient } from '@supabase/supabase-js'

function sanitizeEnv(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/^['"]|['"]$/g, '')
}

function normalizeSupabaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

const supabaseUrl = normalizeSupabaseUrl(sanitizeEnv(import.meta.env.VITE_SUPABASE_URL))
const supabaseAnonKey = sanitizeEnv(import.meta.env.VITE_SUPABASE_ANON_KEY)

/** True when both env vars were present at build time (Vercel: set vars, then redeploy). */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/** Non-null when URL/key look misconfigured — helps debug Vercel typos and stale builds. */
export function getSupabaseConfigIssue(): string | null {
  if (!supabaseUrl && !supabaseAnonKey) {
    return 'Missing VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
  }
  if (!supabaseUrl) return 'Missing VITE_SUPABASE_URL'
  if (!supabaseAnonKey) {
    return 'Missing VITE_SUPABASE_ANON_KEY (legacy anon JWT or sb_publishable_ key)'
  }
  if (supabaseUrl.includes('placeholder')) {
    return 'Placeholder URL in build — redeploy after setting Vercel env vars'
  }
  try {
    const parsed = new URL(supabaseUrl)
    if (parsed.protocol !== 'https:') return 'VITE_SUPABASE_URL must use https'
    if (!parsed.hostname.endsWith('.supabase.co')) {
      return 'VITE_SUPABASE_URL should be https://<project>.supabase.co'
    }
  } catch {
    return 'VITE_SUPABASE_URL is not a valid URL'
  }

  const looksLikeJwt = supabaseAnonKey.startsWith('eyJ')
  const looksLikePublishable = supabaseAnonKey.startsWith('sb_publishable_')
  if (!looksLikeJwt && !looksLikePublishable) {
    return (
      'VITE_SUPABASE_ANON_KEY should be a legacy anon JWT (eyJ…) or publishable key (sb_publishable_…)'
    )
  }

  return null
}

if (!isSupabaseConfigured) {
  console.error(
    'Missing Supabase env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). ' +
      'On Vercel: Project Settings → Environment Variables → redeploy after saving.'
  )
} else {
  const issue = getSupabaseConfigIssue()
  if (issue) console.warn('Supabase configuration issue:', issue)
}

// Never throw at module scope: lazy view chunks must not freeze on missing env.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
)

/** Per-query abort timeout for dashboard reads and status checks. */
export const QUERY_TIMEOUT_MS = 25000

/** Timeout for single-row writes (insert/update). */
export const MUTATION_TIMEOUT_MS = 60000

/** End-to-end budget for the full connection-request submit flow (insert + duplicate follow-up). */
export const SUBMIT_TIMEOUT_MS = 90000

export function queryTimeout(): AbortSignal {
  return AbortSignal.timeout(QUERY_TIMEOUT_MS)
}

export function mutationTimeout(): AbortSignal {
  return AbortSignal.timeout(MUTATION_TIMEOUT_MS)
}

export function submitTimeout(): AbortSignal {
  return AbortSignal.timeout(SUBMIT_TIMEOUT_MS)
}
