import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { env } from '../config/env'

let cachedClient: SupabaseClient | null | undefined

export function getSceSupabaseAdmin(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient
  const url = env.SCE_SUPABASE_URL
  const key = env.SCE_SUPABASE_SERVICE_KEY
  if (!url || !key) {
    cachedClient = null
    return cachedClient
  }
  cachedClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cachedClient
}

async function findAuthUserByEmail(admin: SupabaseClient, email: string): Promise<{ id: string } | null> {
  try {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error) return null
    const users = data?.users || []
    return users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase()) || null
  } catch {
    return null
  }
}

/**
 * Cria (ou atualiza a senha de) um usuário no Supabase Auth do projeto SCE.
 * Usado na migração lazy: quem loga com sucesso no chamados passa a existir
 * também no SCE com a mesma senha. Nunca lança — falhas são apenas logadas.
 */
export async function upsertSceAuthUser(
  email: string,
  password: string,
  usuario: { nome: string; nivel: string; filial: string },
): Promise<boolean> {
  if (!env.MIGRAR_USUARIOS_PARA_SCE) return false
  const admin = getSceSupabaseAdmin()
  if (!admin) return false

  const emailNorm = email.toLowerCase()
  try {
    const existing = await findAuthUserByEmail(admin, emailNorm)
    if (existing) {
      const { error } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      })
      if (error) {
        console.warn(`[sceAuth] falha ao atualizar senha para ${emailNorm}: ${error.message}`)
        return false
      }
    } else {
      const { error } = await admin.auth.admin.createUser({
        email: emailNorm,
        password,
        email_confirm: true,
        user_metadata: { nome: usuario.nome, nivel: usuario.nivel, filial: usuario.filial },
      })
      if (error) {
        console.warn(`[sceAuth] falha ao criar usuário para ${emailNorm}: ${error.message}`)
        return false
      }
    }

    // Marca a flag senha_definida na tabela usuarios do SCE.
    try {
      await admin.from('usuarios').update({ senha_definida: true }).eq('email', emailNorm)
    } catch (err) {
      console.warn(`[sceAuth] falha ao marcar senha_definida para ${emailNorm}:`, err)
    }
    return true
  } catch (err) {
    console.warn(`[sceAuth] erro inesperado para ${emailNorm}:`, err)
    return false
  }
}