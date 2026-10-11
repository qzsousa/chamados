import { Router } from 'express'
import { ZodError } from 'zod'
import { isZodError } from '../utils/zodError'
import { prisma } from '../config/prisma'
import { requireRole } from '../middleware/auth'
import {
  AtualizarFormularioCategoriaSchema,
  AtualizarFormularioPerguntaSchema,
  CriarFormularioCategoriaSchema,
  CriarFormularioPerguntaSchema,
  FormularioOpcao
} from '@shared/api'

const router = Router()

/** Mantém o mesmo response shape das demais rotas. */
function respostaValidacao(res: import('express').Response, err: ZodError) {
  return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
}

/** Slug para a chave da categoria quando não informada (ex.: 'E-mail institucional' → 'e-mail-institucional'). */
function slugify(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// ============================================
// SEED PADRÃO (espelha o formulário legado)
// Ids determinísticos para as dependências
// apontarem para as perguntas corretas.
// ============================================

type PerguntaSeed = {
  id: string
  rotulo: string
  ajuda?: string
  tipo: 'OPCOES' | 'TEXTO' | 'TEXTO_LONGO'
  obrigatoria: boolean
  ordem: number
  dependeDePerguntaId?: string
  dependeDeOpcao?: string
  opcoes?: FormularioOpcao[]
}

type CategoriaSeed = {
  id: string
  chave: string
  nome: string
  descricao: string
  cor: string
  ordem: number
  perguntas: PerguntaSeed[]
}

const SEED_FORMULARIO: CategoriaSeed[] = [
  {
    id: 'seed-cat-rede',
    chave: 'rede',
    nome: 'Rede',
    descricao: 'Lentidão, queda de internet, Wi-Fi instável ou solicitação de pontos de rede.',
    cor: '#1E7FC7',
    ordem: 1,
    perguntas: [
      {
        id: 'seed-perg-rede-1',
        rotulo: 'Qual é o problema de rede?',
        tipo: 'OPCOES',
        obrigatoria: true,
        ordem: 1,
        opcoes: [
          {
            rotulo: 'Lentidão',
            alerta: {
              texto: 'Antes de abrir o chamado, faça o teste de velocidade da internet da escola. Após o teste, tire uma print do resultado e anexe ao chamado na próxima etapa.',
              tipo: 'info',
              linkRotulo: 'Fazer teste de velocidade',
              linkUrl: 'https://www.brasilbandalarga.com.br/'
            }
          },
          { rotulo: 'Queda total de internet' },
          { rotulo: 'Queda de Wi-Fi em salas ou locais específicos' },
          {
            rotulo: 'Solicitação de pontos de rede',
            alerta: {
              texto: 'Para solicitações de novos pontos de rede, é obrigatório anexar fotos das salas e locais onde os pontos são necessários. Você poderá adicionar o anexo na próxima etapa.',
              tipo: 'aviso',
              exigeAnexo: true
            }
          }
        ]
      },
      {
        id: 'seed-perg-rede-2',
        rotulo: 'A escola possui energia elétrica agora?',
        tipo: 'OPCOES',
        obrigatoria: true,
        ordem: 2,
        dependeDePerguntaId: 'seed-perg-rede-1',
        dependeDeOpcao: 'Queda total de internet',
        opcoes: [
          { rotulo: 'Sim, há energia na escola' },
          {
            rotulo: 'Não, está sem energia no momento',
            alerta: {
              texto: 'Aguarde o retorno da energia. A rede de internet se estabiliza automaticamente quando a energia voltar. Se após o retorno a internet não normalizar, abra um chamado.',
              tipo: 'aviso',
              encerra: true
            }
          }
        ]
      },
      {
        id: 'seed-perg-rede-3',
        rotulo: 'Quais salas ou locais estão sem conexão?',
        ajuda: 'Detalhe os locais afetados para agilizar o atendimento. Ex.: Sala 5, Sala 7, Quadra, Laboratório de Informática, Secretaria...',
        tipo: 'TEXTO_LONGO',
        obrigatoria: true,
        ordem: 3,
        dependeDePerguntaId: 'seed-perg-rede-1',
        dependeDeOpcao: 'Queda de Wi-Fi em salas ou locais específicos'
      }
    ]
  },
  {
    id: 'seed-cat-equipamento',
    chave: 'equipamento',
    nome: 'Equipamento',
    descricao: 'Notebook, tablet ou impressora com problema físico, de software, Wi-Fi ou formatação.',
    cor: '#1E7A4C',
    ordem: 2,
    perguntas: [
      {
        id: 'seed-perg-equip-1',
        rotulo: 'Qual é o tipo de problema no equipamento?',
        tipo: 'OPCOES',
        obrigatoria: true,
        ordem: 1,
        opcoes: [
          { rotulo: 'Wi-Fi (equipamento não conecta à rede)' },
          { rotulo: 'Manutenção — Problemas físicos' },
          { rotulo: 'Manutenção — Problemas de software' },
          { rotulo: 'Formatação' },
          { rotulo: 'Sistema (login, configuração, perfil)' }
        ]
      },
      {
        id: 'seed-perg-equip-2',
        rotulo: 'Qual é o tipo de problema físico?',
        tipo: 'OPCOES',
        obrigatoria: true,
        ordem: 2,
        dependeDePerguntaId: 'seed-perg-equip-1',
        dependeDeOpcao: 'Manutenção — Problemas físicos',
        opcoes: [
          { rotulo: 'Bateria' },
          { rotulo: 'Teclado' },
          { rotulo: 'Tela' },
          { rotulo: 'Som' },
          { rotulo: 'Câmera' },
          { rotulo: 'Outro' }
        ]
      }
    ]
  },
  {
    id: 'seed-cat-sistemas',
    chave: 'sistemas',
    nome: 'Sistemas',
    descricao: 'Erros em sistemas como PortalNet e outros sistemas educacionais.',
    cor: '#7A4FB5',
    ordem: 3,
    perguntas: [
      {
        id: 'seed-perg-sist-1',
        rotulo: 'Qual sistema está com problema?',
        tipo: 'OPCOES',
        obrigatoria: true,
        ordem: 1,
        opcoes: [{ rotulo: 'PortalNet' }, { rotulo: 'SEI' }]
      },
      {
        id: 'seed-perg-sist-2',
        rotulo: 'RG',
        tipo: 'TEXTO',
        obrigatoria: true,
        ordem: 2,
        dependeDePerguntaId: 'seed-perg-sist-1',
        dependeDeOpcao: 'PortalNet'
      },
      {
        id: 'seed-perg-sist-3',
        rotulo: 'Nome completo do servidor',
        tipo: 'TEXTO',
        obrigatoria: true,
        ordem: 3,
        dependeDePerguntaId: 'seed-perg-sist-1',
        dependeDeOpcao: 'PortalNet'
      },
      {
        id: 'seed-perg-sist-4',
        rotulo: 'CIE da escola',
        tipo: 'TEXTO',
        obrigatoria: true,
        ordem: 4,
        dependeDePerguntaId: 'seed-perg-sist-1',
        dependeDeOpcao: 'PortalNet'
      },
      {
        id: 'seed-perg-sist-5',
        rotulo: 'Atribuições / Transferência',
        ajuda: 'Ex.: Transferir de E.E. X para E.E. Y — atribuição de Coordenador Pedagógico...',
        tipo: 'TEXTO_LONGO',
        obrigatoria: true,
        ordem: 5,
        dependeDePerguntaId: 'seed-perg-sist-1',
        dependeDeOpcao: 'PortalNet'
      },
      {
        id: 'seed-perg-sist-6',
        rotulo: 'O que você precisa no SEI?',
        tipo: 'OPCOES',
        obrigatoria: true,
        ordem: 6,
        dependeDePerguntaId: 'seed-perg-sist-1',
        dependeDeOpcao: 'SEI',
        opcoes: [
          { rotulo: 'Solicitação de acesso' },
          {
            rotulo: 'Reportar problema',
            alerta: {
              texto: 'É obrigatório anexar uma imagem do erro para que o chamado seja analisado.',
              tipo: 'aviso',
              exigeAnexo: true
            }
          }
        ]
      },
      {
        id: 'seed-perg-sist-7',
        rotulo: 'Nome',
        tipo: 'TEXTO',
        obrigatoria: true,
        ordem: 7,
        dependeDePerguntaId: 'seed-perg-sist-6',
        dependeDeOpcao: 'Solicitação de acesso'
      },
      {
        id: 'seed-perg-sist-8',
        rotulo: 'CPF',
        tipo: 'TEXTO',
        obrigatoria: true,
        ordem: 8,
        dependeDePerguntaId: 'seed-perg-sist-6',
        dependeDeOpcao: 'Solicitação de acesso'
      },
      {
        id: 'seed-perg-sist-9',
        rotulo: 'E-mail institucional',
        tipo: 'TEXTO',
        obrigatoria: true,
        ordem: 9,
        dependeDePerguntaId: 'seed-perg-sist-6',
        dependeDeOpcao: 'Solicitação de acesso'
      },
      {
        id: 'seed-perg-sist-10',
        rotulo: 'Escola',
        tipo: 'TEXTO',
        obrigatoria: true,
        ordem: 10,
        dependeDePerguntaId: 'seed-perg-sist-6',
        dependeDeOpcao: 'Solicitação de acesso'
      },
      {
        id: 'seed-perg-sist-11',
        rotulo: 'CIE',
        tipo: 'TEXTO',
        obrigatoria: true,
        ordem: 11,
        dependeDePerguntaId: 'seed-perg-sist-6',
        dependeDeOpcao: 'Solicitação de acesso'
      },
      {
        id: 'seed-perg-sist-12',
        rotulo: 'Nome',
        tipo: 'TEXTO',
        obrigatoria: true,
        ordem: 12,
        dependeDePerguntaId: 'seed-perg-sist-6',
        dependeDeOpcao: 'Reportar problema'
      },
      {
        id: 'seed-perg-sist-13',
        rotulo: 'CPF',
        tipo: 'TEXTO',
        obrigatoria: true,
        ordem: 13,
        dependeDePerguntaId: 'seed-perg-sist-6',
        dependeDeOpcao: 'Reportar problema'
      },
      {
        id: 'seed-perg-sist-14',
        rotulo: 'E-mail institucional',
        tipo: 'TEXTO',
        obrigatoria: true,
        ordem: 14,
        dependeDePerguntaId: 'seed-perg-sist-6',
        dependeDeOpcao: 'Reportar problema'
      },
      {
        id: 'seed-perg-sist-15',
        rotulo: 'Escola',
        tipo: 'TEXTO',
        obrigatoria: true,
        ordem: 15,
        dependeDePerguntaId: 'seed-perg-sist-6',
        dependeDeOpcao: 'Reportar problema'
      },
      {
        id: 'seed-perg-sist-16',
        rotulo: 'CIE',
        tipo: 'TEXTO',
        obrigatoria: true,
        ordem: 16,
        dependeDePerguntaId: 'seed-perg-sist-6',
        dependeDeOpcao: 'Reportar problema'
      }
    ]
  },
  {
    id: 'seed-cat-email',
    chave: 'email',
    nome: 'E-mail institucional',
    descricao: 'Sem acesso, senha bloqueada ou problemas de login.',
    cor: '#C9711A',
    ordem: 4,
    perguntas: [
      {
        id: 'seed-perg-email-1',
        rotulo: 'CIE da escola',
        ajuda: 'Chamados de e-mail sem estas informações não poderão ser processados. Preencha com atenção.',
        tipo: 'TEXTO',
        obrigatoria: true,
        ordem: 1
      },
      {
        id: 'seed-perg-email-2',
        rotulo: 'Nome da escola / Diretoria de Ensino',
        tipo: 'TEXTO',
        obrigatoria: true,
        ordem: 2
      },
      {
        id: 'seed-perg-email-3',
        rotulo: 'Login do usuário (sem @educacao.sp.gov.br)',
        tipo: 'TEXTO',
        obrigatoria: true,
        ordem: 3
      },
      {
        id: 'seed-perg-email-4',
        rotulo: 'E-mail completo',
        tipo: 'TEXTO',
        obrigatoria: true,
        ordem: 4
      }
    ]
  }
]

/**
 * Semeia o formulário padrão na primeira leitura pública. Idempotente pelos
 * ids determinísticos; a corrida entre requisições concorrentes cai no
 * catch (P2002) e segue para a leitura normal.
 */
async function seedFormularioPadrao(): Promise<void> {
  for (const cat of SEED_FORMULARIO) {
    try {
      await prisma.formularioCategoria.create({
        data: {
          id: cat.id,
          chave: cat.chave,
          nome: cat.nome,
          descricao: cat.descricao,
          cor: cat.cor,
          ordem: cat.ordem,
          perguntas: { create: cat.perguntas }
        }
      })
    } catch {
      // corrida (outra requisição semeou primeiro) ou seed parcial — segue
    }
  }
}

// ============================================
// CONDIÇÕES DO FORMULÁRIO (avaliação das respostas)
// ============================================
//
// O formulário público é enviado cru para o portal (`GET /formulario/publico`)
// e as condições (`dependeDePerguntaId` / `dependeDeOpcao` / `alerta`) são
// resolvidas LÁ, para a escola não ver pergunta que não é dela. Mas "resolve no
// navegador" não é "resolve no servidor": sem isto, o `POST /chamados` aceitaria
// um corpo montado à mão com respostas que o técnico não devia ter recebido, ou
// sem os anexos que o aviso exigiu. As funções abaixo são a MESMA regra do
// portal, aplicada de novo no servidor — é o que faz a condição valer de verdade.

/** Uma resposta do solicitante, no formato que o formulário entrega. */
export type RespostaFormulario = {
  perguntaId: string
  resposta: string
}

/** Resposta aceita, com o rótulo da pergunta congelado no momento da abertura. */
export type RespostaAceita = {
  perguntaId: string
  rotulo: string
  resposta: string
}

/** O que a categoria precisa expor para as condições serem avaliadas. */
export type CategoriaAvaliavel = {
  chave: string
  perguntas: Array<{
    id: string
    rotulo: string
    tipo: string
    obrigatoria: boolean
    ativa?: boolean
    dependeDePerguntaId?: string | null
    dependeDeOpcao?: string | null
    opcoes?: unknown
  }>
}

export type AvaliacaoFormulario = {
  /** Só as respostas aceitas: as de pergunta invisível ou inválida ficam de fora. */
  respostas: RespostaAceita[]
  /** Pergunta visível e obrigatória que ficou sem resposta. */
  faltando: Array<{ perguntaId: string; rotulo: string }>
  /** Alguma resposta escolhida cobra anexo. */
  exigeAnexo: boolean
  /**
   * Alguma resposta escolhida manda PARAR o fluxo — o caso "a escola está sem
   * energia, aguarde voltarem" do formulário de rede. Não é erro do navegador:
   * é a resposta certa que dispensa a abertura do chamado.
   */
  encerra: { perguntaId: string; rotulo: string; texto: string } | null
}

/**
 * Rótulo de opção é texto digitado pelo ADMIN e volta escrito pelo solicitante;
 * comparar byte a byte reprovaria "Manutenção — Problemas físicos" por causa de
 * um acento ou espaço a mais. Compara só o que muda o sentido.
 */
function mesmoRotulo(a: string, b: string): boolean {
  const normaliza = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  return normaliza(a) === normaliza(b)
}

/**
 * `opcoes` é Json no banco (o ADMIN manda o array que quiser), então a leitura
 * é tolerante: entrada inesperada vira lista vazia em vez de derrubar a
 * criação do chamado.
 */
function lerOpcoes(opcoes: unknown): FormularioOpcao[] {
  if (!Array.isArray(opcoes)) return []
  return opcoes.filter(
    (o): o is FormularioOpcao => !!o && typeof o === 'object' && typeof (o as FormularioOpcao).rotulo === 'string'
  )
}

/**
 * Resolve quais perguntas estão visíveis para as respostas dadas.
 *
 * Só as ATIVAS entram: pergunta desativada pelo ADMIN some do formulário
 * público, então resposta dela é resíduo de uma tela antiga.
 *
 * A visibilidade é resolvida em cadeia (`dependeDePerguntaId` pode apontar para
 * outra pergunta condicional) com memoização e teto de profundidade — uma
 * dependência apontando para si mesma viraria recursão infinita.
 */
function perguntasVisiveis(
  perguntas: CategoriaAvaliavel['perguntas'],
  respostasPorId: Map<string, string>
): Set<string> {
  const porId = new Map(perguntas.map((p) => [p.id, p]))
  const memo = new Map<string, boolean>()
  const emCurso = new Set<string>()

  const visivel = (id: string, profundidade: number): boolean => {
    const cache = memo.get(id)
    if (cache !== undefined) return cache
    // Ciclo (A depende de B, B depende de A) ou profundidade demais: trata como
    // invisível, que é o comportamento seguro — não exige resposta de ninguém.
    if (emCurso.has(id) || profundidade > perguntas.length) return false

    const guardar = (v: boolean): boolean => {
      memo.set(id, v)
      return v
    }

    const p = porId.get(id)
    if (!p || p.ativa === false) return guardar(false)

    if (!p.dependeDePerguntaId) return guardar(true)

    const pai = porId.get(p.dependeDePerguntaId)
    // Condição apontando para pergunta de outra categoria (ou removida): a
    // condição não pode ser satisfeita, então a pergunta não aparece.
    if (!pai) return guardar(false)

    emCurso.add(id)
    try {
      const respondidaDoPai = respostasPorId.get(pai.id)
      const paiRespondido = visivel(pai.id, profundidade + 1) && !!respondidaDoPai
      // `dependeDeOpcao` = só aparece com ESTA resposta. Sem `dependeDeOpcao`
      // (só `dependeDePerguntaId`) = aparece com qualquer resposta do pai.
      const ok = paiRespondido && (!p.dependeDeOpcao || mesmoRotulo(respondidaDoPai!, p.dependeDeOpcao))
      return guardar(ok)
    } finally {
      emCurso.delete(id)
    }
  }

  perguntas.forEach((p) => visivel(p.id, 0))
  return new Set([...memo.entries()].filter(([, v]) => v).map(([k]) => k))
}

/**
 * Aplica as condições do formulário às respostas recebidas.
 *
 * Três regras, nesta ordem de importância:
 *
 * 1. **Resposta de pergunta invisível é descartada**, não rejeitada. A
 *    categoria pode ter mudado entre a tela que a escola preencheu e o envio;
 *    perder esse campo é melhor do que devolver 400 e jogar fora o relato todo.
 * 2. **Resposta de `OPCOES` que não é nenhuma das opções é descartada** — pelo
 *    mesmo motivo, e porque não existe valor válido para gravar.
 * 3. **Pergunta visível e obrigatória sem resposta é erro de verdade**
 *    (`faltando`), porque aqui a escola simplesmente esqueceu de preencher.
 *
 * `exigeAnexo` e `encerra` saem como bandeira, não como erro: quem decide é quem
 * tem o payload inteiro (a criação do chamado), porque `exigeAnexo` depende da
 * quantidade de arquivos que veio junto.
 */
export function avaliarRespostasFormulario(
  categoria: CategoriaAvaliavel,
  respostas: RespostaFormulario[],
  quantidadeAnexos = 0
): AvaliacaoFormulario {
  // Última resposta vence quando o portal manda a mesma pergunta duas vezes.
  const respostasPorId = new Map<string, string>()
  for (const r of respostas) {
    const valor = typeof r?.resposta === 'string' ? r.resposta.trim() : ''
    if (!r?.perguntaId || !valor) continue
    respostasPorId.set(r.perguntaId, valor)
  }

  const visiveis = perguntasVisiveis(categoria.perguntas, respostasPorId)

  const aceitas: RespostaAceita[] = []
  const faltando: Array<{ perguntaId: string; rotulo: string }> = []
  let exigeAnexo = false
  let encerra: AvaliacaoFormulario['encerra'] = null

  for (const p of categoria.perguntas) {
    if (p.ativa === false) continue

    // Pergunta que não apareceu para esta escola: a resposta é descarte.
    if (!visiveis.has(p.id)) continue

    const bruta = respostasPorId.get(p.id)
    if (!bruta) {
      if (p.obrigatoria) faltando.push({ perguntaId: p.id, rotulo: p.rotulo })
      continue
    }

    // Grava o rótulo canônico da opção (não o que o navegador mandou), para a
    // leitura pelo técnico casar com o texto do formulário.
    let valor = bruta
    if (p.tipo === 'OPCOES') {
      const opcao = lerOpcoes(p.opcoes).find((o) => mesmoRotulo(o.rotulo, bruta))
      if (!opcao) continue // opção que não existe mais: resposta inválida
      valor = opcao.rotulo
      if (opcao.alerta?.exigeAnexo) exigeAnexo = true
      if (opcao.alerta?.encerra && !encerra) {
        encerra = { perguntaId: p.id, rotulo: p.rotulo, texto: opcao.alerta.texto }
      }
    }

    aceitas.push({ perguntaId: p.id, rotulo: p.rotulo, resposta: valor })
  }

  // `exigeAnexo` só vira cobrança quando NENHUM arquivo veio: um anexo que não
  // passou no upload (Supabase fora, arquivo vazio) não conta como enviado.
  return {
    respostas: aceitas,
    faltando,
    exigeAnexo: exigeAnexo && quantidadeAnexos === 0,
    encerra
  }
}

/**
 * Carrega a categoria do formulário pela chave, já com as perguntas ativas.
 * Devolve `null` quando a chave não existe ou a categoria foi desativada — o
 * chamador trata como "chamado sem formulário" (é o caso de todo chamado
 * histórico e de qualquer portal desatualizado).
 */
export async function carregarCategoriaFormulario(chave: string): Promise<CategoriaAvaliavel | null> {
  if (!chave) return null
  const categoria = await prisma.formularioCategoria.findFirst({
    where: { chave: { equals: chave, mode: 'insensitive' }, ativa: true },
    orderBy: { ordem: 'asc' },
    include: { perguntas: { where: { ativa: true }, orderBy: { ordem: 'asc' } } }
  })
  return categoria as CategoriaAvaliavel | null
}

// ============================================
// PÚBLICO (montado ANTES da parede de auth)
// ============================================

export async function formularioPublicoHandler(_req: import('express').Request, res: import('express').Response) {
  try {
    const total = await prisma.formularioCategoria.count()
    if (total === 0) {
      await seedFormularioPadrao()
    }

    const categorias = await prisma.formularioCategoria.findMany({
      where: { ativa: true },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
      include: {
        perguntas: {
          where: { ativa: true },
          orderBy: { ordem: 'asc' }
        }
      }
    })

    return res.json({ data: categorias })
  } catch (err) {
    throw err
  }
}

// ============================================
// ADMIN — CATEGORIAS
// ============================================

router.get('/categorias', requireRole('ADMIN'), async (_req, res) => {
  const categorias = await prisma.formularioCategoria.findMany({
    orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    include: {
      perguntas: { orderBy: { ordem: 'asc' } }
    }
  })
  return res.json({ data: categorias })
})

router.post('/categorias', requireRole('ADMIN'), async (req, res) => {
  try {
    const data = CriarFormularioCategoriaSchema.parse(req.body)
    const chave = data.chave ?? slugify(data.nome)
    if (!chave) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: { chave: ['Nome não gera uma chave válida.'] } })
    }
    const categoria = await prisma.formularioCategoria.create({
      data: { ...data, chave }
    })
    return res.status(201).json(categoria)
  } catch (err) {
    if (isZodError(err)) {
      return respostaValidacao(res, err)
    }
    if ((err as any)?.code === 'P2002') {
      return res.status(409).json({ error: 'CONFLICT', message: 'Já existe uma categoria com essa chave.' })
    }
    throw err
  }
})

