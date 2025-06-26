import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { UserDashboard } from './components/UserDashboard'
import { AdminDashboard } from './components/AdminDashboard'
import { ChatInterface } from './components/ChatInterface'
import { Navbar } from './components/Navbar'
import { DatabaseService } from './services/databaseService'
import type { User } from '@supabase/supabase-js'
import type { UserProfile, Trip } from './types'
import './App.css'

type ViewType = 'auth' | 'userDashboard' | 'adminDashboard' | 'chat'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [currentView, setCurrentView] = useState<ViewType>('auth')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [trips, setTrips] = useState<Trip[]>([])
  const [allTrips, setAllTrips] = useState<Trip[]>([])
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Verificar se as variáveis de ambiente estão configuradas
  useEffect(() => {
    console.log('🔍 Verificando configuração...')
    console.log('SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? 'Configurado' : 'NÃO CONFIGURADO')
    console.log('SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Configurado' : 'NÃO CONFIGURADO')
    
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      setError('Variáveis de ambiente do Supabase não configuradas. Verifique o arquivo .env')
      setLoading(false)
      return
    }

    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      console.log('🔄 Verificando status de autenticação...')
      setLoading(true)

      // Verificar sessão atual
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('❌ Erro ao verificar sessão:', sessionError)
        throw sessionError
      }

      console.log('📋 Sessão atual:', session ? 'Encontrada' : 'Não encontrada')

      if (session?.user) {
        console.log('👤 Usuário autenticado:', session.user.email)
        setUser(session.user)
        await loadUserProfile(session.user)
      } else {
        console.log('📝 Nenhum usuário autenticado, mostrando tela de login')
        setCurrentView('auth')
        setLoading(false)
      }

      // Configurar listener para mudanças de autenticação
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('🔔 Mudança de autenticação:', event)
        
        if (session?.user) {
          setUser(session.user)
          await loadUserProfile(session.user)
        } else {
          setUser(null)
          setUserProfile(null)
          setCurrentView('auth')
          setTrips([])
          setAllTrips([])
          setLoading(false)
        }
      })

      return () => subscription.unsubscribe()
    } catch (error: any) {
      console.error('❌ Erro na verificação de autenticação:', error)
      setError(`Erro de autenticação: ${error.message}`)
      setLoading(false)
    }
  }

  const loadUserProfile = async (user: User) => {
    try {
      console.log('🔄 Carregando perfil do usuário...', user.email)
      
      // Tentar carregar perfil existente ou criar novo
      const profile = await DatabaseService.getOrCreateUserProfile(user.id, user.email || '')
      
      if (profile) {
        console.log('✅ Perfil carregado:', profile)
        setUserProfile(profile)
        setCurrentView(profile.role === 'admin' ? 'adminDashboard' : 'userDashboard')
        
        // Carregar viagens
        await loadTrips(profile.role === 'admin', user.id)
      } else {
        console.error('❌ Não foi possível carregar/criar perfil')
        setError('Erro ao carregar perfil do usuário')
        await supabase.auth.signOut()
      }
    } catch (error: any) {
      console.error('❌ Erro ao carregar perfil:', error)
      setError(`Erro ao carregar perfil: ${error.message}`)
      await supabase.auth.signOut()
    } finally {
      setLoading(false)
    }
  }

  const loadTrips = async (isAdmin: boolean, userId: string) => {
    try {
      console.log('🔄 Carregando viagens...', { isAdmin, userId })
      
      const tripsData = await DatabaseService.fetchTrips(userId, isAdmin)
      
      if (isAdmin) {
        const enrichedTrips = await DatabaseService.enrichTripsWithUserData(tripsData)
        setAllTrips(enrichedTrips)
        console.log('✅ Viagens admin carregadas:', enrichedTrips.length)
      } else {
        setTrips(tripsData)
        console.log('✅ Viagens usuário carregadas:', tripsData.length)
      }
    } catch (error: any) {
      console.error('❌ Erro ao carregar viagens:', error)
      setError(`Erro ao carregar viagens: ${error.message}`)
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      console.log('🔄 Tentativa de autenticação:', authMode, email)

      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        if (error) throw error
        console.log('✅ Login realizado com sucesso')
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password
        })
        if (error) throw error
        setSuccess('Conta criada com sucesso! Faça login para continuar.')
        setAuthMode('login')
        console.log('✅ Cadastro realizado com sucesso')
      }
    } catch (error: any) {
      console.error('❌ Erro na autenticação:', error)
      setError(error.message || 'Erro na autenticação')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      console.log('🔄 Fazendo logout...')
      setLoading(true)
      await supabase.auth.signOut()
      setSuccess('Logout realizado com sucesso!')
      console.log('✅ Logout realizado')
    } catch (error: any) {
      console.error('❌ Erro no logout:', error)
      setError('Erro ao fazer logout')
    } finally {
      setLoading(false)
    }
  }

  const handleTripSaved = () => {
    setSuccess('Viagem registrada com sucesso!')
    if (user && userProfile) {
      loadTrips(userProfile.role === 'admin', user.id)
    }
  }

  // Verificar se há erro de configuração
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    return (
      <div className="app">
        <div className="container">
          <div className="error-message">
            <h2>Configuração Necessária</h2>
            <p>As variáveis de ambiente do Supabase não estão configuradas.</p>
            <p>Crie um arquivo <code>.env</code> na raiz do projeto com:</p>
            <pre>
{`VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase`}
            </pre>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {/* Navbar - apenas se usuário autenticado */}
      {user && userProfile && (
        <Navbar
          user={user}
          userProfile={userProfile}
          currentView={currentView}
          setCurrentView={setCurrentView}
          onLogout={handleLogout}
        />
      )}

      <div className="container">
        {/* Mensagens de erro e sucesso */}
        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError('')} style={{ marginLeft: '10px' }}>×</button>
          </div>
        )}
        
        {success && (
          <div className="success-message">
            {success}
            <button onClick={() => setSuccess('')} style={{ marginLeft: '10px' }}>×</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="loading">
              <div className="spinner"></div>
              Carregando...
            </div>
          </div>
        )}

        {/* Tela de autenticação */}
        {!loading && currentView === 'auth' && !user && (
          <div className="auth-container">
            <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: '#003366' }}>
              Gridspertise Travel
            </h2>
            
            <form onSubmit={handleAuth}>
              <div className="form-group">
                <label>Email:</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              
              <div className="form-group">
                <label>Senha:</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', marginBottom: '1rem' }}
                disabled={loading}
              >
                {loading ? 'Carregando...' : (authMode === 'login' ? 'Entrar' : 'Criar Conta')}
              </button>
            </form>

            <p style={{ textAlign: 'center' }}>
              {authMode === 'login' ? (
                <>
                  Não tem conta? 
                  <a 
                    href="#" 
                    onClick={(e) => {
                      e.preventDefault()
                      setAuthMode('signup')
                      setError('')
                      setSuccess('')
                    }} 
                    style={{ color: '#00A79D', marginLeft: '0.5rem' }}
                  >
                    Criar conta
                  </a>
                </>
              ) : (
                <>
                  Já tem conta? 
                  <a 
                    href="#" 
                    onClick={(e) => {
                      e.preventDefault()
                      setAuthMode('login')
                      setError('')
                      setSuccess('')
                    }} 
                    style={{ color: '#00A79D', marginLeft: '0.5rem' }}
                  >
                    Fazer login
                  </a>
                </>
              )}
            </p>

            <div style={{ marginTop: '2rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
              <h4>Conta de demonstração:</h4>
              <p><strong>Admin:</strong> admin@gridspertise.com</p>
              <p><strong>Senha:</strong> admin123</p>
            </div>
          </div>
        )}

        {/* Dashboards e Chat - apenas se usuário autenticado e não carregando */}
        {!loading && user && userProfile && (
          <>
            {currentView === 'userDashboard' && (
              <UserDashboard trips={trips} setCurrentView={setCurrentView} />
            )}
            
            {currentView === 'adminDashboard' && (
              <AdminDashboard allTrips={allTrips} />
            )}
            
            {currentView === 'chat' && (
              <ChatInterface
                user={user}
                onTripSaved={handleTripSaved}
                onError={setError}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}