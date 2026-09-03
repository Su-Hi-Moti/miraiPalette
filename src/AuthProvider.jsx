import { useEffect, useState } from 'react'
import { AuthContext } from './auth-context'
import { signOut, subscribeToAuth } from './lib/auth'
import { supabase } from './lib/supabase'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const initialize = async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(data.session)
      if (mounted) setIsLoading(false)
    }
    initialize()

    const { data: authSubscription } = subscribeToAuth((_event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      setIsLoading(false)
    })
    return () => {
      mounted = false
      authSubscription.subscription.unsubscribe()
    }
  }, [])

  const value = {
    session,
    user: session?.user ?? null,
    isLoading,
    isAuthenticated: Boolean(session?.user),
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
