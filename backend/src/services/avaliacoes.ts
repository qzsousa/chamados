import { prisma } from '../config/prisma'

export interface ResumoAvaliacoes {
  /** Quantidade de avaliações registradas. */
  total: number
  /** Média das notas (0..5) ou `null` quando ninguém avaliou. */
  media: number | null
  /** chaves '1'..'5' → quantidade de avaliações com aquela nota */
  porNota: Record<string, number>
}

/**
 * Consolida as notas de atendimento em uma única leitura.
 *
 * Serve à tela autenticada (`GET /feedback/stats`) e ao painel público do
 * dirigente (`GET /dashboard/matriz`): as duas precisam do mesmo número, e a
 * consulta direta ao banco não é cara o bastante para justificar dois lugares.
 */
export async function resumoAvaliacoes(): Promise<ResumoAvaliacoes> {
  const porNotaCount = await prisma.avaliacao.groupBy({ by: ['nota'], _count: true })

  const porNota: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
  let total = 0
  let soma = 0
  for (const a of porNotaCount) {
    porNota[String(a.nota)] = a._count
    total += a._count
    soma += a.nota * a._count
  }

  return {
    total,
    media: total ? Math.round((soma / total) * 100) / 100 : null,
    porNota,
  }
}