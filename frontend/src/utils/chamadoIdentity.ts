// ============================================================
// Identidade visual e parser de histórico dos chamados.
// FONTE ÚNICA DE VERDADE para cores/ícones de status e categoria
// em todas as telas (tabela, kanban, gráficos, formulários).
// Não duplique esses valores em componentes/views.
// ============================================================

import type { StatusChamado } from '../../../shared/types/api'

// ---------- STATUS ----------

export interface StatusMeta {
  label: string
  cor: string
}

export const STATUS_META: Record<StatusChamado, StatusMeta> = {
  ABERTO:     { label: 'Aberto',       cor: '#eab308' },
  ANDAMENTO:  { label: 'Em andamento', cor: '#3b82f6' },
  COMUNICADO: { label: 'Comunicado',   cor: '#f59e0b' },
  RESOLVIDO:  { label: 'Resolvido',    cor: '#10b981' }
}

export const STATUS_ORDEM: StatusChamado[] = ['ABERTO', 'ANDAMENTO', 'COMUNICADO', 'RESOLVIDO']

const STATUS_FALLBACK = '#64748b'

export function corStatus(status: string | null | undefined): string {
  return (status && STATUS_META[status as StatusChamado]?.cor) || STATUS_FALLBACK
}

export function labelStatus(status: string | null | undefined): string {
  return (status && STATUS_META[status as StatusChamado]?.label) || status || '—'
}

// ---------- CATEGORIA ----------

export type CategoriaId = 'REDE' | 'EQUIPAMENTO' | 'SISTEMA' | 'EMAIL' | 'OUTRO'

export interface CategoriaMeta {
  id: CategoriaId
  label: string
  cor: string
  /** Conteúdo interno do SVG (viewBox 0 0 24 24, stroke). */
  icon: string
}

export const CATEGORIA_META: Record<CategoriaId, CategoriaMeta> = {
  REDE: {
    id: 'REDE',
    label: 'Rede',
    cor: '#38bdf8',
    icon: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>'
  },
  EQUIPAMENTO: {
    id: 'EQUIPAMENTO',
    label: 'Equipamento',
    cor: '#34d399',
    icon: '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'
  },
  SISTEMA: {
    id: 'SISTEMA',
    label: 'Sistema',
    cor: '#a78bfa',
    icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'
  },
  EMAIL: {
    id: 'EMAIL',
    label: 'E-mail',
    cor: '#fb923c',
    icon: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>'
  },
  OUTRO: {
    id: 'OUTRO',
    label: 'Outro',
    cor: '#94a3b8',
    icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
  }
}

export const CATEGORIA_ORDEM: CategoriaId[] = ['REDE', 'EQUIPAMENTO', 'SISTEMA', 'EMAIL', 'OUTRO']

/** Normaliza texto livre para comparação (minúsculas, sem acento). */
function normalizar(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Mapeia o `tipo` livre do chamado para uma categoria canônica.
 * Tolera variantes atuais ('Problema de Rede') e legadas ('Hardware', 'Software').
 */
export function matchCategoria(tipo: string | null | undefined): CategoriaMeta {
  const t = normalizar(tipo || '')
  if (!t) return CATEGORIA_META.OUTRO
  if (/e-?mail|correio/.test(t)) return CATEGORIA_META.EMAIL
  if (/rede|wi-?fi|internet|conexao/.test(t)) return CATEGORIA_META.REDE
  if (/equip|hardware|notebook|computador|impressora|tablet/.test(t)) return CATEGORIA_META.EQUIPAMENTO
  if (/sistema|software|portalnet|\bsce\b|\bsci\b/.test(t)) return CATEGORIA_META.SISTEMA
  return CATEGORIA_META.OUTRO
}

// ---------- RESPONSÁVEIS ----------

/** Lista usada no select "Responsável pelo atendimento" da edição inline. */
export const RESPONSAVEIS = ['JOÃO', 'CHARLES', 'HERBERT', 'JOSEMIR', 'CAROL', 'GUILHERME', 'VALDEIR', 'JESSICA', 'MATHEUS', 'FABIO', 'PABLO', 'FERNANDA']

// ---------- HISTÓRICO (parser do texto livre) ----------

export type TipoEventoHistorico = 'criacao' | 'status' | 'resposta' | 'info'

export interface HistoricoEvento {
  tipo: TipoEventoHistorico
  /** Data parseada (pt-BR) ou null quando a linha não traz data reconhecível. */
  data: Date | null
  /** Data original em texto (ex.: '16/09/2026 10:00:00'), '' quando ausente. */
  dataStr: string
  /** Texto legível do evento (sem o prefixo de data). */
  texto: string
  /** Status destino quando tipo === 'status'. */
  statusNovo?: StatusChamado
  /** Autor do evento (quando identificado). */
  autor?: string
}

/** Converte 'dd/mm/aaaa[, ]hh:mm[:ss]' em Date. Retorna null se não casar. */
export function parseDataPtBR(s: string): Date | null {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})[,\s]+(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6] || 0))
  return isNaN(d.getTime()) ? null : d
}

const RE_LINHA_DATADA = /^\[(.+?)]\s*(.+)$/
const RE_CRIACAO = /^Chamado criado em\s+(.+)$/i
const RE_STATUS = /Status alterado para\s*"([^"]+)"\s*por\s*([^(]+?)(?:\s*\(t[eé]cnico:\s*([^)]+)\))?\s*$/
const RE_RESPOSTA = /^([^:]{1,60}):\s+([\s\S]+)$/

function classificarStatus(valor: string): StatusChamado | undefined {
  const v = valor.trim().toUpperCase().replace(/\s+/g, '_')
  return (STATUS_ORDEM as string[]).includes(v) ? (v as StatusChamado) : undefined
}

/**
 * Converte o campo `historico` (texto livre, uma linha por evento) em eventos.
 * Defensivo por design: linhas fora dos formatos conhecidos viram tipo 'info'
 * e nunca quebram a timeline (dados legados vêm do Google Sheets).
 */
export function parseHistorico(historico: string | null | undefined): HistoricoEvento[] {
  if (!historico) return []
  return historico
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((linha): HistoricoEvento => {
      const criacao = linha.match(RE_CRIACAO)
      if (criacao) {
        return { tipo: 'criacao', data: parseDataPtBR(criacao[1]), dataStr: criacao[1].trim(), texto: 'Chamado criado' }
      }
      const datada = linha.match(RE_LINHA_DATADA)
      const dataStr = datada ? datada[1] : ''
      const resto = datada ? datada[2] : linha
      const data = dataStr ? parseDataPtBR(dataStr) : null

      const st = resto.match(RE_STATUS)
      if (st) {
        const tecnico = st[3]?.trim()
        return {
          tipo: 'status',
          data,
          dataStr,
          texto: `Status alterado para "${st[1]}" por ${st[2].trim()}`,
          statusNovo: classificarStatus(st[1]),
          autor: tecnico || st[2].trim()
        }
      }
      const resp = resto.match(RE_RESPOSTA)
      if (resp && !/^Descri[cç][aã]o da resolu[cç][aã]o\s*:/i.test(resto)) {
        return { tipo: 'resposta', data, dataStr, texto: resp[2].trim(), autor: resp[1].trim() }
      }
      return { tipo: datada ? 'resposta' : 'info', data, dataStr, texto: resto }
    })
}
