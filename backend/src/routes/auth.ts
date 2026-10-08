import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../config/prisma'
import { signAccessToken, signRefreshToken, hashToken, verifyRefreshToken } from '../utils/jwt'
import { passwordPolicy } from '../utils/tokens'
import { authMiddleware, AuthenticatedRequest, requireRole, attachUserRecord } from '../middleware/auth'
import {
  LoginRequestSchema,
  ChangePasswordSchema,
  GerarCodigoPrimeiroAcessoSchema,
  LoginResponseSchema,
  VerificarEmailSchema,
  ConfirmarCodigoSchema,
  DefinirSenhaPrimeiroAcessoSchema,
} from '@shared/api'
import { ZodError } from 'zod'
import { isZodError } from '../utils/zodError'
import { grupoDaUnidade, papelDaUnidade } from '../services/normalization'
import {
  gerarCodigoPrimeiroAcesso,
  confirmarCodigo,
  validarToken,
  marcarTokenUsado,
  definirSenhaPrimeiroAcesso,
  CODIGO_TTL_MS,
} from '../services/primeiroAcesso'

const router = Router()

const BCRYPT_COST = 12
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/'
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refreshToken', token, REFRESH_COOKIE_OPTIONS)
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie('refreshToken', { ...REFRESH_COOKIE_OPTIONS, maxAge: 0 })
}

/**
 * Acrescenta ao usuário o contexto do grupo de escolas irmãs: `grupo` (nome
 * composto, compartilhado pelos equipamentos no SCE) e `papelUnidade`
 * (MAE administra o painel do grupo; FILHA só visualiza).
 */
function comUnidade(user: { filial: string }) {
  return {
    ...user,
    grupo: grupoDaUnidade(user.filial),
    papelUnidade: papelDaUnidade(user.filial),
  }
}

/**
 * Campos do usuário que podem sair para o cliente.
 *
 * Allow-list de propósito: `senhaHash` (e o `refreshTokenHash`) NUNCA podem ir
 * no corpo da resposta. O vazamento aconteceu porque a resposta era montada com
 * `...user` sobre o registro inteiro do Prisma — bastou um campo novo na tabela
 * para ele ir junto. Tudo que sai daqui passa por esta lista.
 */
const CAMPOS_PUBLICAVEIS = [
  'id',
  'email',
  'nome',
  'nivel',
  'filial',
  'status',
  'primeiroLogin',
  'createdAt',
  'updatedAt',
] as const

/** Projeta o registro do usuário no que pode ser publicado (+ contexto do grupo). */
function publicarUsuario(user: Record<string, unknown>) {
  const seguro: Record<string, unknown> = {}
  for (const campo of CAMPOS_PUBLICAVEIS) {
    if (user[campo] !== undefined) seguro[campo] = user[campo]
  }
  return comUnidade(seguro as { filial: string })
}

function buildLoginResponse(user: { id: string; email: string; nome: string; nivel: string; filial: string; primeiroLogin: boolean }) {
  const accessToken = signAccessToken(user as any)
  const refreshToken = signRefreshToken(user.id)
  const refreshTokenHash = hashToken(refreshToken)

  return { accessToken, refreshToken, refreshTokenHash, user: publicarUsuario(user) }
}

