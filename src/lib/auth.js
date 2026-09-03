import { supabase } from './supabase'

const accountRoles = new Set(['parent', 'child', 'facilitator'])

export async function signUp({ email, password, displayName, role, childId }) {
  const accountRole = accountRoles.has(role) ? role : 'parent'
  return supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        display_name: displayName?.trim() ?? '',
        role: accountRole,
        child_id: accountRole === 'parent' ? childId || null : null,
      },
    },
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
    .select('id, role')
    .eq('id', userId)
    .maybeSingle()
}

export function subscribeToAuth(callback) {
  return supabase.auth.onAuthStateChange(callback)
}
