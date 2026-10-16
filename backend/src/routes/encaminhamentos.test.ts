import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import chamadoRoutes from './chamados'
import encaminhamentoRoutes from './encaminhamentos'
import { errorHandler } from '../middleware/errorHandler'
import { pino } from 'pino'
import { prisma } from '../config/prisma'
import { encaminharChamado, tecnicosDaUnidade } from '../services/encaminhamento'

vi.mock('../config/prisma', () => ({
  prisma: {
    usuario: { findMany: vi.fn(), findFirst: vi.fn() },
    chamado: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    encaminhamentoRegra: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
    formularioCategoria: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}))

// Só as funções que fazem I/O são mockadas; `destinoWhere` (o filtro Prisma
// de quem pode receber encaminhamento) vem do módulo real, para o teste
// valer contra a mesma definição que a rota usa.
vi.mock('../services/encaminhamento', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/encaminhamento')>()),
  encaminharChamado: vi.fn(),
  encaminharPorRegras: vi.fn(),
  tecnicosDaUnidade: vi.fn(),
  encaminharPendentes: vi.fn(),
}))

vi.mock('../services/email', () => ({
  notificarChamadoStatusAlterado: vi.fn(),
  notificarChamadoCriado: vi.fn(),
  notificarChamadoConcluido: vi.fn(),
}))

vi.mock('../services/notificacoes', () => ({
  notificarAdmins: vi.fn(),
  notificarUnidade: vi.fn(),
  notificarUsuario: vi.fn(),
}))

vi.mock('../middleware/auth', () => {
  const req: any = {
    user: { sub: 'user-1', email: 'admin@test.com', nome: 'Ana Admin', nivel: 'ADMIN' },
    userRecord: { id: 'user-1', email: 'admin@test.com', nome: 'Ana Admin', nivel: 'ADMIN', filial: 'URE Leste 3', status: 'ATIVO', primeiroLogin: false },
  }
  const authMiddleware = (r: any, _res: any, next: any) => {
    Object.assign(r, req)
    next()
  }
  const requireRole = (...roles: string[]) => (r: any, res: any, next: any) => {
    if (!roles.includes(r.userRecord.nivel)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Sem permissão' })
    }
    next()
  }
  return { authMiddleware, requireRole, attachUserRecord: authMiddleware }
})

/** Id no formato cuid (o schema valida) — os ids reais vêm do Prisma. */
const TEC_ID = 'clh3k4j5k0000abcd1234efgh'

const CHAMADO = {
  id: 'chamado-1',
  protocolo: 'CH-20260925-0001',
  unidade: 'E.E. BELIZE',
  tipo: 'Equipamento - Manutenção',
  urgencia: 'Média',
  responsavel: null,
  status: 'ABERTO',
  categoriaChave: 'equipamento',
  historico: 'inicio',
}

const TECNICO = { id: TEC_ID, nome: 'Carlos Souza', email: 'c@sp.gov.br', filial: 'E.E. BELIZE', abertos: 2 }

const createApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/api/chamados', chamadoRoutes)
  app.use('/api/encaminhamentos', encaminhamentoRoutes)
  app.use(errorHandler(pino({ level: 'silent' })))
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /chamados/encaminhar/tecnicos', () => {
  it('lista os técnicos ativos para o seletor', async () => {
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([{ id: 'tec-1', nome: 'Carlos', email: 'c@sp.gov.br', filial: 'E.E. BELIZE', escopoTipos: [] }] as any)
    const res = await request(createApp()).get('/api/chamados/encaminhar/tecnicos')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })

  it('ADMIN entra na lista: o chefe do setor atende chamado, ele só não é "técnico"', async () => {
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([] as any)
    await request(createApp()).get('/api/chamados/encaminhar/tecnicos')
    expect(vi.mocked(prisma.usuario.findMany).mock.calls[0][0]?.where).toEqual({
      nivel: { in: ['ADMIN', 'TECNICO'] },
      status: 'ATIVO',
    })
  })

  it('não expõe escopoTipos: é configuração do perfil, não dado do chamado', async () => {
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([
      { id: 'tec-1', nome: 'Carlos', email: 'c@sp.gov.br', filial: 'E.E. BELIZE', escopoTipos: ['sistemas::PortalNet'] },
    ] as any)
    const res = await request(createApp()).get('/api/chamados/encaminhar/tecnicos')
    expect(res.body.data[0]).toEqual({ id: 'tec-1', nome: 'Carlos', email: 'c@sp.gov.br', filial: 'E.E. BELIZE' })
  })

  it('com categoriaChave de liberação, só entra quem marcou no perfil', async () => {
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([
      { id: 'tec-1', nome: 'Da Sistemas', email: 'a@sp.gov.br', filial: 'URE', escopoTipos: ['sistemas::PortalNet'] },
      { id: 'tec-2', nome: 'Da Rede', email: 'b@sp.gov.br', filial: 'URE', escopoTipos: [] },
    ] as any)

    const res = await request(createApp()).get('/api/chamados/encaminhar/tecnicos?categoriaChave=sistemas')

    expect(res.body.data.map((t: any) => t.nome)).toEqual(['Da Sistemas'])
  })

  it('categoriaChave de categoria comum não filtra a lista', async () => {
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([
      { id: 'tec-1', nome: 'Da Sistemas', email: 'a@sp.gov.br', filial: 'URE', escopoTipos: ['sistemas::PortalNet'] },
      { id: 'tec-2', nome: 'Da Rede', email: 'b@sp.gov.br', filial: 'URE', escopoTipos: [] },
    ] as any)

    const res = await request(createApp()).get('/api/chamados/encaminhar/tecnicos?categoriaChave=equipamento')

    expect(res.body.data).toHaveLength(2)
  })
})

