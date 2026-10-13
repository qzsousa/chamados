import { z } from 'zod'

// ============================================
// ENUMS
// ============================================

export const NivelSchema = z.enum(['ADMIN', 'TECNICO', 'GESTOR', 'VISUALIZADOR'])
export const StatusUsuarioSchema = z.enum(['ATIVO', 'INATIVO'])
/**
 * Fluxo do chamado (matriz → técnico → escola):
 *
 *   ABERTO ──encaminhar──▶ ENCAMINHADO ──aceitar──▶ ANDAMENTO
 *                                                          │
 *                                              concluir   ▼
 *                                       AGUARDANDO_CONFERENCIA
 *                                            │            │
 *                             school confirma│            │escola contesta
 *                                            ▼            ▼
 *                                        RESOLVIDO      ABERTO (+1 reabertura)
 *
 * `COMUNICADO` é uma via paralela já existente: a matriz faz uma pergunta à
 * escola e, quando ela responde, o chamado volta para `ANDAMENTO`.
 */
export const StatusChamadoSchema = z.enum([
  'ABERTO',
  'ENCAMINHADO',
  'ANDAMENTO',
  'COMUNICADO',
  'AGUARDANDO_CONFERENCIA',
  'RESOLVIDO',
])
export const InventarioStatusSchema = z.enum(['CONCLUIDO', 'EM_ANDAMENTO', 'NAO_REALIZADO', 'NAO_INFORMADO'])

export type Nivel = z.infer<typeof NivelSchema>
export type StatusUsuario = z.infer<typeof StatusUsuarioSchema>
export type StatusChamado = z.infer<typeof StatusChamadoSchema>
export type InventarioStatus = z.infer<typeof InventarioStatusSchema>

/** Tipo do registro datado que fica na linha do tempo do chamado. */
export const TipoAtividadeSchema = z.enum(['REGISTRO', 'CONCLUSAO', 'CONTESTACAO', 'APROVACAO'])
export type TipoAtividade = z.infer<typeof TipoAtividadeSchema>

/** Rótulos e cores usados na interface (fonte única para as duas pontas). */
export const ROTULO_STATUS_CHAMADO: Record<StatusChamado, string> = {
  ABERTO: 'Aberto',
  ENCAMINHADO: 'Encaminhado',
  ANDAMENTO: 'Em atendimento',
  COMUNICADO: 'Aguardando resposta',
  AGUARDANDO_CONFERENCIA: 'Aguardando conferência',
  RESOLVIDO: 'Concluído',
}

/** Status que ainda não são finales — base dos KPIs e do filtro "em aberto". */
export const STATUS_EM_ABERTO: StatusChamado[] = [
  'ABERTO',
  'ENCAMINHADO',
  'ANDAMENTO',
  'COMUNICADO',
  'AGUARDANDO_CONFERENCIA',
]

export const ROTULO_TIPO_ATIVIDADE: Record<TipoAtividade, string> = {
  REGISTRO: 'Registro de atendimento',
  CONCLUSAO: 'Conclusão',
  CONTESTACAO: 'Contestação da escola',
  APROVACAO: 'Conferência aprovada',
}

// ============================================
// USER
// ============================================

/**
 * Papel no grupo de escolas irmãs (mesmo prédio). As duas escolas compartilham
 * o painel de equipamentos, mas a FILHA tem acesso somente de visualização.
 */
export const PapelUnidadeSchema = z.enum(['MAE', 'FILHA'])
export type PapelUnidade = z.infer<typeof PapelUnidadeSchema>

