import { useEffect, useState } from 'react'
import { AuthContext } from './auth-context'
import { getProfile, signOut, subscribeToAuth } from './lib/auth'
import { supabase } from './lib/supabase'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const loadProfile = async (userId) => {
      if (!userId) {
        if (mounted) {
          setProfile(null)
          setProfileError('')
        }
        return
      }
      const { data, error } = await getProfile(userId)
      if (!mounted) return
      setProfile(data)
      setProfileError(error?.message ?? '')
    }

    const initialize = async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(data.session)
      await loadProfile(data.session?.user?.id)
      if (mounted) setIsLoading(false)
    }
    initialize()

    const { data: authSubscription } = subscribeToAuth((_event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      setIsLoading(true)
      // Auth callbacks should stay synchronous; profile I/O is deferred.
      setTimeout(() => {
        void loadProfile(nextSession?.user?.id).finally(() => {
          if (mounted) setIsLoading(false)
        })
      }, 0)
    })
    return () => {
      mounted = false
      authSubscription.subscription.unsubscribe()
    }
  }, [])

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    profileError,
    isLoading,
    isAuthenticated: Boolean(session?.user),
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
