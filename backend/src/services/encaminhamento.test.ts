import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '../config/prisma'
import { notificarUsuario } from './notificacoes'
import {
  casaComRegra,
  encaminharChamado,
  encaminharPendentes,
  encaminharPorRegras,
  tecnicosDaUnidade,
} from './encaminhamento'

vi.mock('../config/prisma', () => ({
  prisma: {
    usuario: { findMany: vi.fn(), findFirst: vi.fn() },
    chamado: { update: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
    encaminhamentoRegra: { findMany: vi.fn() },
    formularioCategoria: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}))

vi.mock('./notificacoes', () => ({ notificarUsuario: vi.fn() }))

const CHAMADO = {
  id: 'chamado-1',
  protocolo: 'CH-20260925-0001',
  unidade: 'E.E. BELIZE',
  tipo: 'Equipamento - Manutenção — Problemas físicos',
  urgencia: 'Média',
  responsavel: null,
  status: 'ABERTO',
  categoriaChave: 'equipamento',
  historico: 'Chamado criado em 25/09/2026 10:00:00',
}

const TECNICO = {
  id: 'tec-1',
  nome: 'Carlos Souza',
  email: 'carlos@educacao.sp.gov.br',
  filial: 'E.E. BELIZE',
  createdAt: new Date('2026-01-01'),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.chamado.update).mockImplementation(async ({ data }: any) => ({ ...CHAMADO, ...data }))
  vi.mocked(prisma.chamado.groupBy).mockResolvedValue([] as any)
  vi.mocked(prisma.encaminhamentoRegra.findMany).mockResolvedValue([] as any)
  vi.mocked(prisma.formularioCategoria.findUnique).mockResolvedValue({ nome: 'Equipamento' } as any)
  vi.mocked(notificarUsuario).mockResolvedValue(undefined as any)
})

describe('casaComRegra', () => {
  it('casa pela categoriaChave gravada na criação', () => {
    expect(casaComRegra(CHAMADO as any, { categoriaChave: 'equipamento', modo: 'UNIDADE', tecnicoId: null })).toBe(true)
    expect(casaComRegra(CHAMADO as any, { categoriaChave: 'rede', modo: 'UNIDADE', tecnicoId: null })).toBe(false)
  })

  it('chamado antigo (sem chave) casa pelo nome da categoria no tipo', () => {
    const antigo = { ...CHAMADO, categoriaChave: null }
    expect(casaComRegra(antigo as any, { categoriaChave: 'equipamento', modo: 'UNIDADE', tecnicoId: null }, 'Equipamento')).toBe(true)
    expect(casaComRegra(antigo as any, { categoriaChave: 'rede', modo: 'UNIDADE', tecnicoId: null }, 'Rede')).toBe(false)
  })
})

describe('tecnicosDaUnidade', () => {
  it('acha o técnico cuja lista de unidades inclui a escola', async () => {
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([
      { ...TECNICO, filial: 'E.E. BELIZE, E.E. JARDIM IGUATEMI' },
    ] as any)
    const lista = await tecnicosDaUnidade('E.E. JARDIM IGUATEMI')
    expect(lista).toHaveLength(1)
    expect(lista[0].nome).toBe('Carlos Souza')
  })

  it('ignora técnico de outra unidade e inativo é filtrado pelo where', async () => {
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([
      { ...TECNICO, id: 'tec-2', nome: 'Outro Técnico', filial: 'E.E. VILA BELA' },
    ] as any)
    expect(await tecnicosDaUnidade('E.E. BELIZE')).toEqual([])
  })

  it('desempata: casa exata ganha da casa por irmã', async () => {
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([
      { ...TECNICO, id: 'tec-irma', nome: 'Irmã', filial: 'E.E. BELIZE / E.E. BENJAMIN SAMUEL BLOOM' },
      { ...TECNICO, id: 'tec-exata', nome: 'Exata', filial: 'E.E. BELIZE' },
    ] as any)
    const lista = await tecnicosDaUnidade('E.E. BELIZE')
    expect(lista[0].nome).toBe('Exata')
  })

  it('desempata: menos chamados abertos primeiro', async () => {
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([
      { ...TECNICO, id: 'a', nome: 'A', filial: 'E.E. BELIZE' },
      { ...TECNICO, id: 'b', nome: 'B', filial: 'E.E. BELIZE' },
    ] as any)
    vi.mocked(prisma.chamado.groupBy).mockResolvedValue([
      { responsavel: 'A', _count: { _all: 5 } },
      { responsavel: 'B', _count: { _all: 1 } },
    ] as any)
    const lista = await tecnicosDaUnidade('E.E. BELIZE')
    expect(lista[0].nome).toBe('B')
  })
})