router.post('/login', async (req, res) => {
  try {
    const { email, senha } = LoginRequestSchema.parse(req.body)

    const user = await prisma.usuario.findUnique({
      where: { email: email.toLowerCase() },
      // `senhaHash` entra só para o bcrypt.compare; o corpo da resposta é
      // montado por publicarUsuario(), que nunca publica esse campo.
      select: {
        id: true,
        email: true,
        nome: true,
        nivel: true,
        filial: true,
        status: true,
        primeiroLogin: true,
        senhaHash: true,
      },
    })

    if (!user || user.status !== 'ATIVO') {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Credenciais inválidas' })
    }

    const valid = await bcrypt.compare(senha, user.senhaHash)
    if (!valid) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Credenciais inválidas' })
    }

    const { accessToken, refreshToken, refreshTokenHash, user: userResponse } = buildLoginResponse(user)

    await prisma.refreshToken.create({
      data: {
        tokenHash: refreshTokenHash,
        usuarioId: user.id,
        expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    })

    setRefreshCookie(res, refreshToken)

    return res.json({
      accessToken,
      refreshToken,
      user: userResponse,
      primeiroLogin: user.primeiroLogin
    })
  } catch (err) {
    if (isZodError(err)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken

    if (!refreshToken) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Refresh token não fornecido' })
    }

    const payload = verifyRefreshToken(refreshToken)
    if (!payload || payload.type !== 'refresh') {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Refresh token inválido' })
    }

    // O tokenHash é gravado com SHA-256 (hashToken) no login; a validação
    // precisa usar o mesmo hash — bcrypt.compare nunca bateria com SHA-256.
    const storedToken = await prisma.refreshToken.findFirst({
      where: { usuarioId: payload.sub, tokenHash: hashToken(refreshToken) }
    })

    if (!storedToken) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Sessão inválida' })
    }

    if (storedToken.expiraEm < new Date()) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } })
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Refresh token expirado ou inválido' })
    }

    await prisma.refreshToken.delete({ where: { id: storedToken.id } })

    const user = await prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, nome: true, nivel: true, filial: true, primeiroLogin: true, status: true }
    })

    if (!user || user.status !== 'ATIVO') {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Usuário não encontrado ou inativo' })
    }

    const { accessToken, refreshToken: newRefreshToken, refreshTokenHash, user: userResponse } = buildLoginResponse(user)

    await prisma.refreshToken.create({
      data: {
        tokenHash: refreshTokenHash,
        usuarioId: user.id,
        expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    })

    setRefreshCookie(res, newRefreshToken)

    return res.json({
      accessToken,
      refreshToken: newRefreshToken,
      user: userResponse,
      primeiroLogin: user.primeiroLogin
    })
  } catch (err) {
    if (isZodError(err)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

router.post('/logout', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user) {
      const refreshToken = req.cookies?.refreshToken
      if (refreshToken) {
        const tokenHash = hashToken(refreshToken)
        await prisma.refreshToken.deleteMany({
          where: { tokenHash, usuarioId: req.user.sub }
        })
      }
    }
    clearRefreshCookie(res)
    return res.json({ success: true })
  } catch (err) {
    clearRefreshCookie(res)
    throw err
  }
})

router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Não autenticado' })
    }

    const user = await prisma.usuario.findUnique({
      where: { id: req.user.sub },
      select: { id: true, email: true, nome: true, nivel: true, filial: true, status: true, primeiroLogin: true, createdAt: true, updatedAt: true }
    })

    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Usuário não encontrado' })
    }

    return res.json(comUnidade(user))
  } catch (err) {
    throw err
  }
})

router.post('/change-password', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { senhaAtual, novaSenha } = ChangePasswordSchema.parse(req.body)

    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Não autenticado' })
    }

    const user = await prisma.usuario.findUnique({ where: { id: req.user.sub } })
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Usuário não encontrado' })
    }

    if (!user.primeiroLogin) {
      const valid = await bcrypt.compare(senhaAtual, user.senhaHash)
      if (!valid) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Senha atual incorreta' })
      }
    }

    const policy = passwordPolicy.validate(novaSenha)
    if (!policy.valid) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Nova senha não atende aos requisitos', details: policy.errors.map(e => ({ field: 'novaSenha', message: e })) })
    }

    const novaSenhaHash = await bcrypt.hash(novaSenha, BCRYPT_COST)

    await prisma.usuario.update({
      where: { id: user.id },
      data: {
        senhaHash: novaSenhaHash,
        primeiroLogin: false
      }
    })

    await prisma.refreshToken.deleteMany({ where: { usuarioId: user.id } })
    clearRefreshCookie(res)

    return res.json({ success: true, message: 'Senha alterada com sucesso. Faça login novamente.' })
  } catch (err) {
    if (isZodError(err)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

// attachUserRecord é obrigatório aqui: rotas /api/auth são montadas ANTES do
// app.use('/api', authMiddleware, attachUserRecord) global, então sem ele o
// requireRole nunca vê req.userRecord e responde 401 "Usuário não autenticado".
router.post('/admin/gerar-codigo-primeiro-acesso', authMiddleware, attachUserRecord, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { email } = GerarCodigoPrimeiroAcessoSchema.parse(req.body)

    const resultado = await gerarCodigoPrimeiroAcesso(email)

    if (!resultado.podeGerar) {
      // Aqui o ADMIN pode e DEVE saber o motivo — é informação operacional
      // para ele decidir o que fazer, não enumeração anônima.
      const mensagens = {
        NAO_CADASTRADO: 'Usuário não encontrado',
        INATIVO: 'Usuário inativo — reative antes de gerar o código',
        JA_TEM_SENHA: 'Este usuário já definiu a senha',
      } as const
      return res.status(400).json({ error: 'CODIGO_NAO_GERAVEL', message: mensagens[resultado.motivo] })
    }

    return res.json({
      codigo: resultado.codigo,
      nome: resultado.nome,
      expiraEm: new Date(Date.now() + CODIGO_TTL_MS).toISOString(),
    })
  } catch (err) {
    if (isZodError(err)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

// ============================================
// PRIMEIRO ACESSO — três rotas públicas
// ============================================
//
// Reproduzem no portal o fluxo que o SCE antigo tinha (verificar o e-mail →
// primeiro acesso), com a etapa que faltava lá: a prova de que a pessoa foi de
// fato autorizada. As duas rotas do meio respondem SEM dizer se o e-mail está
// cadastrado — ver o comentário longo em `services/primeiroAcesso.ts`.

/**
 * Passo 1 da tela de acesso: diz qual passo mostrar depois do e-mail.
 *
 * Aqui a resposta é ambígua de propósito. Um `{ existe: false }` fiel seria um
 * enumerador de contas da rede escolar: quem visse "não cadastrado" para o
 * endereço da colega aprenderia que ela não usa o portal, e o inverso também.
 * Por isso o e-mail inexistente responde o MESMO objeto de um e-mail existente
 * que já tem senha — só a diferença real entre os casos que importa (ainda
 * está em primeiro acesso) é que vaza, e isso é justamente o que a pessoa
 * precisa saber para seguir o fluxo.
 */
router.post('/verificar-email', async (req, res) => {
  try {
    const { email } = VerificarEmailSchema.parse(req.body)

    const user = await prisma.usuario.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, status: true, primeiroLogin: true },
    })

    // E-mail não cadastrado se passa por um usuário ATIVO sem primeiro acesso:
    // resposta idêntica à de quem já tem senha, que também não entra neste fluxo.
    if (!user || user.status !== 'ATIVO' || !user.primeiroLogin) {
      return res.json({ existe: true, primeiroAcesso: false, ativo: true })
    }

    return res.json({ existe: true, primeiroAcesso: true, ativo: true })
  } catch (err) {
    if (isZodError(err)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'E-mail inválido' })
    }
    throw err
  }
})