export const UserSchema = z.object({
  id: z.string().cuid(),
  email: z.string().email(),
  nome: z.string(),
  nivel: NivelSchema,
  filial: z.string(),
  status: StatusUsuarioSchema,
  primeiroLogin: z.boolean(),
  /**
   * Escopo de TIPOS de chamado: ["<chaveDaCategoria>::<rótulo>", ...].
   * Lista vazia = SEM RESTRIÇÃO (o usuário respeita só o `filial`, como
   * sempre). Preenchida, a trava de unidade é substituída pela trava de tipo.
   */
  escopoTipos: z.array(z.string()).default([]),
  /**
   * Rotas da API que este usuário pode alcançar: ["chamados", ...]. Lista
   * vazia = SEM RESTRIÇÃO (comportamento de sempre, decidido só pelo `nivel`).
   * Preenchida, tudo fora da lista responde 403 no servidor — esconder o item
   * de menu não é segurança.
   */
  rotasPermitidas: z.array(z.string()).default([]),
  /**
   * A senha atual foi gerada pela Matriz e precisa ser trocada no primeiro
   * login. `false` = senha definitiva, o caso de sempre.
   *
   * Distinto de `primeiroLogin`: aquele diz "esta pessoa NUNCA definiu senha"
   * (e o login passa pelo código de 6 dígitos); este diz "esta senha ATUAL não
   * é definitiva". Quem entra com senha provisória precisa trocar logo após.
   */
  senhaProvisoria: z.boolean().default(false),
  /** Nome composto do grupo ("E.E. A / E.E. B") — mesma quando a unidade está sozinha. */
  grupo: z.string().optional(),
  papelUnidade: PapelUnidadeSchema.nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export type User = z.infer<typeof UserSchema>

/**
 * `"<chaveDaCategoria>::<rótulo da opção>"`. O par é validado contra o
 * formulário ativo no `POST`/`PATCH /usuarios` — a chave sobrevive a renomear
 * a categoria, o rótulo NÃO sobrevive a renomear a opção (ver
 * `backend/src/services/escopo.ts`).
 */
export const EscopoTipoSchema = z
  .string()
  .min(3)
  .max(120)
  .refine((v) => v.includes('::'), { message: 'Formato esperado: categoria::tipo' })

/**
 * Domínios de rota que um usuário restrito pode alcançar. A lista é fechada de
 * propósito: o backend recusa qualquer valor fora dela no `POST`/`PATCH
 * /usuarios`, para não gravar um domínio que a API não conhece e o usuário ficar
 * proibido de tudo sem ninguém saber por quê.
 *
 * A chave é a mesma no router do portal, no menu e no guard de rota.
 */
export const ROTAS_USUARIO = [
  'chamados',
  'equipamentos',
  'dashboard',
  'usuarios',
  'escolas',
  'inventario',
  'tutoriais',
  'encaminhamentos',
  'notificacoes',
  'formulario',
  'feedback'
] as const

export const RotaUsuarioSchema = z.enum(ROTAS_USUARIO)

export const RotasPermitidasSchema = z.array(RotaUsuarioSchema).max(ROTAS_USUARIO.length)

export type RotaUsuario = z.infer<typeof RotaUsuarioSchema>

export const UserCreateSchema = z.object({
  email: z.string().email(),
  nome: z.string().min(1),
  nivel: NivelSchema,
  filial: z.string().min(1),
  /** Só o ADMIN pode mandar; o Gestor tem o campo descartado no backend. */
  escopoTipos: z.array(EscopoTipoSchema).max(100).optional(),
  /** Vazio = acesso normal, decidido só pelo nível. Só o ADMIN define. */
  rotasPermitidas: RotasPermitidasSchema.optional()
})

export type UserCreate = z.infer<typeof UserCreateSchema>

/**
 * Não é `UserCreateSchema.partial()`: o PATCH não aceita `email` (a troca de
 * e-mail é outro fluxo) e aceitar o campo para ignorá-lo só esconde o erro de
 * quem mandar.
 */
export const UserUpdateSchema = z.object({
  nome: z.string().min(1).optional(),
  nivel: NivelSchema.optional(),
  filial: z.string().min(1).optional(),
  escopoTipos: z.array(EscopoTipoSchema).max(100).optional(),
  status: StatusUsuarioSchema.optional(),
  rotasPermitidas: RotasPermitidasSchema.optional()
})

export type UserUpdate = z.infer<typeof UserUpdateSchema>

/** Usuário recém-criado: vem com o código de primeiro acesso já gerado. */
export const UserWithCodigoSchema = UserSchema.extend({
  codigoPrimeiroAcesso: z.string().regex(/^\d{6}$/)
})

export type UserWithCodigo = z.infer<typeof UserWithCodigoSchema>

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
  /**
   * Aceita vazio de propósito.
   *
   * Quem nunca definiu senha e quem recebeu senha provisória da Matriz não têm
   * senha antiga para digitar. Com `min(1)` o corpo era recusado ANTES do
   * handler, e essas duas pessoas ficavam trancadas sem conseguir trocar a senha
   * que receberam — inclusive a senha provisória que a Matriz acabou de gerar.
   *
   * A segurança não está neste campo, está no handler: ele só exige a senha
   * atual quando o usuário tem senha definitiva (primeiroLogin e
   * senhaProvisoria falsos). Quem manda vazio fora desses dois casos recebe
   * 401 "Senha atual incorreta".
   */
  senhaAtual: z.string().default(''),
  novaSenha: z.string().min(8).max(128)
})

