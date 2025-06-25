import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

interface AuthViewProps {
  error: string
  success: string
  setError: (error: string) => void
  setSuccess: (success: string) => void
}

export function AuthView({ error, success, setError, setSuccess }: AuthViewProps) {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Add timeout to auth operations
      const createTimeoutPromise = (ms: number) => new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Authentication timeout')), ms)
      )

      if (authMode === 'login') {
        console.log('🔄 Attempting login for:', email)
        
        const loginPromise = supabase.auth.signInWithPassword({
          email,
          password,
        })

        const { error } = await Promise.race([loginPromise, createTimeoutPromise(10000)])
        
        if (error) throw error
        console.log('✅ Login successful')
      } else {
        console.log('🔄 Attempting signup for:', email)
        
        const signupPromise = supabase.auth.signUp({
          email,
          password,
        })

        const { error } = await Promise.race([signupPromise, createTimeoutPromise(10000)])
        
        if (error) throw error
        setSuccess('Conta criada com sucesso! Você pode fazer login agora.')
        setAuthMode('login')
        console.log('✅ Signup successful')
      }
    } catch (error: any) {
      console.error('❌ Auth error:', error)
      if (error.message === 'Authentication timeout') {
        setError('Timeout na autenticação. Verifique sua conexão e tente novamente.')
      } else {
        setError(error.message || 'Erro na autenticação')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <h2 style={{textAlign: 'center', marginBottom: '2rem', color: '#003366'}}>
        Gridspertise Travel
      </h2>
      
      {error && (
        <div className="error-message">
          <span>{error}</span>
          <button className="close-button" onClick={() => setError('')}>×</button>
        </div>
      )}
      
      {success && (
        <div className="success-message">
          <span>{success}</span>
          <button className="close-button" onClick={() => setSuccess('')}>×</button>
        </div>
      )}

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
          style={{width: '100%', marginBottom: '1rem'}}
          disabled={loading}
        >
          {loading ? 'Carregando...' : (authMode === 'login' ? 'Entrar' : 'Criar Conta')}
        </button>
      </form>

      <p style={{textAlign: 'center'}}>
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
              style={{color: '#00A79D', marginLeft: '0.5rem'}}
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
              style={{color: '#00A79D', marginLeft: '0.5rem'}}
            >
              Fazer login
            </a>
          </>
        )}
      </p>
    </div>
  )
}