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
    const initializeApp = async () => {
      try {
        console.log('🚀 Inicializando aplicação...')
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('❌ Erro ao obter sessão:', sessionError)
          setError('Erro ao conectar com o servidor. Verifique sua conexão.')
        } else if (session) {
          console.log('✅ Sessão encontrada:', session.user.email)
          setUser(session.user)
          await fetchUserProfile(session.user.id)
        } else {
          console.log('ℹ️ Nenhuma sessão ativa')
        }
      } catch (error) {
        console.error('❌ Erro na inicialização:', error)
        setError('Erro ao inicializar aplicação.')
      } finally {
        setLoading(false)
      }
    }

    initializeApp()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event)
      
      if (session) {
        setUser(session.user)
        await fetchUserProfile(session.user.id)
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
      console.log('👤 Buscando perfil do usuário:', userId)
      
      // Try to get from users table first
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (!userError && userData) {
        console.log('✅ Perfil encontrado na tabela users:', userData)
        setUserProfile(userData)
        setCurrentView(userData.role === 'admin' ? 'adminDashboard' : 'userDashboard')
        await fetchTrips(userData.role === 'admin', userId)
        return
      }

      console.log('⚠️ Usuário não encontrado na tabela users, tentando criar...')
      
      // Create user if not exists
      const newUser: UserProfile = {
        id: userId,
        name: user?.email?.split('@')[0] || 'Usuário',
        email: user?.email || null,
        role: user?.email === 'admin@gridspertise.com' ? 'admin' : 'regular'
      }

      const { data: createdUser, error: createError } = await supabase
        .from('users')
        .insert([newUser])
        .select()
        .single()

      if (createError) {
        console.error('❌ Erro ao criar usuário:', createError)
        throw createError
      }

      console.log('✅ Usuário criado:', createdUser)
      setUserProfile(createdUser)
      setCurrentView(createdUser.role === 'admin' ? 'adminDashboard' : 'userDashboard')
      await fetchTrips(createdUser.role === 'admin', userId)

    } catch (error) {
      console.error('❌ Erro ao buscar/criar perfil:', error)
      setError('Erro ao carregar perfil do usuário.')
    }
  }

  const fetchTrips = async (isAdmin = false, userId?: string) => {
    try {
      console.log('🧳 Buscando viagens...', { isAdmin, userId })
      const tripsData = await DatabaseService.fetchTrips(userId, isAdmin)
      
      if (isAdmin) {
        setAllTrips(tripsData)
        console.log('✅ Viagens admin carregadas:', tripsData.length)
      } else {
        setTrips(tripsData)
        console.log('✅ Viagens usuário carregadas:', tripsData.length)
      }
    } catch (error) {
      console.error('❌ Erro ao carregar viagens:', error)
      setError('Erro ao carregar viagens.')
    }
  }

  const handleLogout = async () => {
    console.log('👋 Fazendo logout...')
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
          <LoadingSpinner text="Carregando aplicação..." />
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
            onTripSaved={async () => {
              setSuccess('Viagem registrada com sucesso!')
              await fetchTrips(userProfile?.role === 'admin', user.id)
            }}
            onError={setError}
          />
        )}
      </div>
    </div>
  )
}

export default App