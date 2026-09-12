import { z } from 'zod'

// ============================================
// ENUMS
// ============================================

export const NivelSchema = z.enum(['ADMIN', 'TECNICO', 'GESTOR', 'VISUALIZADOR'])
export const StatusUsuarioSchema = z.enum(['ATIVO', 'INATIVO'])
export const StatusChamadoSchema = z.enum(['ABERTO', 'ANDAMENTO', 'COMUNICADO', 'RESOLVIDO'])
export const InventarioStatusSchema = z.enum(['CONCLUIDO', 'EM_ANDAMENTO', 'NAO_REALIZADO', 'NAO_INFORMADO'])

export type Nivel = z.infer<typeof NivelSchema>
export type StatusUsuario = z.infer<typeof StatusUsuarioSchema>
export type StatusChamado = z.infer<typeof StatusChamadoSchema>
export type InventarioStatus = z.infer<typeof InventarioStatusSchema>

// ============================================
// USER
// ============================================

export const UserSchema = z.object({
  id: z.string().cuid(),
  email: z.string().email(),
  nome: z.string(),
  nivel: NivelSchema,
  filial: z.string(),
  status: StatusUsuarioSchema,
  primeiroLogin: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export type User = z.infer<typeof UserSchema>

export const UserCreateSchema = z.object({
  email: z.string().email(),
  nome: z.string().min(1),
  nivel: NivelSchema,
  filial: z.string().min(1)
})

export type UserCreate = z.infer<typeof UserCreateSchema>

export const UserUpdateSchema = z.object({
  nome: z.string().min(1).optional(),
  nivel: NivelSchema.optional(),
  filial: z.string().min(1).optional(),
  status: StatusUsuarioSchema.optional()
})

export type UserUpdate = z.infer<typeof UserUpdateSchema>

export const UserWithTempPasswordSchema = UserSchema.extend({
  senhaTemporaria: z.string()
})

export type UserWithTempPassword = z.infer<typeof UserWithTempPasswordSchema>

// ============================================
// AUTH
// ============================================

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1)
})

export type LoginRequest = z.infer<typeof LoginRequestSchema>

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: UserSchema,
  primeiroLogin: z.boolean()
})

export type LoginResponse = z.infer<typeof LoginResponseSchema>

export const ChangePasswordSchema = z.object({
  senhaAtual: z.string().min(1),
  novaSenha: z.string().min(8).max(128)
})

export type ChangePassword = z.infer<typeof ChangePasswordSchema>

export const GerarSenhaTemporariaSchema = z.object({
  email: z.string().email()
})

export type GerarSenhaTemporaria = z.infer<typeof GerarSenhaTemporariaSchema>

export const GerarSenhaTemporariaResponseSchema = z.object({
  senhaTemporaria: z.string()
})

export type GerarSenhaTemporariaResponse = z.infer<typeof GerarSenhaTemporariaResponseSchema>

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().optional()
})

export type RefreshRequest = z.infer<typeof RefreshRequestSchema>

// ============================================
// CHAMADO
// ============================================

export const ChamadoSchema = z.object({
  id: z.string().cuid(),
  protocolo: z.string(),
  timestamp: z.string().datetime(),
  unidade: z.string(),
  solicitante: z.string(),
  funcao: z.string().nullable(),
  tipo: z.string(),
  descricao: z.string(),
  urgencia: z.string(),
  anexoUrl: z.string().nullable(),
  status: StatusChamadoSchema,
  responsavel: z.string().nullable(),
  ultimaAtualizacao: z.string().datetime(),
  historico: z.string().nullable(),
  tecnicoResolucao: z.string().nullable(),
  descricaoResolucao: z.string().nullable(),
  tecnicoSetor: z.string().nullable(),
  inventarioStatus: InventarioStatusSchema.nullable(),
  email: z.string().nullable()
})

export type Chamado = z.infer<typeof ChamadoSchema>

export const CriarChamadoSchema = z.object({
  unidade: z.string().min(1),
  solicitante: z.string().min(1),
  funcao: z.string().optional(),
  tipo: z.string().min(1),
  descricao: z.string().min(1),
  urgencia: z.string().min(1),
  email: z.string().email().optional(),
  anexoBase64: z.string().optional(),
  anexoNome: z.string().optional(),
  anexoTipo: z.string().optional()
})

export type CriarChamado = z.infer<typeof CriarChamadoSchema>

export const AtualizarStatusChamadoSchema = z.object({
  status: StatusChamadoSchema,
  tecnicoResolucao: z.string().optional(),
  descricaoResolucao: z.string().optional()
})

export type AtualizarStatusChamado = z.infer<typeof AtualizarStatusChamadoSchema>

