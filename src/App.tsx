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

// Centralização dos e-mails de admin para fácil manutenção e maior segurança
const ADMIN_EMAILS = ['admin@gridspertise.com']

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [currentView, setCurrentView] = useState<'auth' | 'userDashboard' | 'adminDashboard' | 'chat'>('auth')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [trips, setTrips] = useState<Trip[]>([])
  const [allTrips, setAllTrips] = useState<Trip[]>([])

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        console.log('🔄 Initializing auth...')
        
        // Autenticação com timeout defensivo
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Session timeout')), 8000)
        )

        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise])

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
          if (mounted) setLoading(false)
        }
      } catch (error: any) {
        console.error('❌ Auth initialization error:', error)
        if (mounted) {
          if (error.message === 'Session timeout') {
            setError('Timeout na verificação de sessão. Verifique sua conexão.')
          } else {
            setError('Erro ao inicializar autenticação.')
          }
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
        console.log('👋 User signed out')
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

      setUser(authUser)

      // Cria perfil básico imediatamente para não bloquear UI
      const basicProfile: UserProfile = {
        id: authUser.id,
        name: authUser.email?.split('@')[0] || 'User',
        email: authUser.email,
        role: ADMIN_EMAILS.includes(authUser.email || '') ? 'admin' : 'regular'
      }

      console.log('✅ Basic profile created:', basicProfile)
      setUserProfile(basicProfile)
      setCurrentView(basicProfile.role === 'admin' ? 'adminDashboard' : 'userDashboard')
      setLoading(false)

      // Busca o perfil completo em segundo plano
      try {
        console.log('🔄 Loading full profile...')
        const profilePromise = DatabaseService.getOrCreateUserProfile(authUser.id, authUser.email || '')
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Profile loading timeout')), 5000)
        )

        const profile = await Promise.race([profilePromise, timeoutPromise])
        if (profile && profile.id) {
          console.log('✅ Full profile loaded:', profile)
          setUserProfile(profile)
          setCurrentView(profile.role === 'admin' ? 'adminDashboard' : 'userDashboard')
        }
      } catch (profileError: any) {
        console.warn('⚠️ Profile load error (using basic profile):', profileError.message)
        // Mantém basicProfile, não quebra fluxo
      }

      // Carrega as viagens em background
      fetchTrips(basicProfile.role === 'admin', authUser.id).catch(error => {
        console.warn('⚠️ Error loading trips:', error)
        // Não mostra erro para o usuário, apenas loga
      })

    } catch (error: any) {
      console.error('❌ Error handling user login:', error)
      
      // Garante que mesmo com erro, usuário entra com perfil básico
      const fallbackProfile: UserProfile = {
        id: authUser.id,
        name: authUser.email?.split('@')[0] || 'User',
        email: authUser.email,
        role: ADMIN_EMAILS.includes(authUser.email || '') ? 'admin' : 'regular'
      }
      
      setUserProfile(fallbackProfile)
      setCurrentView(fallbackProfile.role === 'admin' ? 'adminDashboard' : 'userDashboard')
      setError('Sistema carregado com dados básicos. Algumas funcionalidades podem estar limitadas.')
      setLoading(false)
    }
  }

  const fetchTrips = async (isAdmin = false, userId?: string) => {
    try {
      console.log('🔄 Fetching trips...', { isAdmin, userId })
      const tripsData = await DatabaseService.fetchTrips(userId, isAdmin)
      
      if (isAdmin) {
        setAllTrips(tripsData)
        console.log('✅ Admin trips loaded:', tripsData.length)
      } else {
        setTrips(tripsData)
        console.log('✅ User trips loaded:', tripsData.length)
      }
    } catch (error) {
      console.warn('⚠️ Error fetching trips:', error)
      // Não mostra erro crítico para o usuário, apenas loga
    }
  }

  const handleLogout = async () => {
    try {
      console.log('🔄 Logging out...')
      setLoading(true)
      await supabase.auth.signOut()
      console.log('✅ Logout successful')
      // O state será limpo pelo listener do onAuthStateChange
    } catch (error) {
      console.error('❌ Logout error:', error)
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

  // Exibe loading apenas no carregamento inicial
  if (loading && !user && !userProfile) {
    return (
      <div className="app">
        <div className="container loading-container">
          <LoadingSpinner text="Verificando autenticação..." />
        </div>
      </div>
    )
  }

  // Exibe tela de login se não houver usuário autenticado
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

  // Render principal após autenticação
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