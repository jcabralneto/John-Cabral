import { supabase } from '../lib/supabase'
import type { UserProfile, Trip, Budget } from '../types'

export class DatabaseService {
  // Get or create user profile with proper error handling
  static async getOrCreateUserProfile(userId: string, email: string): Promise<UserProfile | null> {
    try {
      console.log('🔄 Getting/creating profile for:', email)

      // First, try to get existing profile from users table
      const { data: existingProfile, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (existingProfile && !fetchError) {
        console.log('✅ Existing profile found')
        return existingProfile
      }

      console.log('ℹ️ Profile not found, creating new one...')

      // Create new profile
      const newProfileData = {
        id: userId,
        name: email.split('@')[0],
        email: email,
        role: email === 'admin@gridspertise.com' ? 'admin' as const : 'regular' as const
      }

      const { data: newProfile, error: insertError } = await supabase
        .from('users')
        .insert([newProfileData])
        .select()
        .single()

      if (insertError) {
        console.error('❌ Error creating profile:', insertError)
        
        // Try upsert as fallback
        const { data: upsertProfile, error: upsertError } = await supabase
          .from('users')
          .upsert(newProfileData, { onConflict: 'id' })
          .select()
          .single()

        if (upsertError) {
          console.error('❌ Error upserting profile:', upsertError)
          return null
        }

        console.log('✅ Profile upserted successfully')
        return upsertProfile
      }

      console.log('✅ Profile created successfully')
      return newProfile

    } catch (error) {
      console.error('❌ Error in getOrCreateUserProfile:', error)
      return null
    }
  }

  // Fetch users from the users table
  static async fetchUsers(): Promise<UserProfile[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name')

      if (error) {
        console.error('❌ Error fetching users:', error)
        return []
      }

      console.log('✅ Loaded users:', data?.length || 0)
      return data || []
    } catch (error) {
      console.error('❌ Error fetching users:', error)
      return []
    }
  }

  // Fetch trips with proper error handling and timeout
  static async fetchTrips(userId?: string, isAdmin = false): Promise<Trip[]> {
    try {
      console.log('🔄 Fetching trips for user:', userId, 'isAdmin:', isAdmin)

      let query = supabase.from('trips').select(`
        *,
        users:user_id (name, email)
      `)

      if (!isAdmin && userId) {
        query = query.eq('user_id', userId)
      }

      // Add timeout to prevent hanging
      const queryPromise = query.order('created_at', { ascending: false })
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Trips query timeout')), 8000)
      )

      const { data, error } = await Promise.race([queryPromise, timeoutPromise])

      if (error) {
        console.error('❌ Error fetching trips:', error)
        return []
      }

      console.log('✅ Loaded trips:', data?.length || 0)
      return data || []
    } catch (error) {
      console.error('❌ Error fetching trips:', error)
      return []
    }
  }

  // Fetch budgets with timeout
  static async fetchBudgets(): Promise<Budget[]> {
    try {
      const queryPromise = supabase
        .from('budgets')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false })

      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Budgets query timeout')), 5000)
      )

      const { data, error } = await Promise.race([queryPromise, timeoutPromise])

      if (error) {
        console.error('❌ Error fetching budgets:', error)
        return []
      }

      console.log('✅ Loaded budgets:', data?.length || 0)
      return data || []
    } catch (error) {
      console.error('❌ Error fetching budgets:', error)
      return []
    }
  }

  // Get budget summary by trip type
  static async getBudgetSummary(): Promise<{
    totalBudget: number
    budgetByType: Record<string, number>
    budgetByYear: Record<number, number>
  }> {
    try {
      const budgets = await this.fetchBudgets()
      
      const totalBudget = budgets.reduce((sum, budget) => sum + (budget.budget_amount || 0), 0)
      
      const budgetByType = budgets.reduce((acc, budget) => {
        const type = budget.trip_type || 'Unknown'
        acc[type] = (acc[type] || 0) + (budget.budget_amount || 0)
        return acc
      }, {} as Record<string, number>)

      const budgetByYear = budgets.reduce((acc, budget) => {
        const year = budget.year || new Date().getFullYear()
        acc[year] = (acc[year] || 0) + (budget.budget_amount || 0)
        return acc
      }, {} as Record<number, number>)

      return { totalBudget, budgetByType, budgetByYear }
    } catch (error) {
      console.error('❌ Error calculating budget summary:', error)
      return { totalBudget: 0, budgetByType: {}, budgetByYear: {} }
    }
  }

  // Check database tables availability with timeout
  static async checkDatabaseTables(): Promise<{
    users: boolean
    trips: boolean
    budgets: boolean
    legacy: boolean
  }> {
    const results = {
      users: false,
      trips: false,
      budgets: false,
      legacy: false
    }

    try {
      // Create timeout for each check
      const createTimeoutPromise = (ms: number) => new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Database check timeout')), ms)
      )

      // Check users table
      try {
        const usersPromise = supabase.from('users').select('id').limit(1)
        await Promise.race([usersPromise, createTimeoutPromise(3000)])
        results.users = true
      } catch (error) {
        console.warn('Users table check failed:', error)
      }

      // Check trips table
      try {
        const tripsPromise = supabase.from('trips').select('id').limit(1)
        await Promise.race([tripsPromise, createTimeoutPromise(3000)])
        results.trips = true
      } catch (error) {
        console.warn('Trips table check failed:', error)
      }

      // Check budgets table
      try {
        const budgetsPromise = supabase.from('budgets').select('id').limit(1)
        await Promise.race([budgetsPromise, createTimeoutPromise(3000)])
        results.budgets = true
      } catch (error) {
        console.warn('Budgets table check failed:', error)
      }

      // Check legacy tables (paises table as indicator)
      try {
        const legacyPromise = supabase.from('paises').select('id').limit(1)
        await Promise.race([legacyPromise, createTimeoutPromise(3000)])
        results.legacy = true
      } catch (error) {
        console.warn('Legacy tables check failed:', error)
      }

      console.log('📊 Database tables status:', results)
      return results
    } catch (error) {
      console.error('❌ Error checking database tables:', error)
      return results
    }
  }
}