export const ResponderChamadoSchema = z.object({
  texto: z.string().min(1)
})

export type ResponderChamado = z.infer<typeof ResponderChamadoSchema>

export const FiltrosChamadoSchema = z.object({
  unidade: z.string().optional(),
  categoria: z.string().optional(),
  status: StatusChamadoSchema.optional(),
  urgencia: z.string().optional(),
  tecnico: z.string().optional(),
  inventario: InventarioStatusSchema.optional(),
  dataDe: z.string().date().optional(),
  dataAte: z.string().date().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20)
})

export type FiltrosChamado = z.infer<typeof FiltrosChamadoSchema>

export const BatchUpdateChamadosSchema = z.object({
  ids: z.array(z.string().cuid()).min(1),
  status: StatusChamadoSchema.optional(),
  tecnicoResolucao: z.string().optional(),
  resposta: z.string().optional()
})

export type BatchUpdateChamados = z.infer<typeof BatchUpdateChamadosSchema>

export const BatchDeleteChamadosSchema = z.object({
  ids: z.array(z.string().cuid()).min(1)
})

export type BatchDeleteChamados = z.infer<typeof BatchDeleteChamadosSchema>

// ============================================
// PAGINATION
// ============================================

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      totalPages: z.number()
    })
  })

export type PaginatedResponse<T> = {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// ============================================
// ESCOLA
// ============================================

export const EscolaSchema = z.object({
  id: z.string().cuid(),
  nome: z.string(),
  nomeNormalizado: z.string(),
  tecnico: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export type Escola = z.infer<typeof EscolaSchema>

export const EscolaCreateSchema = z.object({
  nome: z.string().min(1),
  tecnico: z.string().min(1)
})

export type EscolaCreate = z.infer<typeof EscolaCreateSchema>

// ============================================
// EQUIPAMENTO
// ============================================

export const EquipamentoSchema = z.object({
  id: z.string().cuid(),
  categoria: z.string(),
  marca: z.string(),
  modelo: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export type Equipamento = z.infer<typeof EquipamentoSchema>

export const EquipamentoCreateSchema = z.object({
  categoria: z.string().min(1),
  marca: z.string().min(1),
  modelo: z.string().min(1)
})

export type EquipamentoCreate = z.infer<typeof EquipamentoCreateSchema>

// ============================================
// INVENTARIO
// ============================================

export const InventarioSchema = z.object({
  id: z.string().cuid(),
  escolaId: z.string().cuid(),
  escola: EscolaSchema,
  status: InventarioStatusSchema,
  updatedAt: z.string().datetime()
})

export type Inventario = z.infer<typeof InventarioSchema>

export const InventarioUpdateSchema = z.object({
  status: InventarioStatusSchema
})

export type InventarioUpdate = z.infer<typeof InventarioUpdateSchema>

// ============================================
// DASHBOARD
// ============================================

export const DashboardKPIsSchema = z.object({
  total: z.number(),
  abertos: z.number(),
  andamento: z.number(),
  comunicado: z.number(),
  resolvidos: z.number(),
  altaPrioridade: z.number()
})

export type DashboardKPIs = z.infer<typeof DashboardKPIsSchema>

export const DashboardMatrizResponseSchema = z.object({
  kpis: DashboardKPIsSchema,
  chamados: z.array(ChamadoSchema),
  graficos: z.object({
    porStatus: z.record(z.number()),
    porUrgencia: z.record(z.number()),
    resolvidosPorTecnico: z.record(z.number())
  })
})

export type DashboardMatrizResponse = z.infer<typeof DashboardMatrizResponseSchema>

export const DashboardFiltradoResponseSchema = z.object({
  kpis: DashboardKPIsSchema,
  chamados: z.array(ChamadoSchema),
  avisos: z.array(z.object({
    id: z.string(),
    tipo: z.string(),
    anterior: z.string(),
    atual: z.string(),
    responsavel: z.string(),
    quando: z.string().datetime()
  })),
  inventario: z.object({
    unidade: z.string(),
    tecnicoSetor: z.string(),
    status: InventarioStatusSchema
  })
})

export type DashboardFiltradoResponse = z.infer<typeof DashboardFiltradoResponseSchema>

// ============================================
// ERROR
// ============================================

export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.array(z.object({
    field: z.string(),
    message: z.string()
  })).optional()
})

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>

export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

// ============================================
// HEALTH
// ============================================

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  timestamp: z.string().datetime(),
  uptime: z.number(),
  database: z.enum(['connected', 'disconnected']),
  version: z.string()
})

export type HealthResponse = z.infer<typeof HealthResponseSchema>