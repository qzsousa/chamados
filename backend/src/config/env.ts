import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(10000),

  DATABASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  FRONTEND_URL: z.string().url(),

  SENTRY_DSN: z.string().url().optional(),

  /** URL do projeto Supabase. Se ausente, deriva do JWT da service key / DATABASE_URL. */
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),

  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GOOGLE_SHEETS_ID: z.string().optional(),
  GOOGLE_INVENTARIO_SHEETS_ID: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Brevo (SIB) para e-mails instantâneos, sem IPv6 issues
  BREVO_API_KEY: z.string().optional(),
  BREVO_SENDER_EMAIL: z.string().optional(),

  // Sync de usuários para o SCE (sistema de equipamentos)
  SCE_API_URL: z.string().url().optional(),
  SCE_SYNC_KEY: z.string().optional(),

  // Migração lazy de senhas para o Supabase Auth do SCE (Fase 1).
  // Quando true, cada login bem-sucedido no chamados cria/atualiza o usuário
  // no Supabase Auth do projeto SCE com a senha informada.
  SCE_SUPABASE_URL: z.string().url().optional(),
  SCE_SUPABASE_SERVICE_KEY: z.string().optional(),
  MIGRAR_USUARIOS_PARA_SCE: z.string().optional().transform((v) => v === 'true').default('false'),

  // Proxy de LLM (Chat da Caf\u00c9IA). As chaves vivem AQUI, no servidor - se
  // fossem VITE_* no portal, o Vite as embutiria no bundle e qualquer pessoa
  // leria no console do navegador.
  IA_PROVEDOR: z.enum(['nvidia', 'gemini', 'groq']).optional(),
  IA_API_KEY_NVIDIA: z.string().optional(),
  IA_API_KEY_GEMINI: z.string().optional(),
  IA_API_KEY_GROQ: z.string().optional(),
  IA_MODELO_NVIDIA: z.string().default('z-ai/glm-5.3-flash'),
  IA_MODELO_GEMINI: z.string().default('gemini-3-flash-preview'),
  IA_MODELO_GROQ: z.string().default('openai/gpt-oss-20b'),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),

  /* ---------- UPLOAD / ANEXO ----------
     Todas OPCIONAIS de propósito: quem não setar nada leva o padrão do contrato,
     que é a fonte única (bloco "TRAVAS DE ANEXO" em @shared/api, que lê estas
     mesmas variáveis). Aqui só validamos o formato — o número vive em um lugar
     só, justamente para não voltar a existir cópia em cada rota.
     ANEXO_EXTENSOES é uma lista separada por vírgula, sem o ponto. */
  ANEXO_MAX_BYTES: z.coerce.number().int().positive().optional(),
  ANEXO_MAX_POR_PEDIDO: z.coerce.number().int().positive().optional(),
  ANEXO_EXTENSOES: z.string().optional(),
  LIMITE_CORPO_JSON: z.string().optional()
})

export type Env = z.infer<typeof envSchema>

let cachedEnv: Env | null = null

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv

  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('❌ Variáveis de ambiente inválidas:')
    console.error(result.error.flatten().fieldErrors)
    process.exit(1)
  }

  cachedEnv = result.data
  return cachedEnv
}

export const env = getEnv()