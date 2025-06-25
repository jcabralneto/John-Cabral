import { supabase } from '../lib/supabase'
import type { UserProfile, Trip, Budget } from '../types'

export class DatabaseService {
  // Fetch users from the correct table
  static async fetchUsers(): Promise<UserProfile[]> {
    try {
      console.log('📊 Buscando usuários...')
      
      // Try the 'users' table first (current schema)
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('name')

      if (!usersError && usersData) {
        console.log('✅ Loaded users from "users" table:', usersData.length)
        return usersData
      }

      console.warn('⚠️ Erro ao carregar usuários:', usersError)
      return []
    } catch (error) {
      console.error('❌ Error fetching users:', error)
      return []
    }
  }

  // Fetch trips from the correct table
  static async fetchTrips(userId?: string, isAdmin = false): Promise<Trip[]> {
    try {
      console.log('🧳 Buscando viagens...', { userId, isAdmin })
      
      let query = supabase.from('trips').select(`
        *,
        users:user_id (name, email)
      `)

      if (!isAdmin && userId) {
        query = query.eq('user_id', userId)
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(100) // Add limit to prevent large queries

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

  // Fetch budgets
  static async fetchBudgets(): Promise<Budget[]> {
    try {
      console.log('💰 Buscando orçamentos...')
      
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(50) // Add limit

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

  // Check database tables availability
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
      console.log('🔍 Verificando tabelas do banco...')
      
      // Check users table
      try {
        const { error: usersError } = await supabase
          .from('users')
          .select('id')
          .limit(1)
        results.users = !usersError
      } catch (e) {
        results.users = false
      }

      // Check trips table
      try {
        const { error: tripsError } = await supabase
          .from('trips')
          .select('id')
          .limit(1)
        results.trips = !tripsError
      } catch (e) {
        results.trips = false
      }

      // Check budgets table
      try {
        const { error: budgetsError } = await supabase
          .from('budgets')
          .select('id')
          .limit(1)
        results.budgets = !budgetsError
      } catch (e) {
        results.budgets = false
      }

      // Check legacy tables
      try {
        const { error: legacyError } = await supabase
          .from('paises')
          .select('id')
          .limit(1)
        results.legacy = !legacyError
      } catch (e) {
        results.legacy = false
      }

      console.log('📊 Database tables status:', results)
      return results
    } catch (error) {
      console.error('❌ Error checking database tables:', error)
      return results
    }
  }
}