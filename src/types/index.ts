export interface UserProfile {
  id: string
  email: string
  role: 'admin' | 'regular'
  created_at: string
}

export interface Trip {
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

export interface TripData {
  trip_date: string | null
  destination_country: string | null
  destination_city: string | null
  ticket_cost: number | null
  accommodation_cost: number | null
  daily_allowances: number | null
  trip_type: string | null
}

export interface ChatMessage {
  type: 'user' | 'ai'
  content: string | 'confirmation'
  data?: TripData
  timestamp: Date
}