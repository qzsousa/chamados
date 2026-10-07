import { prisma } from '../config/prisma'

type TipoNotificacao =
  | 'CHAMADO_NOVO'
  | 'CHAMADO_RESPONDIDO'
  | 'CHAMADO_FINALIZADO'
  | 'CHAMADO_REABERTO'
  | 'CHAMADO_ATIVIDADE'
  | 'CHAMADO_APROVADO'
  | 'ERRO_SISTEMA'

/** Notificação para todos os ADMINs (usuarioId = null). */
export async function notificarAdmins(tipo: TipoNotificacao, titulo: string, mensagem: string, link?: string): Promise<void> {
  await prisma.notificacao.create({ data: { tipo, titulo, mensagem, link } })
}

/** Notificação para os usuários (gestor/visualizador) de uma unidade. */
export async function notificarUnidade(filial: string, tipo: TipoNotificacao, titulo: string, mensagem: string, link?: string): Promise<void> {
  if (!filial) return
  await prisma.notificacao.create({ data: { filial, tipo, titulo, mensagem, link } })
}

/** Notificação para um usuário específico. */
export async function notificarUsuario(usuarioId: string, tipo: TipoNotificacao, titulo: string, mensagem: string, link?: string): Promise<void> {
  await prisma.notificacao.create({ data: { usuarioId, tipo, titulo, mensagem, link } })
}

/**
 * Notificação para o técnico dono do chamado.
 *
 * A reabertura e a conferência pela escola precisam avisar QUEM executou o
 * serviço, e isso só é possível pelo `responsavelId` — o `responsavel` é nome,
 * e nome não identifica usuário (a lista de destino já devolve `nome`, não id).
 *
 * Chamado sem responsável conhecido cai para os admins, que veem tudo: melhor
 * um aviso duplicado do que um chamador que ninguém lê.
 */
export async function notificarTecnicoResponsavel(
  chamado: { id: string; responsavelId: string | null; responsavel: string | null },
  tipo: TipoNotificacao,
  titulo: string,
  mensagem: string,
  link?: string
): Promise<void> {
  if (chamado.responsavelId) {
    await notificarUsuario(chamado.responsavelId, tipo, titulo, mensagem, link)
    return
  }
  await notificarAdmins(tipo, titulo, mensagem, link)
}
