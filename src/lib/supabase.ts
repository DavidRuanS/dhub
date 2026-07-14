import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const hasSupabase = Boolean(url && key && !url.includes('SEU-PROJETO'))
export const supabase: SupabaseClient | null = hasSupabase ? createClient(url!, key!) : null

export async function ensureAnonymousSession() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session
  const result = await supabase.auth.signInAnonymously()
  if (result.error) throw result.error
  return result.data.session
}
