'use client'

import { createClient } from './supabase/client'

const FUNCTIONS_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

type Role = 'nurse' | 'supervisor'
type StaffRole = 'nurse' | 'pca_cna'

async function callFunction(name: string, body: unknown): Promise<
  { ok: true; data: any } | { ok: false; error: string; status: number; data?: any }
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
    return { ok: false, error: data?.error || 'server_error', status: res.status, data }
  }
  return { ok: true, data }
}

/**
 * Logs in via the auth-login Edge Function, then immediately hands the
 * returned access/refresh tokens to the local Supabase client with
 * setSession — that's what makes auth.uid() start working for every
 * subsequent RLS-protected query.
 *
 * expectedStaffRole is only meaningful for role === 'nurse' — it's which
 * of the Nurse / PCA-CNA buttons the person clicked on the landing screen.
 * The Edge Function rejects with 'wrong_role' if the account's actual
 * role doesn't match, before a session is ever minted.
 */
export async function login(role: Role, phone: string, pin: string, expectedStaffRole?: StaffRole) {
  const result = await callFunction('auth-login', { role, phone, pin, expectedStaffRole })
  if (!result.ok) {
    return {
      ok: false as const,
      error: result.error,
      status: result.status,
      actualRole: result.error === 'wrong_role' ? (result.data?.actualRole as StaffRole | undefined) : undefined,
    }
  }

  const { session, profile } = result.data
  const supabase = createClient()
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
  if (error) return { ok: false as const, error: 'session_error', status: 500, actualRole: undefined }

  return { ok: true as const, profile }
}

/**
 * register_nurse is a plain SECURITY DEFINER RPC — it never mints a
 * session (new accounts land 'pending' and can't log in until approved),
 * so it's called directly rather than through an Edge Function.
 *
 * role defaults to 'nurse' server-side if omitted; pass 'pca_cna' when the
 * person created their account from the PCA/CNA entry point.
 */
export async function registerNurse(name: string, phone: string, pin: string, role: StaffRole = 'nurse') {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('register_nurse', {
    p_name: name,
    p_phone: phone,
    p_pin: pin,
    p_role: role,
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