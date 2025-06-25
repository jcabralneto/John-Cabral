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

    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        setSuccess('Conta criada! Verifique seu email.')
      }
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <h2 style={{textAlign: 'center', marginBottom: '2rem', color: '#003366'}}>
        Gridspertise Travel
      </h2>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <form onSubmit={handleAuth}>
        <div className="form-group">
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Senha:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
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
              onClick={() => setAuthMode('signup')} 
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
              onClick={() => setAuthMode('login')} 
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