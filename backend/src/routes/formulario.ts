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
