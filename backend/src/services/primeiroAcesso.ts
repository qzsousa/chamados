/**
 * Primeiro acesso: código gerado no sistema + criação de senha pela pessoa.
 *
 * O fluxo tem três portas encadeadas, e cada uma só abre a próxima:
 *
 *   1. `gerarCodigoPrimeiroAcesso(email)` → ADMIN gera o código de 6 dígitos
 *                                             e repassa à pessoa.
 *   2. `confirmarCodigo(email, c)`       → a pessoa digita os dígitos e recebe
 *                                             um `token` de uso único (10 min).
 *   3. `validarToken(token)`             → libera o `/definir-senha`.
 *
 * Por que existe um código, e não só o e-mail? Porque sem ele o `/definir-senha`
 * aceitaria "e-mail + senha nova" de qualquer um — e quem soubesse o endereço
 * institucional de um colega que ainda não tem senha tomava a conta. É o
 * defeito que a equipe do SCE registrou em `sce/security.js`. Aqui o código é
 * emitido pelo ADMIN e repassado em mão, então só quem foi de fato autorizado
 * consegue criar a senha.
 *
 * Regra que atravessa o arquivo inteiro: **o e-mail não pode ser erro de
 * resposta** nas rotas públicas. Um `200` não diz se o endereço existe, e um
 * erro não diz por quê — senão virava enumerador de quem usa o portal.
 */

import bcrypt from 'bcryptjs'
import { randomInt, randomBytes } from 'crypto'
import { prisma } from '../config/prisma'
import { hashToken, passwordPolicy } from '../utils/tokens'

/** Custo do bcrypt igual ao do login (`routes/auth.ts`). */
const BCRYPT_COST = 12

/**
 * O código vale 24 horas.
 *
 * Não é um e-mail que se expira em minutos: o ADMIN gera o código, entrega em
 * mão (papel, conversa,_direct) e a pessoa usa quando puder. 24h cobre o
 * "criei agora e só vou tentar amanhã" sem deixar o código pendurado semana
 * inteira.
 */
const CODIGO_TTL_MS = 24 * 60 * 60 * 1000

/** O token de uso único vale 10 minutos a partir da confirmação. */
const TOKEN_TTL_MS = 10 * 60 * 1000

/**
 * Tentativas de acertar o código antes de ele ser destruído.
 *
 * O código tem 1 em 1 milhão de combinações, mas o hash guardado é de um
 * código só: 5 chutes e o atacante precisa que o ADMIN gere outro.
 */
const MAX_TENTATIVAS = 5

/**
 * Resultado da geração do código, como união discriminada por `podeGerar`.
 *
 * A union (e não uma interface com flags) faz o TypeScript estreitar sozinho:
 * dentro de `if (!resultado.podeGerar)` o `motivo` já vem sem o `'GERADO'`, e
 * o chamador não consegue ler `codigo` sem antes checar que pode gerar.
 */
export type ResultadoGerar =
  | { podeGerar: true; motivo: 'GERADO'; codigo: string; nome: string }
  | { podeGerar: false; motivo: 'NAO_CADASTRADO' | 'INATIVO' | 'JA_TEM_SENHA' }

/** Gera 6 dígitos com `randomInt` (rejeição de módulo, previsível se usado Math.random). */
export function gerarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

/**
 * Cria e grava o código para um usuário já existente.
 *
 * Nível baixo, sem nenhuma consulta: recebe o que o chamador já tem em mãos.
 * Existe separado do `gerarCodigoPrimeiroAcesso` porque a rota de criação de
 * usuário acabou de gravar o registro — buscar de novo o mesmo e-mail seria
 * uma consulta à toa, e um ponto de falha a mais entre "usuário criado" e
 * "código emitido".
 */
export async function criarCodigoPrimeiroAcesso(usuarioId: string): Promise<string> {
  const codigo = gerarCodigo()
  const expiraEm = new Date(Date.now() + CODIGO_TTL_MS)

  // Descarta os códigos anteriores: um código novo invalida o antigo, então
  // só o último emitido é utilizável.
  await prisma.codigoPrimeiroAcesso.deleteMany({
    where: { usuarioId, usadoEm: null },
  })

  await prisma.codigoPrimeiroAcesso.create({
    data: { usuarioId, codigoHash: hashToken(codigo), expiraEm },
  })

  return codigo
}

/**
 * ADMIN gera o código de primeiro acesso de um usuário.
 *
 * Quem já tem senha não passa: emitir código para ela seria um oráculo de
 * "esta conta existe e já tem senha definitiva".
 */
export async function gerarCodigoPrimeiroAcesso(email: string): Promise<ResultadoGerar> {
  const alvo = email.trim().toLowerCase()

  const usuario = await prisma.usuario.findUnique({
    where: { email: alvo },
    select: { id: true, nome: true, status: true, primeiroLogin: true },
  })

  if (!usuario) return { podeGerar: false, motivo: 'NAO_CADASTRADO' }
  if (usuario.status !== 'ATIVO') return { podeGerar: false, motivo: 'INATIVO' }
  if (!usuario.primeiroLogin) return { podeGerar: false, motivo: 'JA_TEM_SENHA' }

  const codigo = await criarCodigoPrimeiroAcesso(usuario.id)

  return { podeGerar: true, motivo: 'GERADO', codigo, nome: usuario.nome as string }
}

