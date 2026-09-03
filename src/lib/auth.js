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

export function subscribeToAuth(callback) {
  return supabase.auth.onAuthStateChange(callback)
}
