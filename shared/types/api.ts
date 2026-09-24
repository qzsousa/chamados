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

const TAMANHO_MAX_ANEXO_MENSAGEM = 5 * 1024 * 1024

// Anexo temporário de pergunta/resposta de chamado (expira 7 dias após o envio)
export const AnexoMensagemSchema = z
  .object({
    nome: z.string().min(1).max(200),
    tipo: z.string().optional(),
    base64: z.string().min(1)
  })
  .superRefine((a, ctx) => {
    // base64 codifica 3 bytes em 4 chars — tamanho decodificado ~ length * 3/4
    if ((a.base64.length * 3) / 4 > TAMANHO_MAX_ANEXO_MENSAGEM) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Anexo maior que 5MB' })
    }
  })

export type AnexoMensagem = z.infer<typeof AnexoMensagemSchema>

export const AtualizarStatusChamadoSchema = z.object({
  status: StatusChamadoSchema,
  tecnicoResolucao: z.string().optional(),
  descricaoResolucao: z.string().optional(),
  responsavel: z.string().optional(),
  // Matriz: ao mudar para COMUNICADO ("Aguardando escola"), registra a pergunta para a escola
  pergunta: z.string().min(1).max(5000).optional(),
  perguntaAnexos: z.array(AnexoMensagemSchema).max(5).optional()
})

export type AtualizarStatusChamado = z.infer<typeof AtualizarStatusChamadoSchema>

export const ResponderChamadoSchema = z.object({
  texto: z.string().min(1).max(5000),
  anexos: z.array(AnexoMensagemSchema).max(5).optional()
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
// TUTORIAIS
// ============================================

const TAMANHO_MAX_ANEXO = 5 * 1024 * 1024

export const TutorialAnexoInputSchema = z.object({
  nome: z.string().min(1).max(200),
  tipo: z.string().optional(),
  base64: z.string().min(1)
})

export type TutorialAnexoInput = z.infer<typeof TutorialAnexoInputSchema>

function validarTamanhoAnexos(anexos: TutorialAnexoInput[] | undefined, campo: string, ctx: z.RefinementCtx) {
  anexos?.forEach((a, i) => {
    // base64 codifica 3 bytes em 4 chars — tamanho decodificado ~ length * 3/4
    if ((a.base64.length * 3) / 4 > TAMANHO_MAX_ANEXO) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [campo, i], message: 'Anexo maior que 5MB' })
    }
  })
}

export const CriarTutorialSchema = z
  .object({
    titulo: z.string().min(1).max(160),
    subtitulo: z.string().max(200).nullish().transform((v) => (v ? v : null)),
    conteudo: z.string().min(1).max(20000),
    categoriaId: z.string().min(1),
    anexos: z.array(TutorialAnexoInputSchema).max(5).optional()
  })
  .superRefine((val, ctx) => validarTamanhoAnexos(val.anexos, 'anexos', ctx))

export type CriarTutorial = z.infer<typeof CriarTutorialSchema>

export const AtualizarTutorialSchema = z
  .object({
    titulo: z.string().min(1).max(160).optional(),
    // undefined = não altera; null/'' = limpa o subtítulo
    subtitulo: z.string().max(200).nullish().transform((v) => (v === undefined ? undefined : v ? v : null)),
    conteudo: z.string().min(1).max(20000).optional(),
    categoriaId: z.string().min(1).optional(),
    anexosNovos: z.array(TutorialAnexoInputSchema).max(5).optional(),
    removerAnexoIds: z.array(z.string()).optional()
  })
  .superRefine((val, ctx) => validarTamanhoAnexos(val.anexosNovos, 'anexosNovos', ctx))

export type AtualizarTutorial = z.infer<typeof AtualizarTutorialSchema>

export const CriarTutorialCategoriaSchema = z.object({
  nome: z.string().min(1).max(60),
  descricao: z.string().max(200).optional(),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()
})

export type CriarTutorialCategoria = z.infer<typeof CriarTutorialCategoriaSchema>

export const AtualizarTutorialCategoriaSchema = CriarTutorialCategoriaSchema.partial()

