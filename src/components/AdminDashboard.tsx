import React, { useState, useEffect, useMemo } from 'react'
import { DatabaseService } from '../services/databaseService'
import { LoadingSpinner } from './LoadingSpinner'
import type { Trip, Budget, UserProfile } from '../types'

interface AdminDashboardProps {
  allTrips: Trip[]
}

export function AdminDashboard({ allTrips }: AdminDashboardProps) {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [budgetSummary, setBudgetSummary] = useState({
    totalBudget: 0,
    budgetByType: {} as Record<string, number>,
    budgetByYear: {} as Record<number, number>
  })
  const [loading, setLoading] = useState(true)
  const [databaseStatus, setDatabaseStatus] = useState({
    users: false,
    trips: false,
    budgets: false,
    legacy: false
  })
  const [enrichedTrips, setEnrichedTrips] = useState<Trip[]>([])

  useEffect(() => {
    loadAdminData()
  }, [allTrips])

  const loadAdminData = async () => {
    setLoading(true)
    try {
      console.log('🔄 Loading admin data...')
      
      // Check database status
      const status = await DatabaseService.checkDatabaseTables()
      setDatabaseStatus(status)

      // Load users
      const usersData = await DatabaseService.fetchUsers()
      setUsers(usersData)

      // Load budgets
      const budgetsData = await DatabaseService.fetchBudgets()
      setBudgets(budgetsData)

      // Load budget summary
      const summary = await DatabaseService.getBudgetSummary()
      setBudgetSummary(summary)

      // Enrich trips with user data
      const enriched = await DatabaseService.enrichTripsWithUserData(allTrips)
      setEnrichedTrips(enriched)

      console.log('✅ Admin data loaded successfully')
    } catch (error) {
      console.error('❌ Error loading admin data:', error)
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
    const totalTrips = enrichedTrips.length
    const totalCost = enrichedTrips.reduce((sum, trip) => {
      return sum + calculateTripTotal(trip)
    }, 0)

    const avgCostPerTrip = totalTrips > 0 ? totalCost / totalTrips : 0

    // Calculate trips by type
    const tripsByType = enrichedTrips.reduce((acc, trip) => {
      const type = trip.trip_type || 'Não classificado'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return { totalTrips, totalCost, avgCostPerTrip, tripsByType }
  }

  const kpiData = useMemo(() => calculateKPIs(), [enrichedTrips])
  const { totalTrips, totalCost, avgCostPerTrip, tripsByType } = kpiData

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
        <LoadingSpinner text="Carregando dados administrativos..." />
      </div>
    )
  }

  return (
    <div>
      <h2>Dashboard Administrativo</h2>
      
      {/* Database Status */}
      <div style={{ 
        background: '#f8f9fa', 
        padding: '1rem', 
        borderRadius: '8px', 
        marginBottom: '2rem',
        border: '1px solid #e1e5e9'
      }}>
        <h4 style={{ marginBottom: '1rem', color: '#003366' }}>Status do Banco de Dados</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem' }}>
              {databaseStatus.users ? '✅' : '❌'}
            </div>
            <div>Usuários ({users.length})</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem' }}>
              {databaseStatus.trips ? '✅' : '❌'}
            </div>
            <div>Viagens ({enrichedTrips.length})</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem' }}>
              {databaseStatus.budgets ? '✅' : '❌'}
            </div>
            <div>Orçamentos ({budgets.length})</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem' }}>
              {databaseStatus.legacy ? '✅' : '❌'}
            </div>
            <div>Tabelas Legacy</div>
          </div>
        </div>
      </div>

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

      {/* Trips by Type */}
      {Object.keys(tripsByType).length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3>Viagens por Tipo</h3>
          <div className="kpi-grid">
            {Object.entries(tripsByType).map(([type, count]) => (
              <div key={type} className="kpi-card">
                <div className="kpi-value">{count}</div>
                <div className="kpi-label">{type}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget Summary */}
      {budgets.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3>Resumo de Orçamentos</h3>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-value">R$ {formatCurrency(budgetSummary.totalBudget)}</div>
              <div className="kpi-label">Orçamento Total</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value">{budgets.length}</div>
              <div className="kpi-label">Orçamentos Definidos</div>
            </div>
          </div>

          {/* Budget by Type */}
          {Object.keys(budgetSummary.budgetByType).length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h4>Orçamento por Tipo de Viagem</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {Object.entries(budgetSummary.budgetByType).map(([type, amount]) => (
                  <div key={type} className="kpi-card">
                    <div className="kpi-value">R$ {formatCurrency(amount)}</div>
                    <div className="kpi-label">{type}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Users List */}
      {users.length > 0 && (
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
      )}

      {/* Trips */}
      <h3>Todas as Viagens ({enrichedTrips.length})</h3>
      {enrichedTrips.length === 0 ? (
        <p style={{textAlign: 'center', color: '#666', padding: '2rem'}}>
          Nenhuma viagem registrada ainda.
        </p>
      ) : (
        <div className="trips-grid">
          {enrichedTrips.map((trip) => (
            <div key={trip.id} className="trip-card">
              <div className="trip-header">
                <span className="trip-type">{trip.trip_type || 'Não classificado'}</span>
              </div>
              <div style={{fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem'}}>
                👤 {trip.users?.name || trip.users?.email || 'Usuário não encontrado'}
              </div>
              <div className="trip-destination">
                📍 {trip.destination_city || 'Cidade não informada'}, {trip.destination_country || 'País não informado'}
              </div>
              <div className="trip-date">
                📅 {formatDate(trip.travel_date)}
              </div>
              {trip.trip_reason && (
                <div style={{fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem'}}>
                  🎯 Motivo: {trip.trip_reason}
                </div>
              )}
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
                textAlign: 'center', 
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