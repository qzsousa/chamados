import { supabase } from '../config/supabase'
import { prisma } from '../config/prisma'
import { ANEXO_EXTENSOES, bytesDoBase64, ANEXO_MAX_BYTES, extensaoDe, mimeSeguroDe } from '@shared/api'

export interface AnexoSalvo {
  url: string
  path: string // path interno no bucket `anexos` (necessário para remoção futura)
}

/**
 * Deixa o nome seguro para o bucket.
 *
 * A versão anterior (`replace(/[^\w.\-]/g, '_')`) preservava o ponto, o que
 * deixava `x.html` e `x.svg` atravessarem — num bucket PÚBLICO, um SVG servido
 * como `text/html` é XSS servido do nosso domínio. Aqui o nome perde qualquer
 * caractere fora de letra/número/ponto/hífen e, se a extensão não estiver na
 * allowlist, o arquivo é renomeado para `.bin` (o conteúdo deixa de ser
 * interpretado pelo navegador). É a última linha: quem deve recusar com 400
 * nomeando o arquivo é o schema, antes de chegar aqui.
 */
function nomeSeguro(nome: string): string {
  const limpo = nome.replace(/[^\w.\-]/g, '_').replace(/^\.+/, '') || 'anexo'
  const ext = extensaoDe(limpo)
  if (ext && ANEXO_EXTENSOES.includes(ext)) return limpo
  return `${limpo}.bin`
}

/**
 * Salva um anexo em base64 no bucket `anexos` do Supabase Storage e retorna a
 * URL pública. Retorna null quando o Supabase não está configurado, o arquivo
 * estourou o limite ou o upload falha — o chamador decide se segue sem o anexo
 * (nunca salvamos URL quebrada).
 */
export async function salvarAnexo(base64: string, nome: string, tipo: string, pasta: string): Promise<string | null> {
  const salvo = await salvarAnexoComPath(base64, nome, tipo, pasta)
  return salvo?.url ?? null
}

/** Igual ao salvarAnexo, mas retorna também o path interno do bucket. */
export async function salvarAnexoComPath(base64: string, nome: string, tipo: string, pasta: string): Promise<AnexoSalvo | null> {
  if (bytesDoBase64(base64) > ANEXO_MAX_BYTES) {
    console.error(`[anexo] "${nome}" acima do limite — não persistido.`)
    return null
  }

  const safeNome = nomeSeguro(nome)
  if (!supabase) {
    console.error(`[anexo] Supabase Storage não configurado — anexo "${nome}" não persistido.`)
    return null
  }

  const filePath = `${pasta}/${Date.now()}_${safeNome}`
  const bytes = Buffer.from(base64, 'base64')

  try {
    const { error } = await supabase.storage.from('anexos').upload(filePath, bytes, {
      // Content type SEMPRE derivado da extensão, nunca do `tipo` cru do
      // cliente: era por ele que HTML/SVG entravam servidos como text/html.
      contentType: mimeSeguroDe(safeNome, tipo),
      upsert: true
    })
    if (error) throw error
    const { data } = supabase.storage.from('anexos').getPublicUrl(filePath)
    return { url: data.publicUrl, path: filePath }
  } catch (err) {
    console.error(`[anexo] Falha ao enviar "${nome}" para o Supabase Storage:`, err)
    return null
  }
}

/**
 * Remove anexos temporários (perguntas/respostas de chamados) cuja validade de
 * 7 dias expirou: apaga o arquivo no Storage e o registro no banco.
 * Executada periodicamente pelo agendador em index.ts. Retorna quantos foram removidos.
 */
export async function limparAnexosTemporariosExpirados(): Promise<number> {
  const expirados = await prisma.chamadoMensagemAnexo.findMany({
    where: { expiresAt: { lt: new Date() } },
    select: { id: true, path: true, nome: true }
  })
  if (expirados.length === 0) return 0

  if (supabase) {
    try {
      await supabase.storage.from('anexos').remove(expirados.map((a) => a.path))
    } catch (err) {
      console.error('[anexo] Falha ao remover anexos temporários expirados do Storage:', err)
    }
  }

  await prisma.chamadoMensagemAnexo.deleteMany({ where: { id: { in: expirados.map((a) => a.id) } } })
  return expirados.length
}