export type AtualizarTutorialCategoria = z.infer<typeof AtualizarTutorialCategoriaSchema>

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

===========================================
// FORMULÁRIO DE CHAMADOS (configurável)
// ============================================

export const FormularioOpcaoAlertaSchema = z.object({
  texto: z.string().min(1),
  tipo: z.enum(['info', 'aviso']),
  encerra: z.boolean().optional(),
  exigeAnexo: z.boolean().optional(),
  linkRotulo: z.string().max(80).optional(),
  linkUrl: z.string().url().optional()
})

export type FormularioOpcaoAlerta = z.infer<typeof FormularioOpcaoAlertaSchema>

export const FormularioOpcaoSchema = z.object({
  rotulo: z.string().min(1).max(300),
  alerta: FormularioOpcaoAlertaSchema.optional()
})

export type FormularioOpcao = z.infer<typeof FormularioOpcaoSchema>

function refinarFormularioPergunta(
  val: {
    tipo?: 'OPCOES' | 'TEXTO' | 'TEXTO_LONGO'
    opcoes?: FormularioOpcao[]
    dependeDePerguntaId?: string | null
    dependeDeOpcao?: string | null
  },
  ctx: z.RefinementCtx
) {
  if (val.tipo === 'OPCOES' && (!val.opcoes || val.opcoes.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['opcoes'], message: 'Pergunta do tipo OPCOES exige ao menos uma opção.' })
  }
  if ((val.tipo === 'TEXTO' || val.tipo === 'TEXTO_LONGO') && val.opcoes && val.opcoes.length > 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['opcoes'], message: 'Pergunta de texto não aceita opções.' })
  }
  if (val.dependeDeOpcao != null && val.dependeDeOpcao !== '' && (val.dependeDePerguntaId == null || val.dependeDePerguntaId === '')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dependeDePerguntaId'], message: 'dependeDeOpcao exige dependeDePerguntaId.' })
  }
}

export const CriarFormularioPerguntaSchema = z
  .object({
    categoriaId: z.string().min(1),
    rotulo: z.string().min(1).max(300),
    ajuda: z.string().max(500).optional(),
    tipo: z.enum(['OPCOES', 'TEXTO', 'TEXTO_LONGO']),
    obrigatoria: z.boolean().default(true),
    ordem: z.number().int().default(0),
    ativa: z.boolean().default(true),
    dependeDePerguntaId: z.string().nullish(),
    dependeDeOpcao: z.string().nullish(),
    opcoes: z.array(FormularioOpcaoSchema).optional()
  })
  .superRefine(refinarFormularioPergunta)

export type CriarFormularioPergunta = z.infer<typeof CriarFormularioPerguntaSchema>

export const AtualizarFormularioPerguntaSchema = z
  .object({
    categoriaId: z.string().min(1).optional(),
    rotulo: z.string().min(1).max(300).optional(),
    ajuda: z.string().max(500).optional(),
    tipo: z.enum(['OPCOES', 'TEXTO', 'TEXTO_LONGO']).optional(),
    obrigatoria: z.boolean().optional(),
    ordem: z.number().int().optional(),
    ativa: z.boolean().optional(),
    dependeDePerguntaId: z.string().nullish(),
    dependeDeOpcao: z.string().nullish(),
    opcoes: z.array(FormularioOpcaoSchema).optional()
  })
  .superRefine(refinarFormularioPergunta)

export type AtualizarFormularioPergunta = z.infer<typeof AtualizarFormularioPerguntaSchema>

export const CriarFormularioCategoriaSchema = z.object({
  chave: z.string().regex(/^[a-z0-9-]+$/).optional(),
  nome: z.string().min(1).max(80),
  descricao: z.string().max(300).optional(),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  ordem: z.number().int().default(0),
  ativa: z.boolean().default(true)
})

export type CriarFormularioCategoria = z.infer<typeof CriarFormularioCategoriaSchema>

export const AtualizarFormularioCategoriaSchema = CriarFormularioCategoriaSchema.partial()

export type AtualizarFormularioCategoria = z.infer<typeof AtualizarFormularioCategoriaSchema>