export type ChangePassword = z.infer<typeof ChangePasswordSchema>

export const GerarCodigoPrimeiroAcessoSchema = z.object({
  email: z.string().email()
})

export type GerarCodigoPrimeiroAcesso = z.infer<typeof GerarCodigoPrimeiroAcessoSchema>

export const GerarCodigoPrimeiroAcessoResponseSchema = z.object({
  codigo: z.string().regex(/^\d{6}$/),
  nome: z.string().optional(),
  expiraEm: z.string()
})

export type GerarCodigoPrimeiroAcessoResponse = z.infer<typeof GerarCodigoPrimeiroAcessoResponseSchema>

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().optional()
})

export type RefreshRequest = z.infer<typeof RefreshRequestSchema>

// ============================================
// PRIMEIRO ACESSO (verificação de e-mail)
// ============================================

export const VerificarEmailSchema = z.object({
  email: z.string().email()
})

export type VerificarEmail = z.infer<typeof VerificarEmailSchema>

/**
 * Resposta da verificação de e-mail.
 *
 * `existe` e `primeiroAcesso` são o mínimo para a tela saber qual passo
 * mostrar. Nada de nome, nível ou filial sai daqui — ver o comentário da rota
 * sobre enumeração de usuários.
 */
export const VerificarEmailResponseSchema = z.object({
  existe: z.boolean(),
  primeiroAcesso: z.boolean(),
  ativo: z.boolean()
})

export type VerificarEmailResponse = z.infer<typeof VerificarEmailResponseSchema>

export const ConfirmarCodigoSchema = z.object({
  email: z.string().email(),
  codigo: z.string().regex(/^\d{6}$/, 'O código tem 6 dígitos')
})

export type ConfirmarCodigo = z.infer<typeof ConfirmarCodigoSchema>

export const ConfirmarCodigoResponseSchema = z.object({
  token: z.string(),
  expiraEm: z.string()
})

export type ConfirmarCodigoResponse = z.infer<typeof ConfirmarCodigoResponseSchema>

export const DefinirSenhaPrimeiroAcessoSchema = z.object({
  token: z.string().min(20),
  novaSenha: z.string().min(8).max(128),
  confirmarSenha: z.string().min(1)
})

export type DefinirSenhaPrimeiroAcesso = z.infer<typeof DefinirSenhaPrimeiroAcessoSchema>

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
  email: z.string().nullable(),
  /**
   * Quando o técnico aceitou o chamado (botão "Aceitar chamado").
   * NULL enquanto ninguém assumiu — é o que diferencia "encaminhado" de
   * "de fato em atendimento pelo técnico".
   */
  aceitoEm: z.string().datetime().nullable(),
  /** Quando o chamado foi concluído (status -> RESOLVIDO). NULL se reaberto. */
  concluidoEm: z.string().datetime().nullable()
})

export type Chamado = z.infer<typeof ChamadoSchema>

/* ============================================
   TRAVAS DE ANEXO — FONTE ÚNICA
   ============================================
   O bucket `anexos` do Supabase é PÚBLICO e o `contentType` gravado vem do
   cliente: sem esta trava, um `.html` ou `.svg` sobe e é servido como
   `text/html` — ou seja, XSS guardado pela URL do chamado. Por isso a allowlist
   de extensão E de MIME vive aqui, junto dos schemas que já eram o portão do
   arquivo, e `validarAnexo` é a MESMA função usada pelo formulário público
   (backend/src/routes/chamados.ts), que valida fora do zod.

   Os limites são sobrescritíveis por variável de ambiente (ver
   backend/src/config/env.ts) sem ninguém ter que editar código. A leitura é
   feita por `globalThis` porque este arquivo é compartilhado com o portal
   (browser), que não tem `process` — e o pacote shared não depende de
   @types/node.
*/
const ANEXO_ENV: Record<string, string | undefined> = ((): Record<string, string | undefined> => {
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } }
  return g?.process?.env ?? {}
})()