/**
 * ESCOPO DE TIPOS — a conta de quem atende só alguns tipos de chamado, de
 * qualquer escola. Sem nenhum usuário com escopo cadastrado, tudo acima
 * continua valendo igual.
 */
describe('tecnicosDaUnidade — escopo de tipos', () => {
  const SISTEMAS = {
    id: 'ch-sist',
    protocolo: 'CH-20260925-0002',
    unidade: 'E.E. VILA BELA', // escola que o técnico de sistemas não atende
    tipo: 'Sistemas - PortalNet',
    urgencia: 'Média',
    responsavel: null,
    status: 'ABERTO',
    categoriaChave: 'sistemas',
    historico: null,
  }

  /** Técnico de sistemas: escopo em vez de unidade. */
  const DE_SISTEMAS = {
    id: 'tec-sist',
    nome: 'Da Sistemas',
    email: 'sistemas@educacao.sp.gov.br',
    filial: 'E.E. URE LESTE 3',
    createdAt: new Date('2026-01-01'),
    escopoTipos: ['sistemas::PortalNet', 'sistemas::SEI'],
  }

  beforeEach(() => {
    vi.mocked(prisma.formularioCategoria.findMany).mockImplementation(async (args: any) => {
      const chaves = args?.where?.chave?.in as string[] | undefined
      const todas = [
        { chave: 'sistemas', nome: 'Sistemas' },
        { chave: 'equipamento', nome: 'Equipamento' },
      ]
      return (chaves ? todas.filter((c) => chaves.includes(c.chave)) : todas) as any
    })
  })

  it('entra na fila pelo tipo, mesmo sem atender a escola', async () => {
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([DE_SISTEMAS] as any)

    const lista = await tecnicosDaUnidade('E.E. VILA BELA', SISTEMAS as any)

    expect(lista.map((t) => t.nome)).toEqual(['Da Sistemas'])
  })

  it('NÃO entra na fila quando o chamado é de outro tipo', async () => {
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([DE_SISTEMAS] as any)

    const lista = await tecnicosDaUnidade('E.E. VILA BELA', { ...SISTEMAS, tipo: 'Equipamento - Formatação', categoriaChave: 'equipamento' } as any)

    expect(lista).toEqual([])
  })

  /**
   * A prioridade do especialista é o motivo de a conta existir: se o técnico da
   * unidade ganhasse, o chamado de sistemas nunca chegaria em quem só faz
   * sistemas.
   */
  it('tem prioridade sobre o técnico da unidade', async () => {
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([
      { ...TECNICO, id: 'tec-unidade', nome: 'Da Unidade', filial: 'E.E. VILA BELA' },
      DE_SISTEMAS,
    ] as any)

    const lista = await tecnicosDaUnidade('E.E. VILA BELA', SISTEMAS as any)

    expect(lista[0].nome).toBe('Da Sistemas')
  })

  it('técnico da unidade ainda leva o chamado de tipo fora do escopo dele', async () => {
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([
      { ...TECNICO, id: 'tec-unidade', nome: 'Da Unidade', filial: 'E.E. VILA BELA' },
      DE_SISTEMAS,
    ] as any)

    const lista = await tecnicosDaUnidade('E.E. VILA BELA', { ...SISTEMAS, tipo: 'Equipamento - Formatação', categoriaChave: 'equipamento' } as any)

    expect(lista.map((t) => t.nome)).toEqual(['Da Unidade'])
  })

  it('sem o chamado (chamada sem contexto) o técnico de escopo não entra', async () => {
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([DE_SISTEMAS] as any)

    // Não dá para decidir o tipo: melhor não escolher ninguém restrito do que
    // escolher a pessoa errada.
    expect(await tecnicosDaUnidade('E.E. VILA BELA')).toEqual([])
  })

  it('modo TECNICO: regra fixa aceita quando o tipo está no escopo', async () => {
    vi.mocked(prisma.usuario.findFirst).mockResolvedValue(DE_SISTEMAS as any)

    const r = await encaminharChamado(SISTEMAS as any, { modo: 'TECNICO', tecnicoId: 'tec-sist' })

    expect(r.ok).toBe(true)
    expect(r.tecnico?.nome).toBe('Da Sistemas')
  })

  it('modo TECNICO: regra fixa é recusada quando o tipo está fora do escopo', async () => {
    vi.mocked(prisma.usuario.findFirst).mockResolvedValue(DE_SISTEMAS as any)

    const r = await encaminharChamado(
      { ...SISTEMAS, tipo: 'Equipamento - Formatação', categoriaChave: 'equipamento' } as any,
      { modo: 'TECNICO', tecnicoId: 'tec-sist' },
    )

    expect(r.ok).toBe(false)
    // A mensagem precisa dizer que é o escopo, senão o ADMIN acha que o
    // técnico foi desativado e reconfigura a regra à toa.
    expect(r.motivo).toContain('tipo')
  })

  it('modo TECNICO: técnico sem escopo continua aceito sempre', async () => {
    vi.mocked(prisma.usuario.findFirst).mockResolvedValue({ ...TECNICO, escopoTipos: [] } as any)

    const r = await encaminharChamado(SISTEMAS as any, { modo: 'TECNICO', tecnicoId: 'tec-1' })

    expect(r.ok).toBe(true)
  })
})

