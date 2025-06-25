import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jfheipwozfewogwxuxqt.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'

if (supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY') {
  console.warn('⚠️ ATENÇÃO: Configure sua chave anônima do Supabase no arquivo .env!')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const ADMIN_EMAIL = 'admin@gridspertise.com'