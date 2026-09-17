import { env } from '../config/env'

/**
 * Sincroniza um usuário do sistema de chamados para o SCE (equipamentos).
 * O SCE mantém sua própria tabela `usuarios` como autoridade local de
 * nível/filial, resolvendo o usuário pelo e-mail (SSO do portal).
 *
 * Nunca lança erro — falhas são apenas logadas (o sync será feito de novo
 * na próxima edição do usuário ou pela reconciliação em lote).
 */
export async function syncUsuarioParaSce(usuario: {
  email: string
  nome: string
  nivel: string
  filial: string
  status: string
}): Promise<void> {
  if (!env.SCE_API_URL || !env.SCE_SYNC_KEY) return

  try {
    const res = await fetch(`${env.SCE_API_URL}/api/internal/sync-usuario`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-key': env.SCE_SYNC_KEY,
      },
      body: JSON.stringify({
        email: usuario.email.toLowerCase(),
        nome: usuario.nome,
        nivel: usuario.nivel,
        filial: usuario.filial,
        status: usuario.status,
      }),
    })

    if (!res.ok && res.status !== 200) {
      const body = await res.text().catch(() => '')
      console.warn(`[sceSync] resposta inesperada (${res.status}) para ${usuario.email}: ${body.slice(0, 200)}`)
    }
  } catch (err) {
    console.warn(`[sceSync] falha ao chamar SCE para ${usuario.email}:`, err)
  }
}
