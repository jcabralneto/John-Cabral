import { supabase } from '../lib/supabase'
import type { UserProfile, Trip, Budget } from '../types'

export class DatabaseService {
  // Get or create user profile with proper error handling
  static async getOrCreateUserProfile(userId: string, email: string): Promise<UserProfile | null> {
    try {
      console.log('🔄 Getting/creating profile for:', email)

      // First, try to get existing profile by user ID (primary key)
      const { data: existingProfile, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (existingProfile && !fetchError) {
        console.log('✅ Existing profile found by ID')
        
        // Update email if it's different and not null
        if (existingProfile.email !== email && email) {
          // Check if another profile already has this email
          const { data: emailConflict } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .neq('id', userId)
            .maybeSingle()

          if (!emailConflict) {
            const { data: updatedProfile, error: updateError } = await supabase
              .from('users')
              .update({ email: email })
              .eq('id', userId)
              .select()
              .single()
            
            if (updateError) {
              // Handle specific duplicate key constraint violation
              if (updateError.code === '23505' && updateError.message?.includes('users_email_unique_not_null')) {
                console.warn('⚠️ Email already exists for another user (constraint violation), keeping current profile')
                return existingProfile
              }
              
              console.error('❌ Error updating profile email:', updateError)
              return existingProfile // Return existing profile even if update fails
            }
            
            console.log('✅ Profile email updated successfully')
            return updatedProfile
          } else {
            console.log('⚠️ Email already exists for another user, keeping current profile')
          }
        }
        
        return existingProfile
      }

      // If no profile found by ID, check if one exists by email
      if (email) {
        const { data: profileByEmail, error: emailError } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .maybeSingle()

        if (profileByEmail && !emailError) {
          console.log('✅ Existing profile found by email')
          
          // If the profile has a different ID, we cannot update it due to primary key constraints
          // Instead, we'll create a new profile with a different approach
          if (profileByEmail.id !== userId) {
            console.log('⚠️ Profile exists with different ID, cannot merge profiles')
            
            // Try to create new profile without email to avoid constraint violation
            const newProfileData = {
              id: userId,
              name: email ? email.split('@')[0] : 'User',
              email: null, // Set email to null to avoid constraint violation
              role: 'regular' as const
            }

            const { data: newProfile, error: insertError } = await supabase
              .from('users')
              .insert(newProfileData)
              .select()
              .single()

            if (insertError) {
              console.error('❌ Error creating profile without email:', insertError)
              return null
            }

            console.log('✅ Profile created without email to avoid conflict')
            return newProfile
          }
          
          return profileByEmail
        }
      }

      console.log('ℹ️ Profile not found, creating new one...')

      // Create new profile
      const newProfileData = {
        id: userId,
        name: email ? email.split('@')[0] : 'User',
        email: email,
        role: email === 'admin@gridspertise.com' ? 'admin' as const : 'regular' as const
      }

      const { data: newProfile, error: insertError } = await supabase
        .from('users')
        .insert(newProfileData)
        .select()
        .single()

      if (insertError) {
        console.error('❌ Error inserting profile:', insertError)
        
        // If it's a duplicate key error, try to fetch the existing profile
        if (insertError.code === '23505') {
          console.log('🔄 Duplicate detected, fetching existing profile...')
          
          // Try to find by ID first
          const { data: existingById } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle()
          
          if (existingById) {
            console.log('✅ Retrieved existing profile by ID after duplicate error')
            return existingById
          }

          // If not found by ID, try by email
          if (email) {
            const { data: existingByEmail } = await supabase
              .from('users')
              .select('*')
              .eq('email', email)
              .maybeSingle()
            
            if (existingByEmail) {
              console.log('✅ Retrieved existing profile by email after duplicate error')
              return existingByEmail
            }
          }

          // If email constraint is the issue, try creating without email
          if (insertError.message?.includes('users_email_unique_not_null')) {
            console.log('🔄 Email constraint violation, creating profile without email')
            
            const profileWithoutEmail = {
              id: userId,
              name: email ? email.split('@')[0] : 'User',
              email: null,
              role: 'regular' as const
            }

            const { data: profileNoEmail, error: noEmailError } = await supabase
              .from('users')
              .insert(profileWithoutEmail)
              .select()
              .single()

            if (noEmailError) {
              console.error('❌ Error creating profile without email:', noEmailError)
              return null
            }

            console.log('✅ Profile created without email due to constraint')
            return profileNoEmail
          }
        }
        
        return null
      }

      console.log('✅ Profile created successfully')
      return newProfile

    } catch (error) {
      console.error('❌ Error in getOrCreateUserProfile:', error)
      return null
    }
  }

  // Fetch users from the users table with better error handling
  static async fetchUsers(): Promise<UserProfile[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name')

      if (error) {
        console.error('❌ Error fetching users:', error)
        
        // If it's a permission error, return empty array gracefully
        if (error.code === '42501') {
          console.warn('⚠️ Permission denied for users table, returning empty array')
          return []
        }
        
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
        *
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

  // Fetch user details for trips separately to avoid permission issues
  static async enrichTripsWithUserData(trips: Trip[]): Promise<Trip[]> {
    try {
      const userIds = [...new Set(trips.map(trip => trip.user_id).filter(Boolean))]
      
      if (userIds.length === 0) {
        return trips
      }

      const { data: users, error } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds)

      if (error) {
        console.warn('⚠️ Could not fetch user details:', error)
        return trips
      }

      const userMap = new Map(users?.map(user => [user.id, user]) || [])

      return trips.map(trip => ({
        ...trip,
        users: trip.user_id ? userMap.get(trip.user_id) : undefined
      }))
    } catch (error) {
      console.warn('⚠️ Error enriching trips with user data:', error)
      return trips
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