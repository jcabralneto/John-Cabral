export interface UserProfile {
  id: string
  name: string
  email: string | null
  role: 'admin' | 'regular'
  created_at?: string
}

export interface Trip {
  id: string
  user_id: string | null
  travel_date: string | null
  destination_country: string | null
  destination_city: string | null
  cost_tickets: number | null
  cost_lodging: number | null
  cost_daily_allowances: number | null
  cost_center: string | null
  trip_type: string | null
  trip_reason: string | null
  created_at: string | null
  users?: {
    name: string
    email: string | null
  }
}

export interface Budget {
  id: string
  Data: string[] | null
  tipo_viagem: string | null
  budget_amount: number | null
  year: number | null
  month: number | null
  trip_type: string | null
}

export interface TripData {
  trip_date: string | null
  destination_country: string | null
  destination_city: string | null
  ticket_cost: number | null
  accommodation_cost: number | null
  daily_allowances: number | null
  trip_type: string | null
  trip_reason: string | null
}

export interface ChatMessage {
  type: 'user' | 'ai'
  content: string | 'confirmation'
  data?: TripData
  timestamp: Date
}

// Legacy types for backward compatibility
export interface LegacyTrip {
  id: string
  user_id: string
  trip_date: string | null
  destination_country: string | null
  destination_city: string | null
  ticket_cost: number | null
  accommodation_cost: number | null
  daily_allowances: number | null
  trip_type: string | null
  created_at: string
  profiles?: {
    email: string
  }
}