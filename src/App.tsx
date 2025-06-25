import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { DatabaseService } from './services/databaseService'
import { AuthView } from './components/AuthView'
import { Navbar } from './components/Navbar'
import { UserDashboard } from './components/UserDashboard'
import { AdminDashboard } from './components/AdminDashboard'
import { ChatInterface } from './components/ChatInterface'
import { LoadingSpinner } from './components/LoadingSpinner'
import { ErrorMessage } from './components/ErrorMessage'
import { SuccessMessage } from './components/SuccessMessage'
import type { User } from '@supabase/supabase-js'
import type { UserProfile, Trip } from './types'
import './App.css'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [currentView, setCurrentView] = useState<'auth' | 'userDashboard' | 'adminDashboard' | 'chat'>('auth')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [trips, setTrips] = useState<Trip[]>([])
  const [allTrips, setAllTrips] = useState<Trip[]>([])

  // Check for logged in user
  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        console.log('🔄 Initializing auth...')
        
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('❌ Session error:', error)
          if (mounted) {
            setError('Erro ao verificar sessão. Tente fazer login novamente.')
            setLoading(false)
          }
          return
        }

        if (session?.user && mounted) {
          console.log('✅ Session found, loading user...')
          await handleUserLogin(session.user)
        } else {
          console.log('ℹ️ No session found')
          if (mounted) {
            setLoading(false)
          }
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error)
        if (mounted) {
          setError('Erro ao inicializar autenticação.')
          setLoading(false)
        }
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event)
      
      if (!mounted) return

      if (event === 'SIGNED_IN' && session?.user) {
        await handleUserLogin(session.user)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setUserProfile(null)
        setCurrentView('auth')
        setTrips([])
        setAllTrips([])
        setError('')
        setSuccess('')
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleUserLogin = async (authUser: User) => {
    try {
      console.log('🔄 Handling user login for:', authUser.email)
      setLoading(true)
      setError('')

      // Set user immediately
      setUser(authUser)

      // Try to get or create user profile with timeout
      const profilePromise = DatabaseService.getOrCreateUserProfile(authUser.id, authUser.email || '')
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Profile loading timeout')), 10000)
      )

      const profile = await Promise.race([profilePromise, timeoutPromise])

      if (!profile) {
        throw new Error('Failed to load user profile')
      }

      console.log('✅ Profile loaded:', profile)
      setUserProfile(profile)
      setCurrentView(profile.role === 'admin' ? 'adminDashboard' : 'userDashboard')
      
      // Load trips in background
      fetchTrips(profile.role === 'admin', authUser.id).catch(error => {
        console.error('❌ Error loading trips:', error)
        // Don't show error for trips loading failure
      })
      
    } catch (error: any) {
      console.error('❌ Error handling user login:', error)
      
      // If profile creation fails, still allow user to continue with basic profile
      const basicProfile: UserProfile = {
        id: authUser.id,
        name: authUser.email?.split('@')[0] || 'User',
        email: authUser.email,
        role: authUser.email === 'admin@gridspertise.com' ? 'admin' : 'regular'
      }
      
      setUserProfile(basicProfile)
      setCurrentView(basicProfile.role === 'admin' ? 'adminDashboard' : 'userDashboard')
      setError('Perfil carregado com dados básicos. Algumas funcionalidades podem estar limitadas.')
    } finally {
      setLoading(false)
    }
  }

  const fetchTrips = async (isAdmin = false, userId?: string) => {
    try {
      console.log('🔄 Fetching trips...')
      const tripsData = await DatabaseService.fetchTrips(userId, isAdmin)
      
      if (isAdmin) {
        setAllTrips(tripsData)
      } else {
        setTrips(tripsData)
      }
      console.log('✅ Trips loaded:', tripsData.length)
    } catch (error) {
      console.error('❌ Error fetching trips:', error)
      // Don't set error state for trips loading failure
    }
  }

  const handleLogout = async () => {
    try {
      setLoading(true)
      await supabase.auth.signOut()
      // State will be cleared by auth state change listener
    } catch (error) {
      console.error('❌ Error logging out:', error)
      setError('Erro ao fazer logout.')
    } finally {
      setLoading(false)
    }
  }

  const handleTripSaved = () => {
    setSuccess('Viagem registrada com sucesso!')
    if (userProfile && user) {
      fetchTrips(userProfile.role === 'admin', user.id)
    }
  }

  // Show loading only during initial auth check
  if (loading && !user) {
    return (
      <div className="app">
        <div className="container loading-container">
          <LoadingSpinner text="Verificando autenticação..." />
        </div>
      </div>
    )
  }

  // Show auth view if no user
  if (!user) {
    return (
      <div className="app">
        <AuthView 
          error={error}
          success={success}
          setError={setError}
          setSuccess={setSuccess}
        />
      </div>
    )
  }

  // Show loading if user exists but no profile yet
  if (user && !userProfile && loading) {
    return (
      <div className="app">
        <div className="container loading-container">
          <LoadingSpinner text="Carregando perfil..." />
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <Navbar 
        user={user}
        userProfile={userProfile}
        currentView={currentView}
        setCurrentView={setCurrentView}
        onLogout={handleLogout}
      />

      <div className="container">
        {error && <ErrorMessage message={error} onClose={() => setError('')} />}
        {success && <SuccessMessage message={success} onClose={() => setSuccess('')} />}

        {currentView === 'userDashboard' && (
          <UserDashboard 
            trips={trips}
            setCurrentView={setCurrentView}
          />
        )}

        {currentView === 'adminDashboard' && userProfile?.role === 'admin' && (
          <AdminDashboard allTrips={allTrips} />
        )}

        {currentView === 'chat' && user && (
          <ChatInterface 
            user={user}
            onTripSaved={handleTripSaved}
            onError={setError}
          />
        )}
      </div>
    </div>
  )
}

export default App