/**
 * Senha provisória: a Matriz resetando a senha de quem já tem senha e esqueceu.
 *
 * O problema que estes testes existem para travar: `gerar-codigo-primeiro-acesso`
 * recusa quem já tem senha com `JA_TEM_SENHA`, e a pessoa encontrou exatamente
 * isso ao tentar ajudar alguém que esqueceu a senha. O caminho novo é a senha
 * provisória, e ela precisa:
 *
 *  - funcionar para quem JÁ tem senha (o caso que travava);
 *  - marcar a senha como provisória, para o login obrigar a troca;
 *  - limpar a marca quando a senha é trocada — senão a pessoa entra e é jogada
 *    de volta para a troca, em laço;
 *  - derrubar as sessões antigas, porque a senha acabou de mudar.
 *
 * A distinção que sustenta tudo: `primeiroLogin` = "nunca definiu senha",
 * `senhaProvisoria` = "esta senha atual não é definitiva". São perguntas
 * diferentes e precisavam de colunas diferentes.
 *
 * O bcrypt NÃO é mockado aqui: a senha gerada precisa passar pela política de
 * senha de verdade, e um hash de mentira esconderia exatamente o defeito que
 * estes testes caçam (a Matriz gerar uma senha que a pessoa não conseguirá
 * trocar). O custo é um bcrypt por teste — irrelevante nesta suíte.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '../config/prisma'
import { gerarSenhaProvisoria } from '../services/primeiroAcesso'
import { passwordPolicy } from '../utils/tokens'

vi.mock('../config/prisma', () => ({
  prisma: {
    usuario: { findUnique: vi.fn(), update: vi.fn() },
    refreshToken: { deleteMany: vi.fn() },
  },
}))

const USUARIO = {
  id: 'u1',
  nome: 'Maria Souza',
  email: 'maria@educacao.sp.gov.br',
  status: 'ATIVO',
}

describe('Senha provisória — serviço', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.usuario.update).mockResolvedValue({} as any)
    vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 0 } as any)
    vi.mocked(prisma.usuario.findUnique).mockResolvedValue(USUARIO as any)
  })

  it('gera senha para quem JÁ tem senha — o caso que antes era recusado', async () => {
    const r = await gerarSenhaProvisoria(USUARIO.email)

    // A diferença para `gerarCodigoPrimeiroAcesso`: aqui NÃO há recusa por já
    // ter senha. É o objetivo da rota.
    expect(r.podeGerar).toBe(true)
    if (r.podeGerar) {
      expect(r.senha).toBeTruthy()
      expect(r.nome).toBe(USUARIO.nome)
    }
  })

  it('gera uma senha que a própria política aceita', async () => {
    // Se a Matriz entrega uma senha que a política recusa, a pessoa não
    // consegue trocar e fica presa. O bcrypt roda de verdade por isso.
    const r = await gerarSenhaProvisoria(USUARIO.email)

    if (r.podeGerar) {
      const politica = passwordPolicy.validate(r.senha)
      expect(politica.valid, `senha "${r.senha}" não passa na política`).toBe(true)
    }
  })

  it('grava um hash da senha, não a senha em si', async () => {
    const r = await gerarSenhaProvisoria(USUARIO.email)
    if (!r.podeGerar) throw new Error('deveria ter gerado')

    const dados = vi.mocked(prisma.usuario.update).mock.calls[0][0].data
    expect(dados.senhaHash).toBeTruthy()
    expect(dados.senhaHash).not.toBe(r.senha)
  })

  it('marca a senha como provisória sem mexer no primeiroLogin', async () => {
    await gerarSenhaProvisoria(USUARIO.email)

    const dados = vi.mocked(prisma.usuario.update).mock.calls[0][0].data
    expect(dados.senhaProvisoria).toBe(true)
    // A pessoa JÁ tem senha. Se isto virar true, ela sai do fluxo normal e cai
    // no código de 6 dígitos — caminho errado para quem esqueceu.
    expect(dados.primeiroLogin).toBe(false)
  })

  it('derruba as sessões antigas: a senha acabou de mudar', async () => {
    await gerarSenhaProvisoria(USUARIO.email)

    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { usuarioId: USUARIO.id },
    })
  })

  it('recusa usuário inexistente sem tocar no banco', async () => {
    vi.mocked(prisma.usuario.findUnique).mockResolvedValue(null as any)

    const r = await gerarSenhaProvisoria('ninguem@x.com')

    expect(r).toMatchObject({ podeGerar: false, motivo: 'NAO_CADASTRADO' })
    expect(prisma.usuario.update).not.toHaveBeenCalled()
  })

  it('recusa usuário inativo sem tocar no banco', async () => {
    vi.mocked(prisma.usuario.findUnique).mockResolvedValue({ ...USUARIO, status: 'INATIVO' } as any)

    const r = await gerarSenhaProvisoria(USUARIO.email)

    expect(r).toMatchObject({ podeGerar: false, motivo: 'INATIVO' })
    expect(prisma.usuario.update).not.toHaveBeenCalled()
  })

  it('normaliza o e-mail como o resto do fluxo', async () => {
    await gerarSenhaProvisoria('  MARIA@Educacao.sp.gov.BR  ')

    expect(vi.mocked(prisma.usuario.findUnique).mock.calls[0][0].where.email).toBe(
      'maria@educacao.sp.gov.br',
    )
  })

  it('gera senha diferente a cada chamada', async () => {
    const a = await gerarSenhaProvisoria(USUARIO.email)
    const b = await gerarSenhaProvisoria(USUARIO.email)

    if (a.podeGerar && b.podeGerar) {
      expect(a.senha).not.toBe(b.senha)
    }
  })
})