describe('GET /chamados/encaminhar/tecnicos/:id', () => {
  it('sugere os técnicos da unidade do chamado', async () => {
    vi.mocked(prisma.chamado.findUnique).mockResolvedValue({ unidade: 'E.E. BELIZE', tipo: 'Equipamento - Formatação', categoriaChave: 'equipamento' } as any)
    vi.mocked(tecnicosDaUnidade).mockResolvedValue([TECNICO])
    const res = await request(createApp()).get('/api/chamados/encaminhar/tecnicos/chamado-1')
    expect(res.status).toBe(200)
    expect(res.body.data[0].nome).toBe('Carlos Souza')
  })

  /**
   * Sem `tipo`/`categoriaChave` a fila é montada sem saber o assunto, e quem
   * atende por escopo fica sempre de fora — o oposto do que se quer num
   * chamado de Sistemas.
   */
  it('manda o chamado para a fila, para o escopo conseguir ser avaliado', async () => {
    vi.mocked(prisma.chamado.findUnique).mockResolvedValue({ unidade: 'E.E. BELIZE', tipo: 'Sistemas - PortalNet', categoriaChave: 'sistemas' } as any)
    vi.mocked(tecnicosDaUnidade).mockResolvedValue([])
    await request(createApp()).get('/api/chamados/encaminhar/tecnicos/chamado-1')
    expect(tecnicosDaUnidade).toHaveBeenCalledWith(
      'E.E. BELIZE',
      expect.objectContaining({ tipo: 'Sistemas - PortalNet', categoriaChave: 'sistemas' }),
    )
  })

  it('404 para chamado inexistente', async () => {
    vi.mocked(prisma.chamado.findUnique).mockResolvedValue(null as any)
    const res = await request(createApp()).get('/api/chamados/encaminhar/tecnicos/nao-existe')
    expect(res.status).toBe(404)
  })
})

describe('POST /chamados/:id/encaminhar', () => {
  it('encaminha para o técnico da unidade e devolve o chamado atualizado', async () => {
    vi.mocked(prisma.chamado.findUnique).mockResolvedValue(CHAMADO as any)
    vi.mocked(encaminharChamado).mockResolvedValue({ ok: true, tecnico: TECNICO, chamado: CHAMADO } as any)

    const res = await request(createApp()).post('/api/chamados/chamado-1/encaminhar').send({ modo: 'UNIDADE' })

    expect(res.status).toBe(200)
    expect(res.body.tecnico.nome).toBe('Carlos Souza')
    expect(encaminharChamado).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'chamado-1' }),
      expect.objectContaining({ modo: 'UNIDADE', origem: 'Manual', autor: 'Ana Admin' }),
    )
  })

  it('repassa o técnico escolhido e a observação', async () => {
    vi.mocked(prisma.chamado.findUnique).mockResolvedValue(CHAMADO as any)
    vi.mocked(encaminharChamado).mockResolvedValue({ ok: true, tecnico: TECNICO, chamado: CHAMADO } as any)

    const res = await request(createApp())
      .post('/api/chamados/chamado-1/encaminhar')
      .send({ modo: 'TECNICO', tecnicoId: TEC_ID, observacao: 'categoria errada' })

    expect(res.status).toBe(200)
    expect(encaminharChamado).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ modo: 'TECNICO', tecnicoId: TEC_ID, observacao: 'categoria errada' }),
    )
  })

  it('422 (não 500) quando não há técnico para a unidade', async () => {
    vi.mocked(prisma.chamado.findUnique).mockResolvedValue(CHAMADO as any)
    vi.mocked(encaminharChamado).mockResolvedValue({
      ok: false,
      tecnico: null,
      chamado: CHAMADO,
      motivo: 'Nenhum técnico ativo atendendo esta unidade está cadastrado.',
    } as any)

    const res = await request(createApp()).post('/api/chamados/chamado-1/encaminhar').send({ modo: 'UNIDADE' })
    expect(res.status).toBe(422)
    expect(res.body.message).toContain('técnico')
  })

  it('400 quando modo TECNICO vem sem técnico (não trava em timeout)', async () => {
    vi.mocked(prisma.chamado.findUnique).mockResolvedValue(CHAMADO as any)
    const res = await request(createApp()).post('/api/chamados/chamado-1/encaminhar').send({ modo: 'TECNICO' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VALIDATION_ERROR')
  })

  it('404 para chamado inexistente', async () => {
    vi.mocked(prisma.chamado.findUnique).mockResolvedValue(null as any)
    const res = await request(createApp()).post('/api/chamados/nao-existe/encaminhar').send({ modo: 'UNIDADE' })
    expect(res.status).toBe(404)
  })
})

