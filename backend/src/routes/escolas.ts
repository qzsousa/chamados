import { Router, Response } from 'express'
import { prisma } from '../config/prisma'
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth'
import { EscolaSchema, EscolaCreateSchema } from '@shared/api'
import { ZodError } from 'zod'
import { normalizarNomeEscola, getMapaTecnicos, getTecnicoPorEscola, NOMES_PADRONIZADOS, listarUnidadesIndividuais } from '../services/normalization'

const router = Router()

/**
 * Os schemas vêm do pacote linkado @shared/api, que traz sua própria cópia do
 * zod — `instanceof ZodError` falha entre as duas cópias. Checar também o nome
 * da classe (mesmo padrão adotado em tutoriais.ts).
 */
function isZodError(err: unknown): err is ZodError {
  return err instanceof ZodError || (err as any)?.name === 'ZodError'
}

/** Casa tolerante de unidade: exata ou individual contida no composto (e vice-versa). */
function unidadeCasaPainel(a: string, b: string): boolean {
  const na = normalizarNomeEscola(a)
  const nb = normalizarNomeEscola(b)
  if (!na || !nb) return false
  return na === nb || (na.length > 3 && nb.includes(na)) || (nb.length > 3 && na.includes(nb))
}

/**
 * Chamado pertence à unidade quando o texto gravado É o nome individual dela
 * ou o contém (chamados antigos compostos "E.E. A / E.E. B" entram nas duas irmãs).
 * NUNCA o contrário: chamado individual da irmã não vaza para esta unidade.
 */
function chamadoPertenceAUnidade(unidadeChamado: string, nomeUnidade: string): boolean {
  const na = normalizarNomeEscola(unidadeChamado)
  const nb = normalizarNomeEscola(nomeUnidade)
  if (!na || !nb) return false
  return na === nb || (nb.length > 3 && na.includes(nb))
}

/**
 * Painel de unidades escolares (somente matriz): TODAS as unidades individuais
 * (escolas irmãs separadas), cada uma com grupo oficial, técnico, status de
 * inventário (grupo), usuários ativos e totais de chamados.
 * Os totais de equipamentos são mesclados no frontend a partir do SCE.
 */
router.get('/painel', authMiddleware, requireRole('ADMIN', 'TECNICO'), async (_req: AuthenticatedRequest, res) => {
  try {
    const unidades = listarUnidadesIndividuais()

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
      const usuariosAtivos = usuarios.filter(
        (x) => unidadeCasaPainel(x.filial, u.nome) || unidadeCasaPainel(x.filial, u.grupo),
      ).length

      let chamadosTotal = 0
      let chamadosAbertos = 0
      for (const c of chamadosAgrupados) {
        // o composto já contém o nome individual — basta comparar com o nome da unidade
        if (!chamadoPertenceAUnidade(c.unidade, u.nome)) continue
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