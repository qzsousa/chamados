import { Router, Response } from 'express'
import { prisma } from '../config/prisma'
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth'
import { EscolaSchema, EscolaCreateSchema } from '@shared/api'
import { ZodError } from 'zod'
import { isZodError } from '../utils/zodError'
import { normalizarNomeEscola, getMapaTecnicos, getTecnicoPorEscola, NOMES_PADRONIZADOS, listarGruposUnidades } from '../services/normalization'

const router = Router()

/** Casa tolerante de unidade: exata ou individual contida no composto (e vice-versa). */
function unidadeCasaPainel(a: string, b: string): boolean {
  const na = normalizarNomeEscola(a)
  const nb = normalizarNomeEscola(b)
  if (!na || !nb) return false
  return na === nb || (na.length > 3 && nb.includes(na)) || (nb.length > 3 && na.includes(nb))
}

/**
 * Chamado pertence ao PRÉDIO (grupo) quando casa com QUALQUER das escolas do
 * grupo, ou com o composto inteiro.
 *
 * Deliberadamente NÃO usa `grupo.includes(nomeChamado)`: no nível do grupo isso
 * fica frouxo demais — "E.E. VILA" casaria dentro de "E.E. VILA BELA". Aqui a
 * comparação é por IGUALDADE contra cada parte, e o `includes` fica restrito ao
 * caso legado de chamado gravado com o composto canônico.
 */
function chamadoPertenceAGrupo(unidadeChamado: string, grupo: string): boolean {
  const na = normalizarNomeEscola(unidadeChamado)
  if (!na) return false
  if (na === normalizarNomeEscola(grupo)) return true
  const partes = grupo.split('/').map((p) => normalizarNomeEscola(p)).filter(Boolean)
  if (partes.some((p) => p === na)) return true
  // legado: chamado antigo gravado como "E.E. A / E.E. B" (com barra e prefixo)
  return partes.some((p) => p.length > 3 && na.includes(p))
}

/**
 * Painel de unidades escolares (somente matriz): UMA LINHA POR PRÉDIO.
 *
 * Escolas que dividem o mesmo prédio (mãe/filha) são uma única unidade aqui:
 * o equipamento é compartilhado por grupo, então emitir as duas linhas faria o
 * mesmo parque ser contado duas vezes. A irmã aparece em `irma`, que a tela usa
 * para mostrar "divide o prédio com ..." abaixo da mãe.
 *
 * Os contadores (usuários, chamados) são agregados pelo grupo, e não pela linha
 * individual — assim nenhum registro é contado duas vezes.
 * Os totais de equipamentos são mesclados no frontend a partir do SCE.
 */
router.get('/painel', authMiddleware, requireRole('ADMIN', 'TECNICO'), async (_req: AuthenticatedRequest, res) => {
  try {
    const unidades = listarGruposUnidades()

    const [inventarios, usuarios, chamadosAgrupados] = await Promise.all([
      prisma.inventario.findMany({ include: { escola: true } }),
      prisma.usuario.findMany({ where: { status: 'ATIVO' }, select: { filial: true } }),
      prisma.chamado.groupBy({ by: ['unidade', 'status'], where: { excluido: false }, _count: true }),
    ])

    // Inventário é registrado por GRUPO (linha composta da tabela Escola)
    const inventarioPorGrupo = new Map<string, string>()
    for (const inv of inventarios) {
      inventarioPorGrupo.set(normalizarNomeEscola(inv.escola.nome), inv.status)
    }

    const painel = unidades.map((u) => {
      // usuários do PRÉDIO: casa pelo grupo (que contém as duas escolas), não pela
      // linha — casando pelo grupo o usuário da irmã entra uma vez só.
      const usuariosAtivos = usuarios.filter((x) => unidadeCasaPainel(x.filial, u.grupo)).length

      let chamadosTotal = 0
      let chamadosAbertos = 0
      for (const c of chamadosAgrupados) {
        if (!chamadoPertenceAGrupo(c.unidade, u.grupo)) continue
        chamadosTotal += c._count
        if (c.status !== 'RESOLVIDO') chamadosAbertos += c._count
      }

      return {
        nome: u.nome,
        grupo: u.grupo,
        irma: u.irma,
        tecnico: getTecnicoPorEscola(u.grupo) || getTecnicoPorEscola(u.nome),
        inventarioStatus: inventarioPorGrupo.get(normalizarNomeEscola(u.grupo)) || 'NAO_INFORMADO',
        usuariosAtivos,
        chamadosTotal,
        chamadosAbertos,
      }
    })

    painel.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    return res.json(painel)
  } catch (err) {
    throw err
  }
})


router.get('/', authMiddleware, async (_req: AuthenticatedRequest, res) => {
  try {
    const escolas = await prisma.escola.findMany({
      orderBy: { nome: 'asc' }
    })

    const mapaTecnicos = getMapaTecnicos()
    const enriched = escolas.map(e => ({
      ...e,
      tecnico: mapaTecnicos[normalizarNomeEscola(e.nome)] || e.tecnico
    }))

    return res.json(enriched)
  } catch (err) {
    throw err
  }
})

router.get('/tecnicos', authMiddleware, async (_req: AuthenticatedRequest, res) => {
  try {
    const mapaTecnicos = getMapaTecnicos()
    return res.json(mapaTecnicos)
  } catch (err) {
    throw err
  }
})

router.get('/nomes-padronizados', authMiddleware, async (_req: AuthenticatedRequest, res) => {
  return res.json(NOMES_PADRONIZADOS)
})

router.post('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const data = EscolaCreateSchema.parse(req.body)

    const existing = await prisma.escola.findUnique({ where: { nome: data.nome } })
    if (existing) {
      return res.status(409).json({ error: 'VALIDATION_ERROR', message: 'Escola já cadastrada' })
    }

    const nomeNormalizado = normalizarNomeEscola(data.nome)

    const escola = await prisma.escola.create({
      data: {
        nome: data.nome,
        nomeNormalizado,
        tecnico: data.tecnico
      }
    })

    return res.status(201).json(escola)
  } catch (err) {
    if (isZodError(err)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

export default router