import { z } from 'zod'
import { env } from '../config/env'

/**
 * Proxy de LLM para a CafeIA.
 *
 * Por que existe: o navegador nao consegue chamar a NVIDIA NIM direto. A API
 * responde ao preflight de CORS SEM o cabecalho `Access-Control-Allow-Origin`,
 * entao o fetch morre antes de sair (Groq e Gemini liberam, a NVIDIA nao). Como
 * aqui a chamada sai do servidor, o CORS deixa de existir.
 *
 * O ganho maior nem e esse: a chave deixa de ser `VITE_*`, que o Vite substitui
 * no bundle e qualquer pessoa le no console do navegador. Aqui ela fica no
 * ambiente do servidor. Trocar de modelo e mudar uma variavel e redeploy do
 * backend, nao do portal inteiro.
 *
 * A rota e um proxy CRU: as tools continuam rodando no navegador, com o JWT de
 * quem perguntou. O backend so traduz o formato de cada provedor.
 */

export const provedoresIA = ['nvidia', 'gemini', 'groq'] as const
export type ProvedorIA = (typeof provedoresIA)[number]

const MensagemSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string().nullable().optional(),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        function: z.object({ name: z.string(), arguments: z.string() }),
      }),
    )
    .optional(),
})

/** Espelha o formato de tools do Chat Completions da OpenAI. */
const ToolSchema = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string().max(120),
    description: z.string().max(2000).optional(),
    parameters: z.record(z.unknown()).optional(),
  }),
})

export const ChatIASchema = z.object({
  messages: z.array(MensagemSchema).min(1).max(60),
  tools: z.array(ToolSchema).max(80).optional(),
  tool_choice: z.enum(['auto', 'none', 'required']).optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().min(64).max(32000).optional(),
  provedores: z.array(z.enum(provedoresIA)).max(3).optional(),
  modelo: z.string().max(200).optional(),
})

export type ChatIAPayload = z.infer<typeof ChatIASchema>

/**
 * Modelo de cada provedor. Variavel de ambiente por provedor.
 *
 * O padrao da NVIDIA nao e mais o GLM 5.3 flash: na API hospedada ele responde
 * VAZIO depois de ~100 s de raciocinio (o `chat_template_kwargs.thinking`
 * abaixo e parametro de container local e nao desliga o raciocinio la). O
 * Nemotron 3 Super responde a mesma tool em ~5 s.
 */
function modeloDe(p: ProvedorIA, body?: ChatIAPayload): string {
  if (p === 'nvidia' && body?.modelo) return body.modelo
  if (p === 'nvidia') return process.env.IA_MODELO_NVIDIA || 'nvidia/nemotron-3-super-120b-a12b'
  if (p === 'gemini') return process.env.IA_MODELO_GEMINI || 'gemini-3-flash-preview'
  return process.env.IA_MODELO_GROQ || 'openai/gpt-oss-20b'
}

function chaveDe(p: ProvedorIA): string | undefined {
  if (p === 'nvidia') return process.env.IA_API_KEY_NVIDIA
  if (p === 'gemini') return process.env.IA_API_KEY_GEMINI
  return process.env.IA_API_KEY_GROQ
}

/** Ordem de tentativa. Sem `provedores` no corpo, usa esta. */
function ordemPadrao(): ProvedorIA[] {
  const configurado = process.env.IA_PROVEDOR
  if (configurado && provedoresIA.includes(configurado as ProvedorIA)) {
    const p = configurado as ProvedorIA
    return [p, ...provedoresIA.filter((x) => x !== p)]
  }
  return [...provedoresIA]
}

function baseDe(p: ProvedorIA): string {
  if (p === 'nvidia') return 'https://integrate.api.nvidia.com/v1/chat/completions'
  if (p === 'groq') return 'https://api.groq.com/openai/v1/chat/completions'
  return `https://generativelanguage.googleapis.com/v1beta/models/${modeloDe('gemini')}:generateContent`
}

export class ErroProvedor extends Error {
  constructor(
    public readonly provedor: ProvedorIA,
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ErroProvedor'
  }
}

function paraGemini(body: ChatIAPayload) {
  const sistema = body.messages.find((m) => m.role === 'system')?.content ?? ''
  const contents = body.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content ?? '' }],
    }))

  return {
    systemInstruction: { parts: [{ text: sistema }] },
    contents,
    tools: body.tools ? [{ functionDeclarations: body.tools.map((t) => t.function) }] : undefined,
    generationConfig: {
      temperature: body.temperature ?? 0.2,
      maxOutputTokens: body.max_tokens ?? 4000,
    },
  }
}

/** Resposta no MESMO formato da OpenAI, para o loop de tools do front nao mudar. */
function deGemini(resposta: unknown): unknown {
  const parts = (resposta as any)?.candidates?.[0]?.content?.parts ?? []
  const texto = parts.map((p: any) => p.text ?? '').join('\n')
  const chamadas = parts
    .filter((p: any) => p.functionCall)
    .map((p: any, i: number) => ({
      id: `call_gemini_${i}`,
      type: 'function',
      function: { name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args ?? {}) },
    }))

  const message: Record<string, unknown> = { role: 'assistant', content: texto }
  if (chamadas.length) message.tool_calls = chamadas

  return { choices: [{ message, finish_reason: chamadas.length ? 'tool_calls' : 'stop' }] }
}

