import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jfheipwozfewogwxuxqt.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmaGVpcHdvemZld29nd3h1eHF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NDg1MjQsImV4cCI6MjA2NTMyNDUyNH0.RQCcFUahD1MzzJJSh0jqMnSOFTwDq5y9Mzxr5JtheSY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const ADMIN_EMAIL = 'admin@gridspertise.com'