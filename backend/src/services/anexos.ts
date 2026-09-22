import { supabase } from '../config/supabase'

/**
 * Salva um anexo em base64 no bucket `anexos` do Supabase Storage e retorna a
 * URL pública. Retorna null quando o Supabase não está configurado ou o upload
 * falha — o chamador decide se segue sem o anexo (nunca salvamos URL quebrada).
 */
export async function salvarAnexo(base64: string, nome: string, tipo: string, pasta: string): Promise<string | null> {
  const safeNome = nome.replace(/[^\w.\-]/g, '_')
  if (!supabase) {
    console.error(`[anexo] Supabase Storage não configurado — anexo "${nome}" não persistido.`)
    return null
  }

  const filePath = `${pasta}/${Date.now()}_${safeNome}`
  const bytes = Buffer.from(base64, 'base64')

  try {
    const { error } = await supabase.storage.from('anexos').upload(filePath, bytes, {
      contentType: tipo || 'application/octet-stream',
      upsert: true
    })
    if (error) throw error
    const { data } = supabase.storage.from('anexos').getPublicUrl(filePath)
    return data.publicUrl
  } catch (err) {
    console.error(`[anexo] Falha ao enviar "${nome}" para o Supabase Storage:`, err)
    return null
  }
}