router.patch('/categorias/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    const data = AtualizarFormularioCategoriaSchema.parse(req.body)
    const categoria = await prisma.formularioCategoria.update({
      where: { id: req.params.id },
      data
    })
    return res.json(categoria)
  } catch (err) {
    if (isZodError(err)) {
      return respostaValidacao(res, err)
    }
    if ((err as any)?.code === 'P2002') {
      return res.status(409).json({ error: 'CONFLICT', message: 'Já existe uma categoria com essa chave.' })
    }
    if ((err as any)?.code === 'P2025') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Categoria não encontrada.' })
    }
    throw err
  }
})

router.delete('/categorias/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    // perguntas somem pelo onDelete: Cascade
    await prisma.formularioCategoria.delete({ where: { id: req.params.id } })
    return res.status(204).send()
  } catch (err) {
    if ((err as any)?.code === 'P2025') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Categoria não encontrada.' })
    }
    throw err
  }
})

// ============================================
// ADMIN — PERGUNTAS
// ============================================

router.post('/perguntas', requireRole('ADMIN'), async (req, res) => {
  try {
    const data = CriarFormularioPerguntaSchema.parse(req.body)

    const categoria = await prisma.formularioCategoria.findUnique({ where: { id: data.categoriaId } })
    if (!categoria) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Categoria não encontrada.' })
    }

    if (data.dependeDePerguntaId) {
      const pai = await prisma.formularioPergunta.findUnique({ where: { id: data.dependeDePerguntaId } })
      if (!pai || pai.categoriaId !== data.categoriaId) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'A pergunta da qual depende deve pertencer à mesma categoria.' })
      }
    }

    const pergunta = await prisma.formularioPergunta.create({ data })
    return res.status(201).json(pergunta)
  } catch (err) {
    if (isZodError(err)) {
      return respostaValidacao(res, err)
    }
    throw err
  }
})

router.patch('/perguntas/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    const data = AtualizarFormularioPerguntaSchema.parse(req.body)
    const pergunta = await prisma.formularioPergunta.update({
      where: { id: req.params.id },
      data
    })
    return res.json(pergunta)
  } catch (err) {
    if (isZodError(err)) {
      return respostaValidacao(res, err)
    }
    if ((err as any)?.code === 'P2025') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Pergunta não encontrada.' })
    }
    throw err
  }
})

router.delete('/perguntas/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    await prisma.formularioPergunta.delete({ where: { id: req.params.id } })
    return res.status(204).send()
  } catch (err) {
    if ((err as any)?.code === 'P2025') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Pergunta não encontrada.' })
    }
    throw err
  }
})

export default router
