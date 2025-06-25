import React from 'react'
import type { Trip } from '../types'

interface UserDashboardProps {
  trips: Trip[]
  setCurrentView: (view: 'chat') => void
}

export function UserDashboard({ trips, setCurrentView }: UserDashboardProps) {
  const formatCurrency = (value: number | null) => {
    if (!value) return '0,00'
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Data não informada'
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const calculateTotal = (trip: Trip) => {
    return (trip.cost_tickets || 0) + (trip.cost_lodging || 0) + (trip.cost_daily_allowances || 0)
  }

  if (trips.length === 0) {
    return (
      <div>
        <h2>Minhas Viagens</h2>
        <div className="empty-state">
          <p>Você ainda não tem viagens registradas.</p>
          <button 
            className="btn btn-primary"
            onClick={() => setCurrentView('chat')}
          >
            Registrar primeira viagem
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2>Minhas Viagens</h2>
      <div className="trips-grid">
        {trips.map((trip) => (
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
              <strong>Total: R$ {formatCurrency(calculateTotal(trip))}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}