describe('encaminharChamado', () => {
  beforeEach(() => {
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([TECNICO] as any)
  })

  it('grava responsável, histórico e notifica o técnico', async () => {
    const r = await encaminharChamado(CHAMADO as any, { modo: 'UNIDADE' })
    expect(r.ok).toBe(true)
    expect(r.tecnico?.nome).toBe('Carlos Souza')

    const update = vi.mocked(prisma.chamado.update).mock.calls[0][0] as any
    expect(update.data.responsavel).toBe('Carlos Souza')
    expect(update.data.historico).toContain('Encaminhado para Carlos Souza')
    expect(update.data.historico).toContain('técnico da unidade')
    expect(notificarUsuario).toHaveBeenCalledWith(
      'tec-1',
      'CHAMADO_NOVO',
      expect.stringContaining('CH-20260925-0001'),
      expect.any(String),
      '/chamados/chamado-1',
    )
  })

  it('manual: registra quem encaminhou e a observação', async () => {
    await encaminharChamado(CHAMADO as any, { modo: 'UNIDADE', origem: 'Manual', autor: 'Ana Admin', observacao: 'categoria errada' })
    const update = vi.mocked(prisma.chamado.update).mock.calls[0][0] as any
    expect(update.data.historico).toContain('manual por Ana Admin')
    expect(update.data.historico).toContain('Obs.: categoria errada')
  })

  it('grava o id do responsável — é ele que permite avisar o técnico na reabertura', async () => {
    await encaminharChamado(CHAMADO as any, { modo: 'UNIDADE' })
    const update = vi.mocked(prisma.chamado.update).mock.calls[0][0] as any
    expect(update.data.responsavelId).toBe('tec-1')
  })

  it('chamado ABERTO vira ENCAMINHADO (fila do técnico, aguardando aceite)', async () => {
    await encaminharChamado({ ...CHAMADO, status: 'ABERTO' } as any, { modo: 'UNIDADE' })
    const update = vi.mocked(prisma.chamado.update).mock.calls[0][0] as any
    expect(update.data.status).toBe('ENCAMINHADO')
  })

  it('reencaminhar chamado em atendimento NÃO volta o status (técnico pode estar no serviço)', async () => {
    await encaminharChamado({ ...CHAMADO, status: 'ANDAMENTO' } as any, { modo: 'UNIDADE', origem: 'Manual' })
    const update = vi.mocked(prisma.chamado.update).mock.calls[0][0] as any
    expect(update.data.status).toBe('ANDAMENTO')
  })

  it('modo TECNICO usa o técnico fixo da regra', async () => {
    vi.mocked(prisma.usuario.findFirst).mockResolvedValue({ ...TECNICO, id: 'tec-fixo', nome: 'Técnico Fixo' } as any)
    const r = await encaminharChamado(CHAMADO as any, { modo: 'TECNICO', tecnicoId: 'tec-fixo' })
    expect(r.tecnico?.nome).toBe('Técnico Fixo')
    const update = vi.mocked(prisma.chamado.update).mock.calls[0][0] as any
    expect(update.data.historico).toContain('técnico fixo')
  })

  it('sem técnico cadastrado: não quebra, avisa no histórico e não notifica', async () => {
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([] as any)
    const r = await encaminharChamado(CHAMADO as any, { modo: 'UNIDADE' })
    expect(r.ok).toBe(false)
    expect(r.motivo).toContain('técnico')
    const update = vi.mocked(prisma.chamado.update).mock.calls[0][0] as any
    expect(update.data.historico).toContain('Sem técnico para encaminhamento')
    expect(update.data.responsavel).toBeUndefined()
    expect(notificarUsuario).not.toHaveBeenCalled()
  })
})