/**
 * Confere o código e emite o token de criação de senha.
 *
 * Devolve `null` para qualquer falha (código errado, expirado, sem código
 * pendente) — o chamador responde a mesma mensagem nos quatro casos, senão o
 * erro vaza qual dos dois estava errado.
 */
export async function confirmarCodigo(
  email: string,
  codigoInformado: string,
): Promise<{ token: string; expiraEm: Date } | null> {
  const alvo = email.trim().toLowerCase()

  const usuario = await prisma.usuario.findUnique({
    where: { email: alvo },
    select: { id: true, primeiroLogin: true },
  })
  if (!usuario || !usuario.primeiroLogin) return null

  const registro = await prisma.codigoPrimeiroAcesso.findFirst({
    where: { usuarioId: usuario.id, usadoEm: null },
    orderBy: { criadoEm: 'desc' },
  })
  if (!registro) return null

  if (registro.tentativas >= MAX_TENTATIVAS) {
    await prisma.codigoPrimeiroAcesso.delete({ where: { id: registro.id } })
    return null
  }

  // Expirado: apaga para não ficar acumulando lixo.
  if (registro.expiraEm < new Date()) {
    await prisma.codigoPrimeiroAcesso.delete({ where: { id: registro.id } })
    return null
  }

  if (hashToken(codigoInformado) !== registro.codigoHash) {
    await prisma.codigoPrimeiroAcesso.update({
      where: { id: registro.id },
      data: { tentativas: { increment: 1 } },
    })
    return null
  }

  // Código certo: emite o token de 10 min que autoriza a criação da senha.
  const token = randomBytes(32).toString('hex')
  const expiraEm = new Date(Date.now() + TOKEN_TTL_MS)

  // Revoga tokens de uma confirmação anterior: pedir outro código no meio do
  // caminho não pode deixar duas janelas abertas ao mesmo tempo.
  await prisma.codigoConfirmado.updateMany({
    where: { codigoId: registro.id, revogadoEm: null },
    data: { revogadoEm: new Date() },
  })

  await prisma.codigoConfirmado.create({
    data: { codigoId: registro.id, tokenHash: hashToken(token), expiraEm },
  })

  return { token, expiraEm }
}

/**
 * Confere o token de criação de senha e devolve o usuário.
 *
 * Não consome: o consumo acontece em `marcarTokenUsado`, depois que a senha
 * foi gravada com sucesso. Assim uma falha de escrita não obriga a pessoa a
 * pedir um código novo.
 */
export async function validarToken(
  token: string,
): Promise<{ usuarioId: string; codigoConfirmadoId: string } | null> {
  const registro = await prisma.codigoConfirmado.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiraEm: true,
      revogadoEm: true,
      codigo: { select: { usuarioId: true, usadoEm: true } },
    },
  })

  if (!registro) return null
  if (registro.revogadoEm) return null
  if (registro.expiraEm < new Date()) return null
  if (registro.codigo.usadoEm) return null

  return { usuarioId: registro.codigo.usuarioId, codigoConfirmadoId: registro.id }
}

/**
 * Fecha as portas depois de uma senha bem criada: o token não pode ser
 * reaproveitado e o código sai da pendência.
 */
export async function marcarTokenUsado(codigoConfirmadoId: string): Promise<void> {
  const registro = await prisma.codigoConfirmado.findUnique({
    where: { id: codigoConfirmadoId },
    select: { codigoId: true },
  })
  if (!registro) return

  await prisma.codigoConfirmado.update({
    where: { id: codigoConfirmadoId },
    data: { revogadoEm: new Date() },
  })
  await prisma.codigoPrimeiroAcesso.updateMany({
    where: { id: registro.codigoId },
    data: { usadoEm: new Date() },
  })
}

/**
 * Grava a senha nova e fecha o primeiro acesso.
 *
 * Derruba as sessões existentes: a senha acabou de mudar, então qualquer
 * sessão aberta com a senha temporária do ADMIN deixa de valer.
 */
export async function definirSenhaPrimeiroAcesso(
  usuarioId: string,
  novaSenha: string,
  confirmarSenha: string,
): Promise<
  | { ok: true }
  | { ok: false; status: number; error: string; message: string; errosSenha?: string[] }
> {
  if (novaSenha !== confirmarSenha) {
    return {
      ok: false,
      status: 400,
      error: 'VALIDATION_ERROR',
      message: 'A confirmação não confere com a nova senha.',
    }
  }

  const politica = passwordPolicy.validate(novaSenha)
  if (!politica.valid) {
    return {
      ok: false,
      status: 400,
      error: 'VALIDATION_ERROR',
      message: 'A senha não atende aos requisitos.',
      errosSenha: politica.errors,
    }
  }

  const senhaHash = await bcrypt.hash(novaSenha, BCRYPT_COST)

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { senhaHash, primeiroLogin: false },
  })

  await prisma.refreshToken.deleteMany({ where: { usuarioId } })

  return { ok: true }
}

/**
 * Limpa códigos e tokens expirados.
 *
 * Chamado pelo agendador do `index.ts`, junto com a limpeza de anexos.
 */
export async function limparCodigosExpirados(): Promise<number> {
  const agora = new Date()
  const confirmados = await prisma.codigoConfirmado.deleteMany({ where: { expiraEm: { lt: agora } } })
  const codigos = await prisma.codigoPrimeiroAcesso.deleteMany({ where: { expiraEm: { lt: agora } } })
  return confirmados.count + codigos.count
}

export { CODIGO_TTL_MS, TOKEN_TTL_MS, MAX_TENTATIVAS }