import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill it in.',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
})

export const RESOURCES_BUCKET = 'resources'

/**
 * A storage-only client that sends the admin's session token as a custom
 * header. A storage.objects RLS policy checks this header against
 * auth_sessions (role = admin, not expired) before allowing writes — the
 * same token-based auth as every RPC call, just surfaced to Storage's RLS
 * layer since Storage can't take the token as a function argument the way
 * supabase.rpc(...) does.
 */
export function adminStorageClient(token: string) {
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { 'x-admin-token': token } },
  })
}

export function resourcePublicUrl(storagePath: string) {
  return supabase.storage.from(RESOURCES_BUCKET).getPublicUrl(storagePath).data.publicUrl
}