describe('Regras de encaminhamento (ADMIN)', () => {
  it('lista regras, categorias e técnicos', async () => {
    vi.mocked(prisma.encaminhamentoRegra.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.formularioCategoria.findMany).mockResolvedValue([{ chave: 'equipamento', nome: 'Equipamento' }] as any)
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([] as any)
    const res = await request(createApp()).get('/api/encaminhamentos')
    expect(res.status).toBe(200)
    expect(res.body.categorias).toHaveLength(1)
  })

  it('salva a regra com o técnico fixo resolvido', async () => {
    vi.mocked(prisma.usuario.findFirst).mockResolvedValue({ nome: 'Carlos Souza' } as any)
    vi.mocked(prisma.encaminhamentoRegra.upsert).mockResolvedValue({ id: 'r1', categoriaChave: 'equipamento' } as any)
    const res = await request(createApp())
      .put('/api/encaminhamentos')
      .send({ categoriaChave: 'equipamento', modo: 'TECNICO', tecnicoId: TEC_ID, ativa: true })
    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.encaminhamentoRegra.upsert).mock.calls[0][0].create).toMatchObject({
      categoriaChave: 'equipamento',
      tecnicoId: TEC_ID,
      tecnicoNome: 'Carlos Souza',
    })
  })

  it('recusa técnico fixo inválido', async () => {
    vi.mocked(prisma.usuario.findFirst).mockResolvedValue(null as any)
    const res = await request(createApp())
      .put('/api/encaminhamentos')
      .send({ categoriaChave: 'equipamento', modo: 'TECNICO', tecnicoId: 'clh3k4j5k0000abcd1234zzzz', ativa: true })
    expect(res.status).toBe(400)
  })

  it('aceita ADMIN como técnico fixo, com o mesmo filtro da lista', async () => {
    vi.mocked(prisma.usuario.findFirst).mockResolvedValue({ nome: 'Jessica Alves', escopoTipos: ['sistemas::PortalNet'] } as any)
    vi.mocked(prisma.encaminhamentoRegra.upsert).mockResolvedValue({ id: 'r1', categoriaChave: 'sistemas' } as any)
    const res = await request(createApp())
      .put('/api/encaminhamentos')
      .send({ categoriaChave: 'sistemas', modo: 'TECNICO', tecnicoId: TEC_ID, ativa: true })
    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.usuario.findFirst).mock.calls[0][0]?.where).toEqual({
      id: TEC_ID,
      nivel: { in: ['ADMIN', 'TECNICO'] },
      status: 'ATIVO',
    })
  })

  /**
   * Regra apontada para quem não atende o assunto nunca dispara: o
   * encaminhamento é recusado lá na hora de aplicar, longe de quem configurou.
   * Recusar aqui é o que devolve a mensagem certa para a tela.
   */
  it('recusa técnico fixo sem a categoria liberada no perfil', async () => {
    vi.mocked(prisma.usuario.findFirst).mockResolvedValue({ nome: 'Valdeir', escopoTipos: ['rede::Lentidão'] } as any)
    const res = await request(createApp())
      .put('/api/encaminhamentos')
      .send({ categoriaChave: 'sistemas', modo: 'TECNICO', tecnicoId: TEC_ID, ativa: true })
    expect(res.status).toBe(400)
    expect(res.body.message).toContain('liberada')
    expect(prisma.encaminhamentoRegra.upsert).not.toHaveBeenCalled()
  })

  it('categoria comum não exige liberação: técnico sem escopo segue válido', async () => {
    vi.mocked(prisma.usuario.findFirst).mockResolvedValue({ nome: 'Valdeir', escopoTipos: [] } as any)
    vi.mocked(prisma.encaminhamentoRegra.upsert).mockResolvedValue({ id: 'r1', categoriaChave: 'equipamento' } as any)
    const res = await request(createApp())
      .put('/api/encaminhamentos')
      .send({ categoriaChave: 'equipamento', modo: 'TECNICO', tecnicoId: TEC_ID, ativa: true })
    expect(res.status).toBe(200)
  })
})
