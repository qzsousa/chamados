import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../config/prisma'
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth'
import { UserCreateSchema, UserUpdateSchema, UserWithCodigoSchema, PaginatedResponseSchema, UserSchema } from '@shared/api'
import { passwordPolicy } from '../utils/tokens'
import { criarCodigoPrimeiroAcesso } from '../services/primeiroAcesso'
import { syncUsuarioParaSce } from '../services/sceSync'
import { escoposInvalidos } from '../services/escopo'
import { ZodError } from 'zod'
import { isZodError } from '../utils/zodError'

const router = Router()
const BCRYPT_COST = 12

/** Limite de visualizadores ativos por unidade (regra vinda do SCE: gestor + 2). */
const MAX_GESTORES_UNIDADE = 2

/**
 * Campos devolvidos nas respostas de usuário. `escopoTipos` entra aqui porque a
 * tela de usuários mostra as checkboxes de tipo já marcadas ao abrir o cadastro.
 *
 * Fica em uma constante porque as quatro rotas repetiam a mesma lista — e uma
 * delas esquecer o campo novo faria a tela abrir vazia sem aviso.
 */
const selectUsuario = {
  id: true,
  email: true,
  nome: true,
  nivel: true,
  filial: true,
  status: true,
  primeiroLogin: true,
  escopoTipos: true,
  createdAt: true,
  updatedAt: true,
} as const

/**
 * Valida o `escopoTipos` informado no corpo do request.
 *
 * - Só o ADMIN grava escopo: ele é um AUMENTO de acesso (quem tem escopo vê
 *   chamado de qualquer escola), então o Gestor fica de fora — igual já
 *   acontece com `nivel` e `filial` logo abaixo.
 * - Cada valor precisa existir no formulário ativo. Gravar um escopo órfão é o
 *   pior desfecho possível: o usuário voltaria a ver TUDO sem ninguém perceber
 *   que a restrição não está valendo.
 *
 * `escopo === undefined` devolve lista vazia com `ok`: quem não mandou o campo
 * não quer mexer nele.
 */
async function validarEscopo(
  req: AuthenticatedRequest,
  escopo: string[] | undefined,
): Promise<
  | { ok: true; escopo: string[] }
  | { ok: false; status: number; error: string; message: string }
> {
  if (escopo === undefined) return { ok: true, escopo: [] }

  const nivel = req.userRecord?.nivel || req.user?.nivel
  if (nivel !== 'ADMIN') {
    return {
      ok: false,
      status: 403,
      error: 'FORBIDDEN',
      message: 'Apenas o Administrador define o escopo de tipos de chamado.',
    }
  }

  const invalidos = await escoposInvalidos(escopo)
  if (invalidos.length) {
    return {
      ok: false,
      status: 400,
      error: 'VALIDATION_ERROR',
      message: `Tipo de chamado inexistente no formulário: ${invalidos.join(', ')}.`,
    }
  }

  return { ok: true, escopo }
}

/** ADMIN ou GESTOR (gestor fica restrito à própria filial nas regras abaixo). */
function adminOuGestor(req: AuthenticatedRequest, res: Response, next: () => void): void {
  // userRecord (attachUserRecord) em produção; req.user é o fallback
  const nivel = req.userRecord?.nivel || req.user?.nivel
  if (!nivel) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Não autenticado' })
    return
  }
  if (nivel === 'ADMIN' || nivel === 'GESTOR') {
    next()
    return
  }
  res.status(403).json({ error: 'FORBIDDEN', message: 'Apenas Administrador ou Gestor podem gerenciar usuários' })
}

router.get('/', authMiddleware, adminOuGestor, async (req: AuthenticatedRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
    const search = (req.query.search as string) || ''
    const nivel = req.query.nivel as string
    const status = req.query.status as string
    const filial = (req.query.filial as string) || ''

    const nivelRequisitante = req.userRecord?.nivel || req.user?.nivel

    const where: any = {}
    // Condições independentes do filtro de busca: ficam em `AND` para não
    // disputarem o mesmo `OR` que o `search` já usa.
    const and: any[] = []

    if (nivelRequisitante === 'GESTOR') {
      where.filial = (req.userRecord?.filial || req.user?.filial || '')
    }
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { nome: { contains: search, mode: 'insensitive' } }
      ]
    }
    if (nivel) where.nivel = nivel
    if (status) where.status = status

    /**
     * Filtro de unidade.
     *
     * `contains` em vez de igualdade porque o TECNICO guarda as várias
     * unidades que atende na MESMA linha de `filial`, separadas por vírgula
     * (`unidadesDoUsuario`); casar pelo nome exato da lista o esconderia.
     *
     * Para o GESTOR o parâmetro é ignorado de propósito: acima ele já ficou
     * preso na própria filial, e aplicá-lo aqui sobrescreveria essa trava —
     * bastaria `?filial=<outra escola>` para ver usuários de outra unidade.
     */
    if (filial && nivelRequisitante !== 'GESTOR') {
      and.push({ filial: { contains: filial, mode: 'insensitive' } })
    }
    if (and.length) where.AND = and

    const [total, data] = await Promise.all([
      prisma.usuario.count({ where }),
      prisma.usuario.findMany({
        where,
        select: selectUsuario,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' }
      })
    ])

    return res.json({
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
    })
  } catch (err) {
    throw err
  }
})

