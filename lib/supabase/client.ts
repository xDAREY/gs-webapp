'use client'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

type SupabaseAny = ReturnType<typeof createSupabaseClient<any, any, any>>

let client: SupabaseAny | undefined

export function createClient(): SupabaseAny {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local and restart the dev server.',
    )
  }

  return (client ??= createSupabaseClient<any, any, any>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }))
}