function intDoEnv(nome: string, padrao: number): number {
  const v = Number(ANEXO_ENV[nome])
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : padrao
}

/** Bytes decodificados por arquivo. Padrão: 5MB. */
export const ANEXO_MAX_BYTES = intDoEnv('ANEXO_MAX_BYTES', 5 * 1024 * 1024)

/** Quantidade de anexos por envio (mensagem, atividade, tutorial, abertura). */
export const ANEXO_MAX_POR_PEDIDO = intDoEnv('ANEXO_MAX_POR_PEDIDO', 5)

const EXTENSOES_PADRAO = [
  // imagem
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic',
  // documento
  'pdf', 'txt', 'csv', 'rtf',
  // planilha/apresentação
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods',
  // mídia
  'mp3', 'm4a', 'mp4', 'mov', 'webm',
  // compactado
  'zip'
]

/** Extensões liberadas, sem o ponto. Substituível por `ANEXO_EXTENSOES=jpg,png`. */
export const ANEXO_EXTENSOES: readonly string[] = (ANEXO_ENV.ANEXO_EXTENSOES || EXTENSOES_PADRAO.join(','))
  .split(',')
  .map((e) => e.trim().toLowerCase().replace(/^\./, ''))
  .filter(Boolean)

/**
 * MIME aceito por extensão. O `tipo` declarado pelo cliente só é aceito se
 * bater com a extensão — senão `.png` declarado como `text/html` passaria.
 */
