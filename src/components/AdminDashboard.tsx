import React, { useState, useEffect } from 'react'
import { DatabaseService } from '../services/databaseService'
import { LoadingSpinner } from './LoadingSpinner'
import type { Trip, Budget, UserProfile } from '../types'

interface AdminDashboardProps {
  allTrips: Trip[]
}

interface FilterState {
  dateStart: string
  dateEnd: string
  tripType: string
  userId: string
  costCenter: string
  year: number
  month: number
}

interface MonthlyData {
  month: string
  budget: number
  actual: number
  variance: number
  trips: number
}

interface KPIData {
  totalTrips: number
  totalCost: number
  avgCostPerTrip: number
  budgetUtilization: number
  savingsOrOverspend: number
  mostExpensiveTrip: number
  topDestination: string
  topCostCenter: string
}

export function AdminDashboard({ allTrips }: AdminDashboardProps) {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [filteredTrips, setFilteredTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [enrichedTrips, setEnrichedTrips] = useState<Trip[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [kpis, setKPIs] = useState<KPIData>({
    totalTrips: 0,
    totalCost: 0,
    avgCostPerTrip: 0,
    budgetUtilization: 0,
    savingsOrOverspend: 0,
    mostExpensiveTrip: 0,
    topDestination: '',
    topCostCenter: ''
  })

  const [filters, setFilters] = useState<FilterState>({
    dateStart: '',
    dateEnd: '',
    tripType: '',
    userId: '',
    costCenter: '',
    year: new Date().getFullYear(),
    month: 0 // 0 = all months
  })

  useEffect(() => {
    loadAdminData()
  }, [allTrips])

  useEffect(() => {
    applyFilters()
  }, [filters, enrichedTrips, budgets])

  const loadAdminData = async () => {
    setLoading(true)
    try {
      // Load users
      const usersData = await DatabaseService.fetchUsers()
      setUsers(usersData)

      // Load budgets
      const budgetsData = await DatabaseService.fetchBudgets()
      setBudgets(budgetsData)

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

  const applyFilters = () => {
    let filtered = [...enrichedTrips]

    // Date filters
    if (filters.dateStart) {
      filtered = filtered.filter(trip => 
        trip.travel_date && trip.travel_date >= filters.dateStart
      )
    }
    if (filters.dateEnd) {
      filtered = filtered.filter(trip => 
        trip.travel_date && trip.travel_date <= filters.dateEnd
      )
    }

    // Trip type filter
    if (filters.tripType) {
      filtered = filtered.filter(trip => trip.trip_type === filters.tripType)
    }

    // User filter
    if (filters.userId) {
      filtered = filtered.filter(trip => trip.user_id === filters.userId)
    }

    // Cost center filter
    if (filters.costCenter) {
      filtered = filtered.filter(trip => 
        trip.cost_center === filters.costCenter || trip.trip_reason === filters.costCenter
      )
    }

    // Year filter
    if (filters.year) {
      filtered = filtered.filter(trip => {
        if (!trip.travel_date) return false
        return new Date(trip.travel_date).getFullYear() === filters.year
      })
    }

    // Month filter
    if (filters.month > 0) {
      filtered = filtered.filter(trip => {
        if (!trip.travel_date) return false
        return new Date(trip.travel_date).getMonth() + 1 === filters.month
      })
    }

    setFilteredTrips(filtered)
    calculateKPIs(filtered)
    calculateMonthlyData(filtered)
  }

  const calculateKPIs = (trips: Trip[]) => {
    const totalTrips = trips.length
    const totalCost = trips.reduce((sum, trip) => sum + calculateTripTotal(trip), 0)
    const avgCostPerTrip = totalTrips > 0 ? totalCost / totalTrips : 0

    // Find most expensive trip
    const mostExpensiveTrip = trips.reduce((max, trip) => {
      const tripTotal = calculateTripTotal(trip)
      return tripTotal > max ? tripTotal : max
    }, 0)

    // Find top destination
    const destinationCounts = trips.reduce((acc, trip) => {
      const dest = `${trip.destination_city}, ${trip.destination_country}`
      acc[dest] = (acc[dest] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    const topDestination = Object.entries(destinationCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'

    // Find top cost center
    const costCenterCounts = trips.reduce((acc, trip) => {
      const center = trip.trip_reason || trip.cost_center || 'Não informado'
      acc[center] = (acc[center] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    const topCostCenter = Object.entries(costCenterCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'

    // Calculate budget utilization
    const yearBudgets = budgets.filter(b => b.year === filters.year)
    const totalBudget = yearBudgets.reduce((sum, b) => sum + (b.budget_amount || 0), 0)
    const budgetUtilization = totalBudget > 0 ? (totalCost / totalBudget) * 100 : 0
    const savingsOrOverspend = totalBudget - totalCost

    setKPIs({
      totalTrips,
      totalCost,
      avgCostPerTrip,
      budgetUtilization,
      savingsOrOverspend,
      mostExpensiveTrip,
      topDestination,
      topCostCenter
    })
  }

  const calculateMonthlyData = (trips: Trip[]) => {
    const monthlyTrips = trips.reduce((acc, trip) => {
      if (!trip.travel_date) return acc
      const date = new Date(trip.travel_date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!acc[monthKey]) {
        acc[monthKey] = { cost: 0, count: 0 }
      }
      acc[monthKey].cost += calculateTripTotal(trip)
      acc[monthKey].count += 1
      return acc
    }, {} as Record<string, { cost: number, count: number }>)

    const monthlyBudgets = budgets.reduce((acc, budget) => {
      if (budget.year && budget.month) {
        const monthKey = `${budget.year}-${String(budget.month).padStart(2, '0')}`
        acc[monthKey] = (acc[monthKey] || 0) + (budget.budget_amount || 0)
      }
      return acc
    }, {} as Record<string, number>)

    const months = Array.from(new Set([
      ...Object.keys(monthlyTrips),
      ...Object.keys(monthlyBudgets)
    ])).sort()

    const monthlyData = months.map(monthKey => {
      const actual = monthlyTrips[monthKey]?.cost || 0
      const budget = monthlyBudgets[monthKey] || 0
      const variance = budget - actual
      const trips = monthlyTrips[monthKey]?.count || 0

      return {
        month: monthKey,
        budget,
        actual,
        variance,
        trips
      }
    })

    setMonthlyData(monthlyData)
  }

  const calculateTripTotal = (trip: Trip) => {
    return (trip.cost_tickets || 0) + (trip.cost_lodging || 0) + (trip.cost_daily_allowances || 0)
  }

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Data não informada'
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split('-')
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
                       'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return `${monthNames[parseInt(month) - 1]}/${year}`
  }

  const getUniqueValues = (trips: Trip[], field: keyof Trip) => {
    return Array.from(new Set(trips.map(trip => trip[field]).filter(Boolean)))
  }

  const resetFilters = () => {
    setFilters({
      dateStart: '',
      dateEnd: '',
      tripType: '',
      userId: '',
      costCenter: '',
      year: new Date().getFullYear(),
      month: 0
    })
  }

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
      
      {/* Filtros */}
      <div style={{ 
        background: '#f8f9fa', 
        padding: '1.5rem', 
        borderRadius: '12px', 
        marginBottom: '2rem',
        border: '1px solid #e1e5e9'
      }}>
        <h3 style={{ marginBottom: '1rem' }}>Filtros</h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1rem',
          alignItems: 'end'
        }}>
          <div>
            <label>Data Início:</label>
            <input
              type="date"
              value={filters.dateStart}
              onChange={(e) => setFilters({...filters, dateStart: e.target.value})}
            />
          </div>
          <div>
            <label>Data Fim:</label>
            <input
              type="date"
              value={filters.dateEnd}
              onChange={(e) => setFilters({...filters, dateEnd: e.target.value})}
            />
          </div>
          <div>
            <label>Tipo de Viagem:</label>
            <select
              value={filters.tripType}
              onChange={(e) => setFilters({...filters, tripType: e.target.value})}
            >
              <option value="">Todos</option>
              <option value="Nacional">Nacional</option>
              <option value="Continental">Continental</option>
              <option value="Intercontinental">Intercontinental</option>
            </select>
          </div>
          <div>
            <label>Usuário:</label>
            <select
              value={filters.userId}
              onChange={(e) => setFilters({...filters, userId: e.target.value})}
            >
              <option value="">Todos</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Centro de Custo:</label>
            <select
              value={filters.costCenter}
              onChange={(e) => setFilters({...filters, costCenter: e.target.value})}
            >
              <option value="">Todos</option>
              {getUniqueValues(enrichedTrips, 'trip_reason').map(reason => (
                <option key={reason as string} value={reason as string}>
                  {reason as string}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Ano:</label>
            <select
              value={filters.year}
              onChange={(e) => setFilters({...filters, year: parseInt(e.target.value)})}
            >
              {Array.from(new Set(enrichedTrips.map(trip => {
                if (!trip.travel_date) return null
                return new Date(trip.travel_date).getFullYear()
              }).filter(Boolean))).sort((a, b) => (b as number) - (a as number)).map(year => (
                <option key={year as number} value={year as number}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Mês:</label>
            <select
              value={filters.month}
              onChange={(e) => setFilters({...filters, month: parseInt(e.target.value)})}
            >
              <option value={0}>Todos</option>
              {Array.from({length: 12}, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2024, i).toLocaleDateString('pt-BR', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button 
              className="btn btn-secondary"
              onClick={resetFilters}
              style={{ height: 'fit-content' }}
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* KPIs Principais */}
      <div style={{ marginBottom: '2rem' }}>
        <h3>KPIs Principais</h3>
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-value">{kpis.totalTrips}</div>
            <div className="kpi-label">Total de Viagens</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">R$ {formatCurrency(kpis.totalCost)}</div>
            <div className="kpi-label">Gasto Total</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">R$ {formatCurrency(kpis.avgCostPerTrip)}</div>
            <div className="kpi-label">Custo Médio por Viagem</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value" style={{color: kpis.budgetUtilization > 100 ? '#dc3545' : '#28a745'}}>
              {kpis.budgetUtilization.toFixed(1)}%
            </div>
            <div className="kpi-label">Utilização do Budget</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value" style={{color: kpis.savingsOrOverspend >= 0 ? '#28a745' : '#dc3545'}}>
              R$ {formatCurrency(Math.abs(kpis.savingsOrOverspend))}
            </div>
            <div className="kpi-label">{kpis.savingsOrOverspend >= 0 ? 'Economia' : 'Excesso'}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value">R$ {formatCurrency(kpis.mostExpensiveTrip)}</div>
            <div className="kpi-label">Viagem Mais Cara</div>
          </div>
        </div>
      </div>

      {/* Top Insights */}
      <div style={{ marginBottom: '2rem' }}>
        <h3>Principais Insights</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          <div className="kpi-card">
            <div style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              📍 Destino Mais Visitado
            </div>
            <div style={{ fontSize: '1.2rem', color: '#003366' }}>
              {kpis.topDestination}
            </div>
          </div>
          <div className="kpi-card">
            <div style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              🏢 Centro de Custo Top
            </div>
            <div style={{ fontSize: '1.2rem', color: '#003366' }}>
              {kpis.topCostCenter}
            </div>
          </div>
        </div>
      </div>

      {/* Comparativo Mensal: Budget vs Realizado */}
      {monthlyData.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3>Comparativo Mensal: Budget vs Realizado</h3>
          <div style={{ 
            background: 'white', 
            borderRadius: '12px', 
            padding: '1.5rem',
            border: '1px solid #e2e2e9',
            overflowX: 'auto'
          }}>
            <table style={{ width: '100%', minWidth: '600px' }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  <th>Mês</th>
                  <th>Budget</th>
                  <th>Realizado</th>
                  <th>Variação</th>
                  <th>% Budget</th>
                  <th>Nº Viagens</th>
                  <th>Gráfico</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((data) => {
                  const budgetPercent = data.budget > 0 ? (data.actual / data.budget) * 100 : 0
                  const isOverBudget = budgetPercent > 100
                  
                  return (
                    <tr key={data.month}>
                      <td style={{ fontWeight: 'bold' }}>{formatMonth(data.month)}</td>
                      <td>R$ {formatCurrency(data.budget)}</td>
                      <td>R$ {formatCurrency(data.actual)}</td>
                      <td style={{ color: data.variance >= 0 ? '#28a745' : '#dc3545', fontWeight: 'bold' }}>
                        {data.variance >= 0 ? '+' : ''}R$ {formatCurrency(data.variance)}
                      </td>
                      <td style={{ color: isOverBudget ? '#dc3545' : '#28a745', fontWeight: 'bold' }}>
                        {budgetPercent.toFixed(1)}%
                      </td>
                      <td>{data.trips}</td>
                      <td>
                        <div style={{ 
                          width: '100px', 
                          height: '20px', 
                          background: '#f0f0f0', 
                          borderRadius: '10px',
                          overflow: 'hidden',
                          position: 'relative'
                        }}>
                          <div style={{
                            width: `${Math.min(budgetPercent, 100)}%`,
                            height: '100%',
                            background: isOverBudget ? '#dc3545' : '#28a745',
                            borderRadius: '10px'
                          }} />
                          {isOverBudget && (
                            <div style={{
                              position: 'absolute',
                              top: '0',
                              right: '0',
                              width: '5px',
                              height: '100%',
                              background: '#dc3545'
                            }} />
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Viagens Filtradas */}
      <div>
        <h3>Viagens Filtradas ({filteredTrips.length})</h3>
        {filteredTrips.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
            <p>Nenhuma viagem encontrada com os filtros aplicados.</p>
            <button 
              className="btn btn-primary"
              onClick={resetFilters}
            >
              Limpar Filtros
            </button>
          </div>
        ) : (
          <div className="trips-grid">
            {filteredTrips.map((trip) => (
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
                    <div className="cost-value">R$ {formatCurrency(trip.cost_tickets || 0)}</div>
                  </div>
                  <div className="cost-item">
                    <div className="cost-label">Hospedagem</div>
                    <div className="cost-value">R$ {formatCurrency(trip.cost_lodging || 0)}</div>
                  </div>
                  <div className="cost-item">
                    <div className="cost-label">Diárias</div>
                    <div className="cost-value">R$ {formatCurrency(trip.cost_daily_allowances || 0)}</div>
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
    </div>
  )
}