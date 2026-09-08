import { createClient } from '@supabase/supabase-js'
import { env } from './env'

function extractSupabaseUrl(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl)
    const host = url.hostname
    const projectRef = host.split('.')[0]
    return `https://${projectRef}.supabase.co`
  } catch {
    return ''
  }
}

const supabaseUrl = extractSupabaseUrl(env.DATABASE_URL)
const supabaseKey = env.SUPABASE_SERVICE_KEY

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null

export function getSupabaseAdmin() {
  if (!supabase) {
    throw new Error('Supabase não configurado. Verifique SUPABASE_SERVICE_KEY e DATABASE_URL')
  }
  return supabase
}