const MIME_POR_EXTENSAO: Record<string, readonly string[]> = {
  jpg: ['image/jpeg', 'image/pjpeg'],
  jpeg: ['image/jpeg', 'image/pjpeg'],
  png: ['image/png'],
  gif: ['image/gif'],
  webp: ['image/webp'],
  bmp: ['image/bmp', 'image/x-ms-bmp'],
  heic: ['image/heic', 'image/heif'],
  pdf: ['application/pdf', 'application/x-pdf'],
  txt: ['text/plain'],
  csv: ['text/csv', 'text/plain', 'application/csv'],
  rtf: ['application/rtf', 'text/rtf'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  odt: ['application/vnd.oasis.opendocument.text'],
  ods: ['application/vnd.oasis.opendocument.spreadsheet'],
  mp3: ['audio/mpeg', 'audio/mp3'],
  m4a: ['audio/mp4', 'audio/x-m4a'],
  mp4: ['video/mp4'],
  mov: ['video/quicktime'],
  webm: ['video/webm', 'audio/webm'],
  zip: ['application/zip', 'application/x-zip-compressed']
}

/** MIME genérico que todo navegador pode mandar e que não diz nada perigoso. */
const MIME_NEUTRO = 'application/octet-stream'

/**
 * Limite do corpo JSON do express (`express.json`). 5 anexos de 5MB em base64
 * dariam ~35MB e estourariam o limite: nesses casos o cliente envia em PATCH.
 * Exportado para que index.ts e os testes usem o MESMO número — replicar '25mb'
 * à mão em cada lugar foi exatamente o que gerou as cópias que esta task remove.
 */
export const LIMITE_CORPO_JSON = ANEXO_ENV.LIMITE_CORPO_JSON?.trim() || '25mb'

/** base64 codifica 3 bytes em 4 caracteres — tamanho decodificado ~ length * 3/4. */
export function bytesDoBase64(base64: string): number {
  return (base64.length * 3) / 4
}

/** Extensão em minúsculas e sem o ponto ('' quando o nome não tem). */
export function extensaoDe(nome: string): string {
  const i = nome.lastIndexOf('.')
  return i > 0 ? nome.slice(i + 1).toLowerCase() : ''
}

/** MIME seguro para gravar no Storage: derivado da EXTENSÃO, nunca do cliente. */
export function mimeSeguroDe(nome: string, tipoDeclarado?: string | null): string {
  const ext = extensaoDe(nome)
  const aceitos = MIME_POR_EXTENSAO[ext]
  if (!aceitos?.length) return MIME_NEUTRO
  const declarado = (tipoDeclarado || '').trim().toLowerCase().split(';')[0].trim()
  if (declarado && aceitos.includes(declarado)) return declarado
  return aceitos[0]
}

/**
 * Valida UM anexo e devolve a lista de problemas — vazia significa aceito.
 * Cada problema nomeia o arquivo e a extensão recusada, para a escola entender
 * o que trocar em vez de receber um "Dados inválidos" sem detalhe.
 *
 * Usada tanto pelos schemas (superRefine) quanto pela leitura tolerante do
 * formulário público — é a MESMA trava, não duas que podem divergir.
 */
export function validarAnexo(nome: string, base64: string, tipo?: string | null): string[] {
  const problemas: string[] = []
  const ext = extensaoDe(nome)

  if (!ext) {
    problemas.push(`"${nome}" não tem extensão; envie um arquivo com extensão (ex.: foto.jpg)`)
  } else if (!ANEXO_EXTENSOES.includes(ext)) {
    problemas.push(
      `"${nome}" tem extensão não permitida (.${ext}). Envie um destes: ${ANEXO_EXTENSOES.join(', ')}`
    )
  } else {
    const declarado = (tipo || '').trim().toLowerCase().split(';')[0].trim()
    const aceitos = MIME_POR_EXTENSAO[ext] || []
    if (declarado && declarado !== MIME_NEUTRO && !aceitos.includes(declarado)) {
      problemas.push(`"${nome}" (${ext}) foi declarado como ${declarado}, que não é um ${aceitos[0]}`)
    }
  }

  if (bytesDoBase64(base64) > ANEXO_MAX_BYTES) {
    const mb = Math.round(ANEXO_MAX_BYTES / (1024 * 1024))
    problemas.push(`"${nome}" maior que ${mb}MB`)
  }

  return problemas
}

export const CriarChamadoSchema = z
  .object({
  unidade: z.string().min(1),
  solicitante: z.string().min(1),
  funcao: z.string().optional(),
  tipo: z.string().min(1),
  descricao: z.string().min(1),
  urgencia: z.string().min(1),
  /**
   * E-mail do solicitante — OBRIGATÓRIO. É a segunda credencial da consulta
   * pública (protocolo + e-mail), então chamado sem e-mail ficaria sem
   * acompanhamento pelo site.
   */
  email: z.string().email('Informe um e-mail válido'),
  anexoBase64: z.string().optional(),
  anexoNome: z.string().optional(),
  anexoTipo: z.string().optional(),
  /**
   * Chave da categoria do formulário público (ex.: 'equipamento').
   * É o que permite encaminhar o chamado automaticamente para o técnico
   * sem depender do texto livre de `tipo` (que quebra se a categoria for renomeada).
   */
  categoriaChave: z.string().optional()
  })
  // `anexoBase64` é o caminho LEGADO (formulário antigo, um arquivo só), mas
  // entra no mesmo bucket público dos demais — então passa pelas MESMAS travas.
  // Sem este refine, um base64 de 24MB passava: o campo era `z.string().optional()`
  // puro e o stitched da rota costurava o arquivo depois de toda a validação.
  .superRefine((val, ctx) => {
    if (!val.anexoBase64) return
    const nome = (val.anexoNome || '').trim()
    if (!nome) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['anexoNome'],
        message: 'anexoBase64 exige anexoNome com o nome do arquivo'
      })
      return
    }
    validarAnexo(nome, val.anexoBase64, val.anexoTipo).forEach((message) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['anexoBase64'], message })
    })
  })

export type CriarChamado = z.infer<typeof CriarChamadoSchema>

/**
 * Credenciais da consulta pública de chamado.
 *
 * O protocolo é sequencial por dia (CH-AAAAMMDD-NNNN) e, sozinho, é adivinhável.
 * Por isso a rota pública exige TAMBÉM o e-mail usado na abertura: o par só
 * abre o chamado para quem realmente o criou.
 */
export const ConsultarChamadoPublicoSchema = z.object({
  protocolo: z.string().trim().min(1),
  email: z.string().trim().email('Informe um e-mail válido'),
})

export type ConsultarChamadoPublico = z.infer<typeof ConsultarChamadoPublicoSchema>

// Anexo temporário de pergunta/resposta de chamado (expira 7 dias após o envio).
// A allowlist de extensão/MIME e o limite de tamanho estão no bloco "TRAVAS DE
// ANEXO" acima, compartilhados com o formulário público.
export const AnexoMensagemSchema = z
  .object({
    nome: z.string().min(1).max(200),
    tipo: z.string().optional(),
    base64: z.string().min(1)
  })
  .superRefine((a, ctx) => {
    validarAnexo(a.nome, a.base64, a.tipo).forEach((message) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message })
    })
  })

