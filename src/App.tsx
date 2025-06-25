import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
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

  useEffect(() => {
    console.log('🚀 App iniciando...')
    
    // Set a maximum loading time
    const loadingTimeout = setTimeout(() => {
      console.log('⏰ Timeout de carregamento atingido')
      setLoading(false)
      if (!user) {
        console.log('📝 Mostrando tela de login')
      }
    }, 5000)

    const initAuth = async () => {
      try {
        console.log('🔐 Verificando sessão...')
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          console.log('✅ Usuário logado:', session.user.email)
          setUser(session.user)
          
          // Create basic profile immediately
          const basicProfile: UserProfile = {
            id: session.user.id,
            name: session.user.email?.split('@')[0] || 'Usuário',
            email: session.user.email || null,
            role: session.user.email === 'admin@gridspertise.com' ? 'admin' : 'regular'
          }
          
          setUserProfile(basicProfile)
          setCurrentView(basicProfile.role === 'admin' ? 'adminDashboard' : 'userDashboard')
          
          // Try to create/update user in database (non-blocking)
          createUserProfile(session.user, basicProfile).catch(console.error)
          
        } else {
          console.log('ℹ️ Nenhum usuário logado')
        }
        
        clearTimeout(loadingTimeout)
        setLoading(false)
        
      } catch (error: any) {
        console.error('❌ Erro na inicialização:', error)
        clearTimeout(loadingTimeout)
        setLoading(false)
        setError('Erro ao conectar. Tente recarregar a página.')
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth mudou:', event)
      
      if (session?.user) {
        setUser(session.user)
        
        const basicProfile: UserProfile = {
          id: session.user.id,
          name: session.user.email?.split('@')[0] || 'Usuário',
          email: session.user.email || null,
          role: session.user.email === 'admin@gridspertise.com' ? 'admin' : 'regular'
        }
        
        setUserProfile(basicProfile)
        setCurrentView(basicProfile.role === 'admin' ? 'adminDashboard' : 'userDashboard')
        
        // Try to create/update user in database (non-blocking)
        createUserProfile(session.user, basicProfile).catch(console.error)
        
      } else {
        setUser(null)
        setUserProfile(null)
        setCurrentView('auth')
        setTrips([])
        setAllTrips([])
      }
      
      setLoading(false)
    })

    return () => {
      clearTimeout(loadingTimeout)
      subscription.unsubscribe()
    }
  }, [])

  const createUserProfile = async (authUser: User, profile: UserProfile) => {
    try {
      console.log('👤 Tentando criar/atualizar perfil no banco...')
      
      // Use upsert to handle both insert and update in one operation
      // This respects RLS policies better than separate select/insert/update operations
      const { error: upsertError } = await supabase
        .from('users')
        .upsert({
          id: authUser.id,
          name: profile.name,
          email: profile.email,
          role: profile.role
        }, {
          onConflict: 'id'
        })

      if (upsertError) {
        console.warn('⚠️ Erro ao criar/atualizar perfil:', upsertError)
      } else {
        console.log('✅ Perfil criado/atualizado no banco')
      }
    } catch (error) {
      console.warn('⚠️ Erro ao criar/atualizar perfil:', error)
      // Don't show error to user, continue with local profile
    }
  }

  const loadTrips = async () => {
    if (!user || !userProfile) return

    try {
      console.log('🧳 Carregando viagens...')
      
      let query = supabase.from('trips').select('*')
      
      if (userProfile.role !== 'admin') {
        query = query.eq('user_id', user.id)
      }
      
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.warn('⚠️ Erro ao carregar viagens:', error)
        return
      }

      if (userProfile.role === 'admin') {
        setAllTrips(data || [])
      } else {
        setTrips(data || [])
      }
      
      console.log('✅ Viagens carregadas:', data?.length || 0)
      
    } catch (error) {
      console.warn('⚠️ Erro ao carregar viagens:', error)
    }
  }

  // Load trips when user profile is ready
  useEffect(() => {
    if (user && userProfile && !loading) {
      loadTrips()
    }
  }, [user, userProfile, loading])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Erro no logout:', error)
    }
  }

  // Show loading screen
  if (loading) {
    return (
      <div className="app">
        <div className="container loading-container">
          <LoadingSpinner text="Carregando..." />
          <div style={{ marginTop: '1rem', textAlign: 'center', color: '#666' }}>
            <small>Aguarde alguns segundos...</small>
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
            onTripSaved={() => {
              setSuccess('Viagem registrada com sucesso!')
              loadTrips()
            }}
            onError={setError}
          />
        )}
      </div>
    </div>
  )
}

export default App