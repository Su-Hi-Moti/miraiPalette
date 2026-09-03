import { supabase } from './supabase'

export async function signUp({ email, password, displayName }) {
  return supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { display_name: displayName?.trim() ?? '' } },
  })
}

export async function signInWithPassword({ email, password }) {
  return supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
}

export function signOut() {
  return supabase.auth.signOut()
}

export function getProfile(userId) {
  if (!userId) return Promise.resolve({ data: null, error: null })
  return supabase
    .from('profiles')
    .select('id, role, display_name, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle()
}

export function subscribeToAuth(callback) {
  return supabase.auth.onAuthStateChange(callback)
}