export type AnexoMensagem = z.infer<typeof AnexoMensagemSchema>

export const AtualizarStatusChamadoSchema = z.object({
  status: StatusChamadoSchema,
  tecnicoResolucao: z.string().optional(),
  descricaoResolucao: z.string().optional(),
  responsavel: z.string().optional(),
  // Matriz: ao mudar para COMUNICADO ("Aguardando escola"), registra a pergunta para a escola
  pergunta: z.string().min(1).max(5000).optional(),
  perguntaAnexos: z.array(AnexoMensagemSchema).max(ANEXO_MAX_POR_PEDIDO).optional()
})

export type AtualizarStatusChamado = z.infer<typeof AtualizarStatusChamadoSchema>

export const ResponderChamadoSchema = z.object({
  texto: z.string().min(1).max(5000),
  anexos: z.array(AnexoMensagemSchema).max(ANEXO_MAX_POR_PEDIDO).optional()
})

export type ResponderChamado = z.infer<typeof ResponderChamadoSchema>

/* ---------- FLUXO DE ATENDIMENTO (aceitar / atividade / concluir / conferir) ---------- */

/**
 * Registro do que o técnico fez. Pode ser repetido quantas vezes quiser: cada
 * envio vira uma linha nova com a sua própria data/hora.
 */
export const RegistrarAtividadeSchema = z.object({
  texto: z.string().trim().min(1, 'Descreva o que foi feito').max(5000),
  anexos: z.array(AnexoMensagemSchema).max(ANEXO_MAX_POR_PEDIDO).optional()
})

export type RegistrarAtividade = z.infer<typeof RegistrarAtividadeSchema>

/** Conclusão do técnico: texto obrigatório, porque é o que a escola vai conferir. */
export const ConcluirChamadoSchema = z.object({
  descricaoResolucao: z
    .string()
    .trim()
    .min(1, 'Registre o que foi feito para concluir o chamado')
    .max(5000),
  anexos: z.array(AnexoMensagemSchema).max(ANEXO_MAX_POR_PEDIDO).optional()
})

export type ConcluirChamado = z.infer<typeof ConcluirChamadoSchema>

/**
 * Conferência da escola sobre a conclusão do técnico.
 *
 * `aprovado: false` é a contestação: o texto passa a ser obrigatório porque é
 * ele que diz o que ficou faltando, e o chamado volta para ABERTO contando mais
 * uma reabertura.
 */
export const ConferirChamadoSchema = z
  .object({
    aprovado: z.boolean(),
    texto: z.string().trim().max(5000).optional(),
    anexos: z.array(AnexoMensagemSchema).max(ANEXO_MAX_POR_PEDIDO).optional()
  })
  .superRefine((a, ctx) => {
    if (!a.aprovado && !a.texto) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['texto'],
        message: 'Registre o que ficou faltando'
      })
    }
  })

export type ConferirChamado = z.infer<typeof ConferirChamadoSchema>

/**
 * Anexo permanente do registro de atividade (5MB) — mesmo limite da conversa,
 * mas este arquivo NÃO expira: é a prova do que foi feito no equipamento.
 */
export const AnexoAtividadeSchema = AnexoMensagemSchema
export type AnexoAtividade = z.infer<typeof AnexoAtividadeSchema>

export const ChamadoAtividadeSchema = z.object({
  id: z.string().cuid(),
  tipo: TipoAtividadeSchema,
  autorNome: z.string(),
  autorNivel: z.string().nullable(),
  texto: z.string(),
  criadoEm: z.string().datetime(),
  anexos: z.array(z.object({
    id: z.string().cuid(),
    nome: z.string(),
    tipo: z.string().nullable(),
    url: z.string()
  }))
})

export type ChamadoAtividade = z.infer<typeof ChamadoAtividadeSchema>

/**
 * Valor reservado do filtro `categoriaChave` para os chamados que não se
 * encaixam em NENHUMA categoria do formulário — praticamente todo o histórico
 * anterior a ele ter virado dinâmico.
 */
export const CATEGORIA_SEM_CHAVE = '__sem__'

