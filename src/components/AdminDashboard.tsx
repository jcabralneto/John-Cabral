import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { LoadingSpinner } from './LoadingSpinner'
import type { Trip, UserProfile } from '../types'

interface AdminDashboardProps {
  allTrips: Trip[]
}

export function AdminDashboard({ allTrips }: AdminDashboardProps) {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      console.log('👥 Carregando usuários...')
      
      // Only admin users can access all users data
      // The RLS policy should handle this, but we're being explicit
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role')
        .order('name')
        .limit(100)

      if (error) {
        console.warn('⚠️ Erro ao carregar usuários:', error)
        // If we can't load users due to permissions, just show empty list
        setUsers([])
      } else {
        setUsers(data || [])
        console.log('✅ Usuários carregados:', data?.length || 0)
      }
    } catch (error) {
      console.warn('⚠️ Erro ao carregar usuários:', error)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number | null) => {
    if (!value) return '0,00'
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Data não informada'
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const calculateTripTotal = (trip: Trip) => {
    return (trip.cost_tickets || 0) + (trip.cost_lodging || 0) + (trip.cost_daily_allowances || 0)
  }

  const calculateKPIs = () => {
    const totalTrips = allTrips.length
    const totalCost = allTrips.reduce((sum, trip) => {
      return sum + calculateTripTotal(trip)
    }, 0)

    const avgCostPerTrip = totalTrips > 0 ? totalCost / totalTrips : 0

    return { totalTrips, totalCost, avgCostPerTrip }
  }

  const { totalTrips, totalCost, avgCostPerTrip } = calculateKPIs()

  return (
    <div>
      <h2>Dashboard Administrativo</h2>
      
      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-value">{totalTrips}</div>
          <div className="kpi-label">Total de Viagens</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">R$ {formatCurrency(totalCost)}</div>
          <div className="kpi-label">Gasto Total</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">R$ {formatCurrency(avgCostPerTrip)}</div>
          <div className="kpi-label">Custo Médio por Viagem</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{users.length}</div>
          <div className="kpi-label">Usuários Cadastrados</div>
        </div>
      </div>

      {/* Users List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <LoadingSpinner text="Carregando usuários..." />
        </div>
      ) : users.length > 0 ? (
        <div style={{ marginBottom: '2rem' }}>
          <h3>Usuários Cadastrados ({users.length})</h3>
          <div style={{ 
            background: 'white', 
            borderRadius: '8px', 
            padding: '1rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            {users.map((user) => (
              <div key={user.id} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '0.5rem 0',
                borderBottom: '1px solid #f0f0f0'
              }}>
                <div>
                  <strong>{user.name}</strong>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    {user.email || 'Email não informado'}
                  </div>
                </div>
                <div style={{
                  background: user.role === 'admin' ? '#dc3545' : '#00A79D',
                  color: 'white',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '15px',
                  fontSize: '0.8rem'
                }}>
                  {user.role === 'admin' ? 'Admin' : 'Usuário'}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
          {loading ? 'Carregando usuários...' : 'Nenhum usuário encontrado ou sem permissão para visualizar.'}
        </div>
      )}

      {/* Trips */}
      <h3>Todas as Viagens ({allTrips.length})</h3>
      {allTrips.length === 0 ? (
        <p style={{textAlign: 'center', color: '#666', padding: '2rem'}}>
          Nenhuma viagem registrada ainda.
        </p>
      ) : (
        <div className="trips-grid">
          {allTrips.map((trip) => (
            <div key={trip.id} className="trip-card">
              <div className="trip-header">
                <span className="trip-type">{trip.trip_type || 'Não classificado'}</span>
              </div>
              <div className="trip-destination">
                📍 {trip.destination_city || 'Cidade não informada'}, {trip.destination_country || 'País não informado'}
              </div>
              <div className="trip-date">
                📅 {formatDate(trip.travel_date)}
              </div>
              {trip.cost_center && (
                <div style={{fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem'}}>
                  🏢 Centro de Custo: {trip.cost_center}
                </div>
              )}
              <div className="trip-costs">
                <div className="cost-item">
                  <div className="cost-label">Passagem</div>
                  <div className="cost-value">R$ {formatCurrency(trip.cost_tickets)}</div>
                </div>
                <div className="cost-item">
                  <div className="cost-label">Hospedagem</div>
                  <div className="cost-value">R$ {formatCurrency(trip.cost_lodging)}</div>
                </div>
                <div className="cost-item">
                  <div className="cost-label">Diárias</div>
                  <div className="cost-value">R$ {formatCurrency(trip.cost_daily_allowances)}</div>
                </div>
              </div>
              <div style={{
                textAlign: 'center, 
                marginTop: '1rem', 
                padding: '0.5rem', 
                background: '#f8f9fa', 
                borderRadius: '8px'
              }}>
                <strong>Total: R$ {formatCurrency(calculateTripTotal(trip))}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}