/**
 * Passo 2: confere o código e devolve o token de criação de senha.
 *
 * Erro genérico e único para código errado, expirado, já usado ou inexistente:
 * distinguir os casos diria a quem está tentando adivinhar se o código estava
 * certo e só prestava a expirar.
 */
router.post('/primeiro-acesso/confirmar', async (req, res) => {
  try {
    const { email, codigo } = ConfirmarCodigoSchema.parse(req.body)

    const resultado = await confirmarCodigo(email, codigo)
    if (!resultado) {
      return res.status(400).json({
        error: 'CODIGO_INVALIDO',
        message: 'Código inválido ou expirado. Peça um novo código.',
      })
    }

    return res.json({ token: resultado.token, expiraEm: resultado.expiraEm.toISOString() })
  } catch (err) {
    if (isZodError(err)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Código inválido' })
    }
    throw err
  }
})

/**
 * Passo 4: cria a senha e JÁ ENTRE na sessão.
 *
 * Devolve access token + cookie de refresh como o login, porque a pessoa
 * acabou de provar que controla o e-mail e já escolheu a senha — pedir o login
 * de novo seria trabalho inútil.
 */
router.post('/primeiro-acesso/definir-senha', async (req, res) => {
  try {
    const { token, novaSenha, confirmarSenha } = DefinirSenhaPrimeiroAcessoSchema.parse(req.body)

    const validado = await validarToken(token)
    if (!validado) {
      return res.status(401).json({
        error: 'TOKEN_INVALIDO',
        message: 'Sua verificação expirou. Peça um novo código.',
      })
    }

    const resultado = await definirSenhaPrimeiroAcesso(validado.usuarioId, novaSenha, confirmarSenha)
    if (!resultado.ok) {
      return res.status(resultado.status).json({
        error: resultado.error,
        message: resultado.message,
        ...(resultado.errosSenha ? { details: resultado.errosSenha.map(e => ({ field: 'novaSenha', message: e })) } : {}),
      })
    }

    // Token consumido: a mesma confirmação não cria uma segunda senha.
    await marcarTokenUsado(validado.codigoConfirmadoId)

    const user = await prisma.usuario.findUnique({
      where: { id: validado.usuarioId },
      select: {
        id: true,
        email: true,
        nome: true,
        nivel: true,
        filial: true,
        status: true,
        primeiroLogin: true,
      },
    })
    if (!user || user.status !== 'ATIVO') {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Usuário inativo ou não encontrado' })
    }

    const { accessToken, refreshToken, refreshTokenHash, user: userResponse } = buildLoginResponse(user)

    await prisma.refreshToken.create({
      data: {
        tokenHash: refreshTokenHash,
        usuarioId: user.id,
        expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    setRefreshCookie(res, refreshToken)

    return res.json({ accessToken, user: userResponse, primeiroLogin: false })
  } catch (err) {
    if (isZodError(err)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
    }
    throw err
  }
})

export default router