export const FiltrosChamadoSchema = z.object({
  unidade: z.string().optional(),
  categoria: z.string().optional(),
  /** Chave exata da categoria do formulário público (ex.: 'equipamento'). */
  categoriaChave: z.string().optional(),
  status: StatusChamadoSchema.optional(),
  urgencia: z.string().optional(),
  tecnico: z.string().optional(),
  /** Nome do técnico responsável (parcial e sem diferenciar maiúsculas). */
  responsavel: z.string().optional(),
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

/* ---------- ENCAMINHAMENTO DE CHAMADOS ---------- */

/** Para onde encaminhar: o técnico da própria unidade ou um técnico escolhido. */
export const ModoEncaminhamentoSchema = z.enum(['UNIDADE', 'TECNICO'])
export type ModoEncaminhamento = z.infer<typeof ModoEncaminhamentoSchema>

/** Encaminhamento manual (modal de detalhes do chamado). */
export const EncaminharChamadoSchema = z
  .object({
    modo: ModoEncaminhamentoSchema.default('UNIDADE'),
    tecnicoId: z.string().cuid().optional(),
    /** Observação opcional registrada no histórico do chamado. */
    observacao: z.string().max(500).optional()
  })
  .refine((d) => d.modo !== 'TECNICO' || !!d.tecnicoId, {
    message: 'Informe o técnico de destino',
    path: ['tecnicoId']
  })

export type EncaminharChamado = z.infer<typeof EncaminharChamadoSchema>

/** Regra de encaminhamento automático por categoria do formulário. */
export const EncaminhamentoRegraSchema = z
  .object({
    categoriaChave: z.string().min(1),
    modo: ModoEncaminhamentoSchema.default('UNIDADE'),
    tecnicoId: z.string().cuid().optional(),
    ativa: z.boolean().default(true)
  })
  .refine((d) => d.modo !== 'TECNICO' || !!d.tecnicoId, {
    message: 'Informe o técnico fixo da regra',
    path: ['tecnicoId']
  })

export type EncaminhamentoRegra = z.infer<typeof EncaminhamentoRegraSchema>

export const BatchDeleteChamadosSchema = z.object({
  ids: z.array(z.string().cuid()).min(1)
})

export type BatchDeleteChamados = z.infer<typeof BatchDeleteChamadosSchema>

// ============================================
// TUTORIAIS
// ============================================

// O tamanho e a extensão dos anexos de tutorial são validados dentro de
// TutorialAnexoInputSchema (mesmas travas de sempre — bloco no topo do arquivo).

export const TutorialAnexoInputSchema = z
  .object({
    nome: z.string().min(1).max(200),
    tipo: z.string().optional(),
    base64: z.string().min(1)
  })
  .superRefine((a, ctx) => {
    validarAnexo(a.nome, a.base64, a.tipo).forEach((message) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message })
    })
  })

export type TutorialAnexoInput = z.infer<typeof TutorialAnexoInputSchema>

export const CriarTutorialSchema = z
  .object({
    titulo: z.string().min(1).max(160),
    subtitulo: z.string().max(200).nullish().transform((v) => (v ? v : null)),
    conteudo: z.string().min(1).max(20000),
    categoriaId: z.string().min(1),
    anexos: z.array(TutorialAnexoInputSchema).max(ANEXO_MAX_POR_PEDIDO).optional()
  })

export type CriarTutorial = z.infer<typeof CriarTutorialSchema>

export const AtualizarTutorialSchema = z.object({
  titulo: z.string().min(1).max(160).optional(),
  // undefined = não altera; null/'' = limpa o subtítulo
  subtitulo: z.string().max(200).nullish().transform((v) => (v === undefined ? undefined : v ? v : null)),
  conteudo: z.string().min(1).max(20000).optional(),
  categoriaId: z.string().min(1).optional(),
  anexosNovos: z.array(TutorialAnexoInputSchema).max(ANEXO_MAX_POR_PEDIDO).optional(),
  removerAnexoIds: z.array(z.string()).optional()
})

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

/**
 * Uma condição de exibição: a pergunta aparece quando a resposta de
 * `perguntaId` for `opcao`. `opcao` vazia significa "qualquer resposta do pai".
 *
 * Várias condições formam uma OU — a pergunta aparece quando QUALQUER uma for
 * satisfeita. É o que permite "abrir esta pergunta se for Queda total OU
 * Queda de Wi-Fi", coisa que o par legado não expressava.
 */