describe('encaminharPorRegras', () => {
  it('encaminha chamado de equipamento quando a regra está ativa', async () => {
    vi.mocked(prisma.encaminhamentoRegra.findMany).mockResolvedValue([
      { categoriaChave: 'equipamento', modo: 'UNIDADE', tecnicoId: null, tecnicoNome: null },
    ] as any)
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([TECNICO] as any)
    const ok = await encaminharPorRegras(CHAMADO as any)
    expect(ok).toBe(true)
  })

  it('não encaminha chamado de outra categoria', async () => {
    vi.mocked(prisma.encaminhamentoRegra.findMany).mockResolvedValue([
      { categoriaChave: 'rede', modo: 'UNIDADE', tecnicoId: null, tecnicoNome: null },
    ] as any)
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([TECNICO] as any)
    expect(await encaminharPorRegras(CHAMADO as any)).toBe(false)
    expect(notificarUsuario).not.toHaveBeenCalled()
  })

  it('não mexe em chamado que já tem responsável', async () => {
    vi.mocked(prisma.encaminhamentoRegra.findMany).mockResolvedValue([
      { categoriaChave: 'equipamento', modo: 'UNIDADE', tecnicoId: null, tecnicoNome: null },
    ] as any)
    expect(await encaminharPorRegras({ ...CHAMADO, responsavel: 'Fulano' } as any)).toBe(false)
    expect(prisma.chamado.update).not.toHaveBeenCalled()
  })
})

describe('encaminharPendentes', () => {
  it('aplica a regra só nos abertos sem responsável e conta o resultado', async () => {
    vi.mocked(prisma.encaminhamentoRegra.findMany).mockResolvedValue([
      { categoriaChave: 'equipamento', modo: 'UNIDADE', tecnicoId: null, tecnicoNome: null },
    ] as any)
    vi.mocked(prisma.chamado.findMany).mockResolvedValue([CHAMADO] as any)
    vi.mocked(prisma.usuario.findMany).mockResolvedValue([TECNICO] as any)
    const r = await encaminharPendentes()
    expect(r).toEqual({ total: 1, encaminhados: 1, semTecnico: 0 })
  })

  it('sem regra ativa não faz nada', async () => {
    expect(await encaminharPendentes()).toEqual({ total: 0, encaminhados: 0, semTecnico: 0 })
    expect(prisma.chamado.findMany).not.toHaveBeenCalled()
  })
})
