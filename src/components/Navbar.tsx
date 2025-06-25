import React from 'react'
import type { User } from '@supabase/supabase-js'
import type { UserProfile } from '../types'

interface NavbarProps {
  user: User
  userProfile: UserProfile | null
  currentView: string
  setCurrentView: (view: 'userDashboard' | 'adminDashboard' | 'chat') => void
  onLogout: () => void
}

export function Navbar({ user, userProfile, currentView, setCurrentView, onLogout }: NavbarProps) {
  const initializeChat = () => {
    setCurrentView('chat')
  }

  return (
    <nav className="navbar">
      <h1>Gridspertise Travel Management</h1>
      <div className="navbar-right">
        <button 
          className="btn btn-secondary"
          onClick={() => setCurrentView(userProfile?.role === 'admin' ? 'adminDashboard' : 'userDashboard')}
        >
          Dashboard
        </button>
        <button 
          className="btn btn-secondary"
          onClick={initializeChat}
        >
          Nova Viagem
        </button>
        <div className="navbar-email">{user.email}</div>
        <button className="btn btn-danger" onClick={onLogout}>
          Sair
        </button>
      </div>
    </nav>
  )
}