export const FormularioCondicaoSchema = z.object({
  perguntaId: z.string().min(1, 'Condição sem pergunta de origem.'),
  opcao: z.string().default('')
})

export type FormularioCondicao = z.infer<typeof FormularioCondicaoSchema>

/**
 * Tipos de resposta de uma pergunta do formulário público.
 *
 * `ESCOLA` e `ARQUIVO` não aceitam `opcoes`: a lista de escolas vem do catálogo
 * (`/escolas/nomes`) e o anexo é um upload — não faz sentido configurar os dois
 * como opções fixas. O portal já oferece os cinco no admin; se este enum não
 * acompanhar, criar uma pergunta desses volta 400 e a tela mente que gravou.
 */
export const TIPOS_PERGUNTA_FORMULARIO = ['OPCOES', 'TEXTO', 'TEXTO_LONGO', 'ESCOLA', 'ARQUIVO'] as const

export type TipoPerguntaFormulario = (typeof TIPOS_PERGUNTA_FORMULARIO)[number]

function refinarFormularioPergunta(
  val: {
    tipo?: TipoPerguntaFormulario
    opcoes?: FormularioOpcao[]
    dependeDePerguntaId?: string | null
    dependeDeOpcao?: string | null
    condicoes?: FormularioCondicao[]
  },
  ctx: z.RefinementCtx
) {
  if (val.tipo === 'OPCOES' && (!val.opcoes || val.opcoes.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['opcoes'], message: 'Pergunta do tipo OPCOES exige ao menos uma opção.' })
  }
  if (val.tipo && val.tipo !== 'OPCOES' && val.opcoes && val.opcoes.length > 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['opcoes'], message: 'Pergunta que não é de opções não aceita opções.' })
  }
  if (val.dependeDeOpcao != null && val.dependeDeOpcao !== '' && (val.dependeDePerguntaId == null || val.dependeDePerguntaId === '')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dependeDePerguntaId'], message: 'dependeDeOpcao exige dependeDePerguntaId.' })
  }
  // A mesma condição escrita duas vezes é a mesma condição: só confunde quem lê o
  // formulário na tela. Comparado por par pergunta+opção, e não por posição.
  if (val.condicoes) {
    const vistas = new Set<string>()
    for (const [i, c] of val.condicoes.entries()) {
      const chave = `${c.perguntaId}::${c.opcao ?? ''}`
      if (vistas.has(chave)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['condicoes', i], message: 'Condição repetida.' })
      }
      vistas.add(chave)
    }
  }
}

export const CriarFormularioPerguntaSchema = z
  .object({
    categoriaId: z.string().min(1),
    rotulo: z.string().min(1).max(300),
    ajuda: z.string().max(500).optional(),
    tipo: z.enum(TIPOS_PERGUNTA_FORMULARIO),
    obrigatoria: z.boolean().default(true),
    ordem: z.number().int().default(0),
    ativa: z.boolean().default(true),
    condicoes: z.array(FormularioCondicaoSchema).max(10).optional(),
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
    tipo: z.enum(TIPOS_PERGUNTA_FORMULARIO).optional(),
    obrigatoria: z.boolean().optional(),
    ordem: z.number().int().optional(),
    ativa: z.boolean().optional(),
    condicoes: z.array(FormularioCondicaoSchema).max(10).optional(),
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
  /** ABERTO + ENCAMINHADO: fila que ainda não começou a ser executada. */
  abertos: z.number(),
  andamento: z.number(),
  comunicado: z.number(),
  /** AGUARDANDO_CONFERENCIA: o técnico concluiu, a escola ainda não conferiu. */
  aguardandoConferencia: z.number(),
  resolvidos: z.number(),
  altaPrioridade: z.number()
})

export type DashboardKPIs = z.infer<typeof DashboardKPIsSchema>

export const DashboardMatrizResponseSchema = z.object({
  kpis: DashboardKPIsSchema,
  chamados: z.array(ChamadoSchema),
  /** Nota média do atendimento (público). `media` é null sem avaliações. */
  avaliacoes: z.object({
    total: z.number(),
    media: z.number().nullable(),
    porNota: z.record(z.number())
  }).optional(),
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