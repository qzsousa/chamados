import { createClient } from '@supabase/supabase-js'
import { env } from './env'

/**
 * Resolve a URL do projeto Supabase (`https://<ref>.supabase.co`) na ordem:
 *  1. SUPABASE_URL explícita (recomendado)
 *  2. claim `ref` do JWT da SUPABASE_SERVICE_KEY
 *  3. usuário do pooler (`postgres.<ref>`) na DATABASE_URL
 *  4. host da DATABASE_URL (funciona apenas com conexão direta db.<ref>.supabase.co)
 */
function resolveSupabaseUrl(databaseUrl: string, serviceKey?: string): string {
  if (env.SUPABASE_URL) return env.SUPABASE_URL

  if (serviceKey) {
    try {
      const payload = JSON.parse(Buffer.from(serviceKey.split('.')[1], 'base64').toString())
      if (payload?.ref) return `https://${payload.ref}.supabase.co`
    } catch {
      /* segue para a próxima heurística */
    }
  }

  try {
    const url = new URL(databaseUrl)
    const userRef = decodeURIComponent(url.username).split('.')[1]
    if (userRef) return `https://${userRef}.supabase.co`
  } catch {
    /* ignora */
  }

  try {
    const ref = new URL(databaseUrl).hostname.split('.')[0]
    if (ref) return `https://${ref}.supabase.co`
  } catch {
    /* ignora */
  }

  return ''
}

const supabaseUrl = resolveSupabaseUrl(env.DATABASE_URL, env.SUPABASE_SERVICE_KEY)
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
    throw new Error('Supabase não configurado. Verifique SUPABASE_URL/SUPABASE_SERVICE_KEY')
  }
  return supabase
}
