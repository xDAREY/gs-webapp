'use client'

import { createClient } from './supabase/client'

const FUNCTIONS_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

type Role = 'nurse' | 'supervisor'

async function callFunction(name: string, body: unknown): Promise<
  { ok: true; data: any } | { ok: false; error: string; status: number }
> {
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { ok: false, error: data?.error || 'server_error', status: res.status }
  }
  return { ok: true, data }
}

/**
 * Logs in via the auth-login Edge Function, then immediately hands the
 * returned access/refresh tokens to the local Supabase client with
 * setSession — that's what makes auth.uid() start working for every
 * subsequent RLS-protected query.
 */
export async function login(role: Role, phone: string, pin: string) {
  const result = await callFunction('auth-login', { role, phone, pin })
  if (!result.ok) return result

  const { session, profile } = result.data
  const supabase = createClient()
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
  if (error) return { ok: false as const, error: 'session_error', status: 500 }

  return { ok: true as const, profile }
}

/**
 * register_nurse is a plain SECURITY DEFINER RPC — it never mints a
 * session (new nurses land 'pending' and can't log in until approved),
 * so it's called directly rather than through an Edge Function.
 *
 * There is deliberately NO "auth-register" Edge Function. One was never
 * needed: it would exist only to forward this exact call, adding a network
 * hop and a second thing to deploy/keep in sync for zero functional gain.
 * If a previous pass introduced a call to one, that's the bug — this is
 * the fix, not a stopgap.
 */
export async function registerNurse(name: string, phone: string, pin: string) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('register_nurse', {
    p_name: name,
    p_phone: phone,
    p_pin: pin,
  })
  if (error) {
    const isPhoneTaken = error.message?.includes('phone_taken')
    return {
      ok: false as const,
      error: isPhoneTaken ? 'phone_taken' : 'server_error',
      status: isPhoneTaken ? 409 : 500,
    }
  }
  return { ok: true as const, nurseId: data as string }
}

/**
 * Sets a nurse's own PIN after a forced reset. Requires an existing
 * session — this calls the RPC directly rather than going through an Edge
 * Function, since no session-minting is needed here either.
 */
export async function setOwnPin(newPin: string) {
  const supabase = createClient()
  const { error } = await supabase.rpc('set_own_nurse_pin', { p_new_pin: newPin })
  if (error) return { ok: false as const, error: error.message, status: 500 }
  return { ok: true as const }
}