router.post('/', authMiddleware, adminOuGestor, async (req: AuthenticatedRequest, res) => {
  try {
    const data = UserCreateSchema.parse(req.body)

    // GESTOR cria apenas VISUALIZADOR da própria unidade, máx. 2 ativos além dele
    if ((req.userRecord?.nivel || req.user?.nivel) === 'GESTOR') {
      data.nivel = 'VISUALIZADOR'
      data.filial = (req.userRecord?.filial || req.user?.filial || '')

      const ativosNaUnidade = await prisma.usuario.count({
        where: { filial: (req.userRecord?.filial || req.user?.filial || ''), status: 'ATIVO' }
      })
      if (ativosNaUnidade >= MAX_GESTORES_UNIDADE + 1) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: `Limite de ${MAX_GESTORES_UNIDADE} usuários por unidade atingido. Desative um usuário existente antes.`
        })
      }
    }

    const escopo = await validarEscopo(req, data.escopoTipos)
    if (!escopo.ok) {
      return res.status(escopo.status).json({ error: escopo.error, message: escopo.message })
    }

    const existing = await prisma.usuario.findUnique({ where: { email: data.email.toLowerCase() } })
    if (existing) {
      return res.status(409).json({ error: 'VALIDATION_ERROR', message: 'Email já cadastrado' })
    }

    /**
     * A senha do cadastro é um valor aleatório que NINGUÉM vai conhecer.
     *
     * Ela existe só porque a coluna `senhaHash` é obrigatória — e é justamente
     * isso que impede o login direto: sem o código de primeiro acesso, ninguém
     * tem credencial para esta conta. A pessoa cria a senha dela no
     * `/primeiro-acesso/definir-senha`, e a senha temporária nunca é usada.
     */
    const senhaSemDono = passwordPolicy.generateTemp()
    const senhaHash = await bcrypt.hash(senhaSemDono, BCRYPT_COST)

    const user = await prisma.usuario.create({
      data: {
        email: data.email.toLowerCase(),
        nome: data.nome,
        nivel: data.nivel,
        filial: data.filial,
        senhaHash,
        primeiroLogin: true,
        escopoTipos: escopo.escopo
      },
      select: selectUsuario
    })

    // O código de primeiro acesso já sai pronto na criação: o ADMIN repassa
    // para a pessoa e ela cria a própria senha. Usa a função de baixo nível
    // porque o registro acabou de ser gravado — não há o que buscar de novo.
    const codigoPrimeiroAcesso = await criarCodigoPrimeiroAcesso(user.id)

    // Mantém a tabela `usuarios` do SCE sincronizada (portal usa um login só)
    syncUsuarioParaSce(user).catch(() => {})

    return res.status(201).json({ ...user, codigoPrimeiroAcesso })
  } catch (err) {
    if (isZodError(err)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

router.get('/:id', authMiddleware, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.usuario.findUnique({
      where: { id: req.params.id },
      select: selectUsuario
    })

    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Usuário não encontrado' })
    }

    return res.json(user)
  } catch (err) {
    throw err
  }
})

router.patch('/:id', authMiddleware, adminOuGestor, async (req: AuthenticatedRequest, res) => {
  try {
    const data = UserUpdateSchema.parse(req.body)

    const user = await prisma.usuario.findUnique({ where: { id: req.params.id } })
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Usuário não encontrado' })
    }

    // GESTOR: só usuários da própria filial, sem mudar nível, e sem tocar ADMIN/outro GESTOR
    if ((req.userRecord?.nivel || req.user?.nivel) === 'GESTOR') {
      const mesmaFilial = user.filial === (req.userRecord?.filial || req.user?.filial || '')
      const alvoRestrito = user.nivel === 'VISUALIZADOR'
      if (!mesmaFilial || !alvoRestrito) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Gestores só podem editar visualizadores da própria unidade' })
      }
      data.nivel = undefined
      data.filial = undefined
      data.escopoTipos = undefined
    }

    // `undefined` deixa a coluna como está; `[]` limpa o escopo (volta a ver
    // tudo). A distinção importa: o checkbox "sem restrição" manda lista vazia.
    let escopo: string[] | undefined
    if (data.escopoTipos !== undefined) {
      const validado = await validarEscopo(req, data.escopoTipos)
      if (!validado.ok) {
        return res.status(validado.status).json({ error: validado.error, message: validado.message })
      }
      escopo = validado.escopo
    }

    const updated = await prisma.usuario.update({
      where: { id: req.params.id },
      data: {
        nome: data.nome,
        nivel: data.nivel,
        filial: data.filial,
        status: data.status,
        escopoTipos: escopo
      },
      select: selectUsuario
    })

    if (data.status === 'INATIVO') {
      await prisma.refreshToken.deleteMany({ where: { usuarioId: updated.id } })
    }

    syncUsuarioParaSce(updated).catch(() => {})

    return res.json(updated)
  } catch (err) {
    if (isZodError(err)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

router.delete('/:id', authMiddleware, adminOuGestor, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.usuario.findUnique({ where: { id: req.params.id } })
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Usuário não encontrado' })
    }

    if (user.id === req.user?.sub) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Não pode desativar a si mesmo' })
    }

    // GESTOR: só visualizadores da própria filial
    if ((req.userRecord?.nivel || req.user?.nivel) === 'GESTOR') {
      if (user.filial !== (req.userRecord?.filial || req.user?.filial || '') || user.nivel !== 'VISUALIZADOR') {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Gestores só podem desativar visualizadores da própria unidade' })
      }
    }

    await prisma.usuario.update({
      where: { id: req.params.id },
      data: { status: 'INATIVO' }
    })

    await prisma.refreshToken.deleteMany({ where: { usuarioId: req.params.id } })

    syncUsuarioParaSce({ ...user, status: 'INATIVO' }).catch(() => {})

    return res.json({ success: true })
  } catch (err) {
    throw err
  }
})

export default router