async function chamarProvedor(p: ProvedorIA, chave: string, body: ChatIAPayload): Promise<unknown> {
  const modelo = modeloDe(p, body)

  if (p === 'gemini') {
    const r = await fetch(baseDe(p), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
      body: JSON.stringify(paraGemini(body)),
    })
    if (!r.ok) throw new ErroProvedor(p, r.status, await r.text())
    return deGemini(await r.json())
  }

  const r = await fetch(baseDe(p), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` },
    body: JSON.stringify({
      model: modelo,
      messages: body.messages,
      tools: body.tools,
      tool_choice: body.tool_choice ?? 'auto',
      temperature: body.temperature ?? 0.2,
      max_tokens: body.max_tokens ?? 4000,
      // O GLM e modelo de raciocinio: sem isto ele gasta cota pensando antes de
      // responder. O proxy so consulta dados e monta tabela, entao nao precisa.
      ...(p === 'nvidia' ? { chat_template_kwargs: { thinking: false } } : {}),
    }),
  })
  if (!r.ok) throw new ErroProvedor(p, r.status, await r.text())
  return r.json()
}

/**
 * Tira o rascunho interno do modelo da resposta.
 *
 * `reasoning_content`/`reasoning` nao interessam a ninguem no portal e ainda
 * carregam pedacos do system prompt. Nao vai para o navegador: melhor nao
 * enviar do que esconder na tela.
 */
function limparEscolha(resposta: any) {
  const escolhas = resposta?.choices
  if (!Array.isArray(escolhas)) return resposta
  for (const e of escolhas) {
    if (e?.message && typeof e.message === 'object') {
      delete e.message.reasoning_content
      delete e.message.reasoning
    }
  }
  return resposta
}

/**
 * Resposta sem texto util NAO e sucesso.
 *
 * Modelo de raciocinio que estoura o `max_tokens` pensando devolve HTTP 200,
 * `finish_reason: length` e `content: ""` — sem `tool_calls` tambem. Se isso
 * contasse como resposta, o `consultarIA` parava no primeiro provedor e o
 * navegador recebia um balão vazio depois de um minuto de espera, sem chance
 * de cair para Gemini/Groq. Aqui vira falha do provedor, que e o que e.
 */
function respostaUtil(resposta: any): boolean {
  const escolha = resposta?.choices?.[0]
  if (!escolha) return false
  const mensagem = escolha.message
  if (!mensagem) return false
  if (Array.isArray(mensagem.tool_calls) && mensagem.tool_calls.length) return true
  return typeof mensagem.content === 'string' && mensagem.content.trim().length > 0
}

/**
 * Tenta os provedores em ordem e devolve a primeira resposta boa.
 *
 * Levanta erro so quando TODOS falharam: no chat do portal um provedor cair
 * nao pode virar erro para a pessoa, ela nem precisa saber qual era.
 */
export async function consultarIA(body: ChatIAPayload): Promise<{ provedor: ProvedorIA; resposta: unknown }> {
  const pedidos = body.provedores ?? ordemPadrao()
  const falhas: string[] = []

  for (const p of pedidos) {
    const chave = chaveDe(p)
    if (!chave) {
      falhas.push(`${p}: sem chave configurada`)
      continue
    }
    try {
      const resposta = await chamarProvedor(p, chave, body)
      if (!respostaUtil(resposta)) {
        falhas.push(`${p}: ${modeloDe(p, body)} devolveu resposta vazia`)
        continue
      }
      return { provedor: p, resposta: limparEscolha(resposta) }
    } catch (e) {
      const motivo = e instanceof ErroProvedor ? `${e.status} ${e.message}`.slice(0, 300) : String(e)
      falhas.push(`${p}: ${motivo}`)
    }
  }

  throw new Error(`Nenhum provedor respondeu. ${falhas.join(' | ')}`)
}

/** Lista os modelos disponiveis na API NIM (NVIDIA). */
export async function listarModelosNvidia(): Promise<string[]> {
  const chave = process.env.IA_API_KEY_NVIDIA
  if (!chave) throw new Error('IA_API_KEY_NVIDIA não configurada')
  const r = await fetch('https://integrate.api.nvidia.com/v1/models', {
    headers: { Authorization: `Bearer ${chave}` },
  })
  if (!r.ok) throw new Error(`NIM models: ${r.status} ${await r.text()}`.slice(0, 200))
  const json = (await r.json()) as { data?: Array<{ id?: string }> }
  const ids = (json?.data ?? []).map((m) => m?.id).filter((id): id is string => Boolean(id))
  return Array.from(new Set(ids)).sort()
}

/** Reexportado para a rota montar a resposta de erro sem vazar a chave. */
export { env }
