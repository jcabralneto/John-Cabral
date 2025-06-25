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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user)
        handleUserLogin(session.user)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUser(session.user)
        await handleUserLogin(session.user)
      } else {
        setUser(null)
        setUserProfile(null)
        setCurrentView('auth')
        setTrips([])
        setAllTrips([])
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleUserLogin = async (user: User) => {
    try {
      setLoading(true)
      
      // First, try to get existing profile
      const { data: existingProfile, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      let profile: UserProfile

      if (fetchError || !existingProfile) {
        // Profile doesn't exist, create it
        console.log('Creating new user profile...')
        const newProfile = await DatabaseService.upsertUserProfile(user.id, user.email || '')
        
        if (!newProfile) {
          throw new Error('Failed to create user profile')
        }
        
        profile = newProfile
      } else {
        profile = existingProfile
      }

      setUserProfile(profile)
      setCurrentView(profile.role === 'admin' ? 'adminDashboard' : 'userDashboard')
      
      // Load trips
      await fetchTrips(profile.role === 'admin', user.id)
      
    } catch (error) {
      console.error('Error handling user login:', error)
      setError('Erro ao carregar perfil do usuário. Tente fazer login novamente.')
    } finally {
      setLoading(false)
    }
  }

  const fetchTrips = async (isAdmin = false, userId?: string) => {
    try {
      const tripsData = await DatabaseService.fetchTrips(userId, isAdmin)
      
      if (isAdmin) {
        setAllTrips(tripsData)
      } else {
        setTrips(tripsData)
      }
    } catch (error) {
      console.error('Error fetching trips:', error)
      setError('Erro ao carregar viagens.')
    }
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setUserProfile(null)
      setCurrentView('auth')
      setTrips([])
      setAllTrips([])
      setError('')
      setSuccess('')
    } catch (error) {
      console.error('Error logging out:', error)
      setError('Erro ao fazer logout.')
    }
  }

  const handleTripSaved = () => {
    setSuccess('Viagem registrada com sucesso!')
    if (userProfile) {
      fetchTrips(userProfile.role === 'admin', user?.id)
    }
  }

  if (loading) {
    return (
      <div className="app">
        <div className="container loading-container">
          <LoadingSpinner text="Carregando..." />
        </div>
      </div>
    )
  }

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