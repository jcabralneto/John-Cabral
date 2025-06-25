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

    // Validate password length for signup
    if (authMode === 'signup' && password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      setLoading(false)
      return
    }

    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Email ou senha incorretos. Verifique suas credenciais.')
          }
          throw error
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) {
          if (error.message.includes('Password should be at least 6 characters')) {
            throw new Error('A senha deve ter pelo menos 6 caracteres.')
          }
          if (error.message.includes('User already registered')) {
            throw new Error('Este email já está cadastrado. Tente fazer login.')
          }
          throw error
        }
        setSuccess('Conta criada com sucesso! Você já pode fazer login.')
        setAuthMode('login')
        setPassword('')
      }
    } catch (error: any) {
      console.error('Auth error:', error)
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
            placeholder="seu@email.com"
          />
        </div>
        
        <div className="form-group">
          <label>Senha:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="Mínimo 6 caracteres"
          />
          {authMode === 'signup' && (
            <small style={{color: '#666', fontSize: '0.8rem'}}>
              A senha deve ter pelo menos 6 caracteres
            </small>
          )}
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