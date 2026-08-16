// supabase/functions/auth-login/index.ts
//
// Called from the frontend with { role: 'nurse' | 'supervisor', phone, pin }.
// Verifies the PIN via the verify_*_login RPCs (which never expose the
// hash), then mints a real Supabase Auth session for that profile so
// auth.uid() starts working and RLS takes over.
//
// SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are
// injected automatically by the platform at runtime — do not set these
// yourself in the dashboard's function secrets.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

// Service-role client: bypasses RLS entirely. Only ever used inside this
// server-side function, never returned to the caller.
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

type Role = 'nurse' | 'supervisor'

type LoginRequest = {
  role: Role
  phone: string
  pin: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  let body: LoginRequest
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }

  const { role, phone, pin } = body
  if (!role || !phone || !pin) {
    return jsonResponse({ error: 'missing_fields' }, 400)
  }
  if (role !== 'nurse' && role !== 'supervisor') {
    return jsonResponse({ error: 'invalid_role' }, 400)
  }

  try {
    if (role === 'nurse') {
      const { data, error } = await adminClient.rpc('verify_nurse_login', {
        p_phone: phone,
        p_pin: pin,
      })
      if (error) throw error

      const match = data?.[0]
      if (!match) return jsonResponse({ error: 'invalid_credentials' }, 401)
      if (match.status === 'pending') {
        return jsonResponse({ error: 'pending_approval' }, 403)
      }
      // Deactivated nurses get a specific message rather than falling
      // through to a session mint that RLS would immediately neuter
      // anyway (current_nurse_id() returns null for them).
      if (!match.active) {
        return jsonResponse({ error: 'account_deactivated' }, 403)
      }

      const session = await ensureSessionForProfile('nurses', match.nurse_id)
      return jsonResponse({
        session,
        profile: { id: match.nurse_id, name: match.name, mustResetPin: match.must_reset_pin },
      })
    } else {
      const { data, error } = await adminClient.rpc('verify_supervisor_login', {
        p_phone: phone,
        p_pin: pin,
      })
      if (error) throw error

      const match = data?.[0]
      if (!match) return jsonResponse({ error: 'invalid_credentials' }, 401)

      const session = await ensureSessionForProfile('supervisors', match.supervisor_id)
      return jsonResponse({
        session,
        profile: { id: match.supervisor_id, name: match.name },
      })
    }
  } catch (err) {
    console.error('auth-login error:', err)
    return jsonResponse({ error: 'server_error' }, 500)
  }
})

// Ensures an auth.users row exists for this profile, linking it via
// auth_user_id on first login, then mints a real session for it without
// ever sending an email — generateLink() only creates the token, it
// doesn't dispatch anything.
async function ensureSessionForProfile(table: 'nurses' | 'supervisors', profileId: string) {
  const { data: row, error: fetchErr } = await adminClient
    .from(table)
    .select('auth_user_id')
    .eq('id', profileId)
    .single()
  if (fetchErr) throw fetchErr

  let authUserId: string | null = row?.auth_user_id ?? null
  const kind = table === 'nurses' ? 'nurse' : 'supervisor'
  const syntheticEmail = `${kind}-${profileId}@users.goldenserenity.internal`

  if (!authUserId) {
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
      user_metadata: { role: kind, profile_id: profileId },
    })
    if (createErr) throw createErr

    authUserId = created.user.id
    const { error: linkErr } = await adminClient.from(table).update({ auth_user_id: authUserId }).eq('id', profileId)
    if (linkErr) throw linkErr
  }

  const { data: linkData, error: genErr } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: syntheticEmail,
  })
  if (genErr) throw genErr

  const tokenHash = linkData.properties?.hashed_token
  if (!tokenHash) throw new Error('no_token_hash_returned')

  // Redeem the token server-side (anon-key client — verifyOtp is a public
  // auth method, no service role needed for this step) to get back a real
  // access_token/refresh_token pair.
  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: verified, error: verifyErr } = await anonClient.auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  })
  if (verifyErr) throw verifyErr
  if (!verified.session) throw new Error('no_session_returned')

  return {
    access_token: verified.session.access_token,
    refresh_token: verified.session.refresh_token,
    expires_at: verified.session.expires_at,
  }
}