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
import { MultiAIManager } from './services/aiManager'
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
  const [aiManager] = useState(() => new MultiAIManager())

  // Check for logged in user
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user)
        fetchUserProfile(session.user.id)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUser(session.user)
        fetchUserProfile(session.user.id)
      } else {
        setUser(null)
        setUserProfile(null)
        setCurrentView('auth')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserProfile = async (userId: string) => {
    try {
      // Try to get from users table first
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (!userError && userData) {
        setUserProfile(userData)
        setCurrentView(userData.role === 'admin' ? 'adminDashboard' : 'userDashboard')
        fetchTrips(userData.role === 'admin', userId)
        return
      }

      // Fallback to profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (!profileError && profileData) {
        // Convert profile to user format
        const userProfile: UserProfile = {
          id: profileData.id,
          name: profileData.email?.split('@')[0] || 'User',
          email: profileData.email,
          role: profileData.role,
          created_at: profileData.created_at
        }
        setUserProfile(userProfile)
        setCurrentView(userProfile.role === 'admin' ? 'adminDashboard' : 'userDashboard')
        fetchTrips(userProfile.role === 'admin', userId)
        return
      }

      throw new Error('User profile not found')
    } catch (error) {
      console.error('Error fetching profile:', error)
      setError('Erro ao carregar perfil do usuário.')
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
    await supabase.auth.signOut()
  }

  const clearMessages = () => {
    setError('')
    setSuccess('')
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

        {currentView === 'chat' && (
          <ChatInterface 
            user={user}
            aiManager={aiManager}
            onTripSaved={() => {
              setSuccess('Viagem registrada com sucesso!')
              fetchTrips(userProfile?.role === 'admin', user.id)
            }}
            onError={setError}
          />
        )}
      </div>
    </div>
  )
}

export default App