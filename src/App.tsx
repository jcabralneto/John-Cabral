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
    let mounted = true

    const initializeApp = async () => {
      try {
        console.log('🚀 Inicializando aplicação...')
        
        // Add timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          if (mounted) {
            console.log('⏰ Timeout na inicialização')
            setLoading(false)
            setError('Timeout na conexão. Tente recarregar a página.')
          }
        }, 10000) // 10 second timeout

        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        clearTimeout(timeoutId)
        
        if (!mounted) return

        if (sessionError) {
          console.error('❌ Erro ao obter sessão:', sessionError)
          setError('Erro ao conectar com o servidor.')
          setLoading(false)
          return
        }

        if (session?.user) {
          console.log('✅ Sessão encontrada:', session.user.email)
          setUser(session.user)
          await fetchUserProfile(session.user)
        } else {
          console.log('ℹ️ Nenhuma sessão ativa')
          setLoading(false)
        }
      } catch (error: any) {
        console.error('❌ Erro na inicialização:', error)
        if (mounted) {
          setError(`Erro ao inicializar: ${error.message}`)
          setLoading(false)
        }
      }
    }

    initializeApp()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      
      console.log('🔄 Auth state changed:', event)
      
      if (session?.user) {
        setUser(session.user)
        await fetchUserProfile(session.user)
      } else {
        setUser(null)
        setUserProfile(null)
        setCurrentView('auth')
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const fetchUserProfile = async (authUser: User) => {
    try {
      console.log('👤 Buscando perfil do usuário:', authUser.id)
      
      // Try to get existing user profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle() // Use maybeSingle to avoid errors when no rows found

      if (userData) {
        console.log('✅ Perfil encontrado:', userData)
        setUserProfile(userData)
        setCurrentView(userData.role === 'admin' ? 'adminDashboard' : 'userDashboard')
        setLoading(false)
        
        // Load trips in background
        fetchTrips(userData.role === 'admin', authUser.id).catch(console.error)
        return
      }

      console.log('⚠️ Usuário não encontrado, criando novo perfil...')
      
      // Create new user profile
      const newUser: UserProfile = {
        id: authUser.id,
        name: authUser.email?.split('@')[0] || 'Usuário',
        email: authUser.email || null,
        role: authUser.email === 'admin@gridspertise.com' ? 'admin' : 'regular'
      }

      const { data: createdUser, error: createError } = await supabase
        .from('users')
        .insert([newUser])
        .select()
        .single()

      if (createError) {
        console.error('❌ Erro ao criar usuário:', createError)
        // If creation fails, still allow user to continue with basic profile
        setUserProfile(newUser)
        setCurrentView(newUser.role === 'admin' ? 'adminDashboard' : 'userDashboard')
        setError('Perfil criado localmente. Algumas funcionalidades podem estar limitadas.')
      } else {
        console.log('✅ Usuário criado:', createdUser)
        setUserProfile(createdUser)
        setCurrentView(createdUser.role === 'admin' ? 'adminDashboard' : 'userDashboard')
      }

      setLoading(false)
      
      // Load trips in background
      fetchTrips(newUser.role === 'admin', authUser.id).catch(console.error)

    } catch (error: any) {
      console.error('❌ Erro ao buscar/criar perfil:', error)
      
      // Fallback: create basic profile to allow user to continue
      const fallbackProfile: UserProfile = {
        id: authUser.id,
        name: authUser.email?.split('@')[0] || 'Usuário',
        email: authUser.email || null,
        role: authUser.email === 'admin@gridspertise.com' ? 'admin' : 'regular'
      }
      
      setUserProfile(fallbackProfile)
      setCurrentView(fallbackProfile.role === 'admin' ? 'adminDashboard' : 'userDashboard')
      setError(`Erro ao carregar perfil: ${error.message}. Usando perfil temporário.`)
      setLoading(false)
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
    } catch (error: any) {
      console.error('❌ Erro ao carregar viagens:', error)
      // Don't show error for trips loading failure, just log it
      console.warn('Viagens não puderam ser carregadas, mas o app continuará funcionando')
    }
  }

  const handleLogout = async () => {
    try {
      console.log('👋 Fazendo logout...')
      await supabase.auth.signOut()
      setUser(null)
      setUserProfile(null)
      setCurrentView('auth')
      setTrips([])
      setAllTrips([])
      setError('')
      setSuccess('')
    } catch (error: any) {
      console.error('Erro no logout:', error)
      setError('Erro ao fazer logout')
    }
  }

  // Show loading screen
  if (loading) {
    return (
      <div className="app">
        <div className="container loading-container">
          <LoadingSpinner text="Carregando aplicação..." />
          <div style={{ marginTop: '1rem', textAlign: 'center', color: '#666' }}>
            <small>Se o carregamento demorar muito, recarregue a página</small>
          </div>
        </div>
      </div>
    )
  }

  // Show auth screen if no user
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

  // Show main app
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