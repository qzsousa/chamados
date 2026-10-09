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
  FormularioCondicao,
  FormularioOpcao,
  TipoPerguntaFormulario
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

/**
 * Converte o par legado (uma condição só) no formato novo e vice-versa.
 *
 * As colunas `dependeDePerguntaId`/`dependeDeOpcao` continuam sendo gravadas
 * sempre que existe uma única condição: é o que permite um frontend antigo
 * (que só lê o par) exibir corretamente as perguntas já cadastradas.
 */
function condicoesDaLegado(
  perguntaId?: string | null,
  opcao?: string | null,
): { condicoes?: FormularioCondicao[]; dependeDePerguntaId: string | null; dependeDeOpcao: string | null } {
  const tem = !!perguntaId && !!opcao
  return {
    ...(tem ? { condicoes: [{ perguntaId: perguntaId as string, opcao: opcao as string }] } : {}),
    dependeDePerguntaId: tem ? (perguntaId as string) : null,
    dependeDeOpcao: tem ? (opcao as string) : null,
  }
}

/** Espelha `condicoes` nas colunas legadas quando há 0 ou 1 condição. */
function espelharLegado(condicoes: FormularioCondicao[] | undefined) {
  const unica = condicoes?.length === 1 ? (condicoes[0] as FormularioCondicao) : undefined
  return {
    dependeDePerguntaId: unica?.perguntaId ?? null,
    dependeDeOpcao: unica?.opcao ?? null,
  }
}

type PerguntaSeed = {
  id: string
  rotulo: string
  ajuda?: string
  tipo: TipoPerguntaFormulario
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
          perguntas: {
            // O seed usa o par legado; gravar também em `condicoes` evita que a
            // primeira abertura pública dependa do fallback de compatibilidade.
            create: cat.perguntas.map((p) => ({
              ...p,
              ...condicoesDaLegado(p.dependeDePerguntaId, p.dependeDeOpcao),
            })),
          },
        }
      })
    } catch {
      // corrida (outra requisição semeou primeiro) ou seed parcial — segue
    }
  }
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

/**
 * Confere cada condição: a pergunta de origem precisa existir, estar na mesma
 * categoria, ser do tipo OPCOES e ter a opção citada. Sem essa checagem uma
 * condição órfã (pergunta excluída depois) viraria um item que nunca aparece,
 * e o ADMIN não teria como perceber o erro pela tela.
 *
 * Devolve `null` quando está tudo certo, ou a mensagem de erro.
 */
async function validarCondicoes(
  condicoes: FormularioCondicao[] | undefined,
  categoriaId: string,
  legado: { perguntaId?: string | null; opcao?: string | null },
): Promise<string | null> {
  // O par legado vira uma condição e passa pelo mesmo caminho — assim não há
  // dois lugares com regra de validação para divergirem.
  const lista: FormularioCondicao[] = condicoes?.length
    ? condicoes
    : legado.perguntaId && legado.opcao
      ? [{ perguntaId: legado.perguntaId, opcao: legado.opcao }]
      : []
  for (const c of lista) {
    const pai = await prisma.formularioPergunta.findUnique({ where: { id: c.perguntaId } })
    if (!pai || pai.categoriaId !== categoriaId) {
      return 'Toda pergunta de uma condição deve pertencer à mesma categoria.'
    }
    if (pai.tipo !== 'OPCOES') {
      return `A pergunta "${pai.rotulo}" não tem opções, então não pode liberar a exibição.`
    }
    const opcoes = Array.isArray(pai.opcoes) ? (pai.opcoes as FormularioOpcao[]) : []
    if (!opcoes.some((o) => o.rotulo === c.opcao)) {
      return `A opção "${c.opcao}" não existe mais em "${pai.rotulo}".`
    }
  }
  return null
}

router.post('/perguntas', requireRole('ADMIN'), async (req, res) => {
  try {
    const data = CriarFormularioPerguntaSchema.parse(req.body)

    const categoria = await prisma.formularioCategoria.findUnique({ where: { id: data.categoriaId } })
    if (!categoria) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Categoria não encontrada.' })
    }

    const erroCondicao = await validarCondicoes(data.condicoes, data.categoriaId, {
      perguntaId: data.dependeDePerguntaId,
      opcao: data.dependeDeOpcao,
    })
    if (erroCondicao) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: erroCondicao })
    }

    const pergunta = await prisma.formularioPergunta.create({
      data: {
        ...data,
        // `condicoes` manda no comportamento; o par legado é só espelho.
        ...(data.condicoes ? espelharLegado(data.condicoes) : condicoesDaLegado(data.dependeDePerguntaId, data.dependeDeOpcao)),
      },
    })
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

    // A categoria pode vir no PATCH: sem ela, a validação das condições usa a
    // categoria da pergunta já gravada.
    let categoriaId = data.categoriaId
    if (categoriaId === undefined) {
      const atual = await prisma.formularioPergunta.findUnique({
        where: { id: req.params.id },
        select: { categoriaId: true },
      })
      if (!atual) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Pergunta não encontrada.' })
      }
      categoriaId = atual.categoriaId
    }

    const erroCondicao = await validarCondicoes(data.condicoes, categoriaId, {
      perguntaId: data.dependeDePerguntaId,
      opcao: data.dependeDeOpcao,
    })
    if (erroCondicao) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: erroCondicao })
    }

    const pergunta = await prisma.formularioPergunta.update({
      where: { id: req.params.id },
      data: {
        ...data,
        // Só mexe no espelho legado quando `condicoes` veio no PATCH; sem ele,
        // quem chama pode estar mexendo só em `ordem`/`rotulo`.
        ...(data.condicoes ? espelharLegado(data.condicoes) : {}),
      },
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
