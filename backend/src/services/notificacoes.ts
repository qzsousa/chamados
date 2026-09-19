import { prisma } from '../config/prisma'

type TipoNotificacao = 'CHAMADO_NOVO' | 'CHAMADO_RESPONDIDO' | 'CHAMADO_FINALIZADO' | 'ERRO_SISTEMA'

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
