import React from 'react'
import type { Trip } from '../types'

interface AdminDashboardProps {
  allTrips: Trip[]
}

export function AdminDashboard({ allTrips }: AdminDashboardProps) {
  const formatCurrency = (value: number | null) => {
    if (!value) return '0,00'
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Data não informada'
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const calculateTotal = (trip: Trip) => {
    return (trip.ticket_cost || 0) + (trip.accommodation_cost || 0) + (trip.daily_allowances || 0)
  }

  const calculateKPIs = () => {
    const totalTrips = allTrips.length
    const totalCost = allTrips.reduce((sum, trip) => {
      return sum + calculateTotal(trip)
    }, 0)

    return { totalTrips, totalCost }
  }

  const { totalTrips, totalCost } = calculateKPIs()

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
      </div>

      <h3>Todas as Viagens</h3>
      {allTrips.length === 0 ? (
        <p style={{textAlign: 'center', color: '#666', padding: '2rem'}}>
          Nenhuma viagem registrada ainda.
        </p>
      ) : (
        <div className="trips-grid">
          {allTrips.map((trip) => (
            <div key={trip.id} className="trip-card">
              <div className="trip-header">
                <span className="trip-type">{trip.trip_type}</span>
              </div>
              <div style={{fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem'}}>
                👤 {trip.profiles?.email || 'Email não encontrado'}
              </div>
              <div className="trip-destination">
                📍 {trip.destination_city}, {trip.destination_country}
              </div>
              <div className="trip-date">
                📅 {formatDate(trip.trip_date)}
              </div>
              <div className="trip-costs">
                <div className="cost-item">
                  <div className="cost-label">Passagem</div>
                  <div className="cost-value">R$ {formatCurrency(trip.ticket_cost)}</div>
                </div>
                <div className="cost-item">
                  <div className="cost-label">Hospedagem</div>
                  <div className="cost-value">R$ {formatCurrency(trip.accommodation_cost)}</div>
                </div>
                <div className="cost-item">
                  <div className="cost-label">Diárias</div>
                  <div className="cost-value">R$ {formatCurrency(trip.daily_allowances)}</div>
                </div>
              </div>
              <div style={{
                textAlign: 'center', 
                marginTop: '1rem', 
                padding: '0.5rem', 
                background: '#f8f9fa', 
                borderRadius: '8px'
              }}>
                <strong>Total: R$ {formatCurrency(calculateTotal(trip))}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}