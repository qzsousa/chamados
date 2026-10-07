/**
 * Fluxo de atendimento: aceitar → registrar → concluir → conferir.
 *
 * Fica num arquivo separado do `chamados.test.ts` porque o que importa aqui não
 * é o CRUD do chamado e sim as travas entre as etapas: quem pode fazer o quê,
 * o que cada passo grava e quem é notificado. É justamente aí que o chamado
 * antigopermitia a escola fechar um serviço que o técnico não tinha feito.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import chamadoRoutes from './chamados'
import { errorHandler } from '../middleware/errorHandler'
import { pino } from 'pino'
import { prisma } from '../config/prisma'
import { notificarAdmins, notificarUnidade, notificarTecnicoResponsavel } from '../services/notificacoes'

vi.mock('../config/prisma', () => ({
  prisma: {
    chamado: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    chamadoAtividade: {
      create: vi.fn()
    }
  }
}))

vi.mock('../services/normalization', () => ({
  normalizarNomeEscola: vi.fn((nome: string) => nome.toUpperCase().replace(/[^A-Z0-9]/g, '')),
  getMapaTecnicos: vi.fn(() => ({}))
}))

vi.mock('../services/migration', () => ({
  getMapaInventario: vi.fn(() => Promise.resolve({}))
}))

vi.mock('../services/anexos', () => ({
  salvarAnexo: vi.fn(),
  salvarAnexoComPath: vi.fn((_b64: string, nome: string) =>
    Promise.resolve({ url: `https://storage/${nome}`, path: `pasta/${nome}` })
  )
}))

vi.mock('../services/email', () => ({
  notificarChamadoStatusAlterado: vi.fn(() => Promise.resolve()),
  notificarChamadoCriado: vi.fn(() => Promise.resolve()),
  notificarChamadoConcluido: vi.fn(() => Promise.resolve())
}))

vi.mock('../services/notificacoes', () => ({
  notificarAdmins: vi.fn(() => Promise.resolve()),
  notificarUnidade: vi.fn(() => Promise.resolve()),
  notificarUsuario: vi.fn(() => Promise.resolve()),
  notificarTecnicoResponsavel: vi.fn(() => Promise.resolve())
}))

vi.mock('../services/encaminhamento', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/encaminhamento')>()),
  encaminharPorRegras: vi.fn(() => Promise.resolve(false)),
  encaminharChamado: vi.fn(),
  tecnicosDaUnidade: vi.fn(() => Promise.resolve([])),
  destinoWhere: {}
}))

/** O técnico em atendimento, o gestor da unidade e o admin da matriz. */
const TECNICO = { id: 'tec-1', email: 'tec@test.com', nome: 'João Técnico', nivel: 'TECNICO', filial: 'E.E. TESTE', status: 'ATIVO', primeiroLogin: false }
const GESTOR = { id: 'ges-1', email: 'ges@test.com', nome: 'Maria Gestora', nivel: 'GESTOR', filial: 'E.E. TESTE', status: 'ATIVO', primeiroLogin: false }

let usuario: typeof TECNICO

vi.mock('../middleware/auth', () => {
  const authMiddleware = (req: any, _res: any, next: any) => {
    req.user = { sub: usuario.id, email: usuario.email, nome: usuario.nome, nivel: usuario.nivel, filial: usuario.filial, type: 'access', iat: Date.now(), exp: Date.now() + 900000 }
    req.userRecord = { ...usuario }
    next()
  }
  const requireRole = (...roles: string[]) => (_req: any, _res: any, next: any) => {
    if (!roles.includes(usuario.nivel)) {
      return _res.status(403).json({ error: 'FORBIDDEN', message: 'Sem permissão' })
    }
    next()
  }
  const attachUserRecord = (req: any, _res: any, next: any) => {
    req.userRecord = { ...usuario }
    next()
  }
  return { authMiddleware, requireRole, attachUserRecord }
})

const CUID = 'clh3k4j5k0000abcd1234efgh'
const PROTOCOLO = 'CH-20261007-0001'

/** Chamado no estado pedido, com os campos novos do fluxo já zerados. */
function chamadoBase(over: Record<string, any> = {}) {
  return {
    id: CUID,
    protocolo: PROTOCOLO,
    unidade: 'E.E. TESTE',
    solicitante: 'Maria Silva',
    tipo: 'Equipamento - Sem sinal',
    descricao: 'Roteador sem sinal',
    urgencia: 'Alta - Urgente',
    status: 'ABERTO',
    responsavel: null,
    responsavelId: null,
    historico: 'Chamado criado em 07/10/2026 08:00',
    tecnicoResolucao: null,
    descricaoResolucao: null,
    reaberturas: 0,
    aceitoEm: null,
    concluidoEm: null,
    conferidoEm: null,
    conferidoPor: null,
    excluido: false,
    ...over
  }
}

/** Resposta do `findUnique` final (a rota devolve o chamado já com atividades). */
function chamadoSalvo(over: Record<string, any> = {}) {
  return { ...chamadoBase(), mensagens: [], atividades: [], ...over }
}

const createApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/api/chamados', chamadoRoutes)
  app.use(errorHandler(pino({ level: 'silent' })))
  return app
}

describe('Fluxo de atendimento do chamado', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
    vi.clearAllMocks()
    usuario = { ...TECNICO }
    vi.mocked(prisma.chamado.update).mockImplementation(async ({ data }: any) =>
      chamadoSalvo({ ...data, reaberturas: data.reaberturas?.increment ?? 0 })
    )
  })

  /* ---------------------------------------------------------------- aceite */

  describe('POST /:id/aceitar', () => {
    it('tira o chamado da fila e carimba o horário do aceite', async () => {
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue(
        chamadoBase({ status: 'ENCAMINHADO', responsavel: TECNICO.nome, responsavelId: TECNICO.id }) as any
      )

      const res = await request(app).post(`/api/chamados/${CUID}/aceitar`)

      expect(res.status).toBe(200)
      const dados = vi.mocked(prisma.chamado.update).mock.calls[0][0].data
      expect(dados.status).toBe('ANDAMENTO')
      expect(dados.aceitoPor).toBe(TECNICO.nome)
      expect(dados.aceitoEm).toBeInstanceOf(Date)
      expect(dados.historico).toContain('Chamado aceito por João Técnico')
    })

    it('técnico que não é o responsável NEM atende a unidade não aceita', async () => {
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue(
        chamadoBase({ status: 'ENCAMINHADO', responsavel: 'Outro Técnico', responsavelId: 'tec-99', unidade: 'E.E. OUTRA' }) as any
      )

      const res = await request(app).post(`/api/chamados/${CUID}/aceitar`)

      expect(res.status).toBe(403)
      expect(prisma.chamado.update).not.toHaveBeenCalled()
    })

    it('técnico da escola pode aceitar mesmo não sendo o responsável gravado (plantão)', async () => {
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue(
        chamadoBase({ status: 'ENCAMINHADO', responsavel: 'Outro Técnico', responsavelId: 'tec-99', unidade: TECNICO.filial }) as any
      )

      const res = await request(app).post(`/api/chamados/${CUID}/aceitar`)

      expect(res.status).toBe(200)
    })

    it('aceitar duas vezes no mesmo ciclo é idempotente (200 sem regravar)', async () => {
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue(
        chamadoBase({ status: 'ANDAMENTO', responsavel: TECNICO.nome, responsavelId: TECNICO.id, aceitoEm: new Date('2026-10-06T10:00:00Z'), aceitoPor: TECNICO.nome }) as any
      )

      const res = await request(app).post(`/api/chamados/${CUID}/aceitar`)

      expect(res.status).toBe(200)
      expect(prisma.chamado.update).not.toHaveBeenCalled()
    })

    it('deixa o ADMIN aceitar por um técnico que está fora', async () => {
      usuario = { ...TECNICO, nivel: 'ADMIN', nome: 'Chefe' }
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue(
        chamadoBase({ status: 'ENCAMINHADO', responsavel: 'Outro', responsavelId: 'tec-99' }) as any
      )

      const res = await request(app).post(`/api/chamados/${CUID}/aceitar`)

      expect(res.status).toBe(200)
    })
  })

  /* ------------------------------------------------------------- atividades */

  describe('POST /:id/atividades', () => {
    beforeEach(() => {
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue(
        chamadoBase({ status: 'ANDAMENTO', responsavel: TECNICO.nome, responsavelId: TECNICO.id }) as any
      )
    })

    it('registra o que foi feito com data/hora do servidor', async () => {
      vi.mocked(prisma.chamadoAtividade.create).mockResolvedValue({
        id: 'at-1', tipo: 'REGISTRO', autorNome: TECNICO.nome, texto: 'Testei a porta 3'
      } as any)

      const res = await request(app)
        .post(`/api/chamados/${CUID}/atividades`)
        .send({ texto: 'Testei a porta 3' })

      expect(res.status).toBe(201)
      const dados = vi.mocked(prisma.chamadoAtividade.create).mock.calls[0][0].data
      expect(dados.tipo).toBe('REGISTRO')
      expect(dados.autorNome).toBe(TECNICO.nome)
      expect(dados.texto).toBe('Testei a porta 3')
      // Nenhum `criadoEm` manual: o default do banco é o relógio do servidor.
      expect(dados.criadoEm).toBeUndefined()
    })

    it('aceita repetir o registro várias vezes', async () => {
      vi.mocked(prisma.chamadoAtividade.create).mockResolvedValue({ id: 'at-1' } as any)

      await request(app).post(`/api/chamados/${CUID}/atividades`).send({ texto: 'Primeiro passo' })
      await request(app).post(`/api/chamados/${CUID}/atividades`).send({ texto: 'Segundo passo' })
      await request(app).post(`/api/chamados/${CUID}/atividades`).send({ texto: 'Terceiro passo' })

      expect(prisma.chamadoAtividade.create).toHaveBeenCalledTimes(3)
      expect(vi.mocked(prisma.chamadoAtividade.create).mock.calls.map((c) => c[0].data.texto)).toEqual([
        'Primeiro passo',
        'Segundo passo',
        'Terceiro passo'
      ])
    })

    it('exige texto', async () => {
      const res = await request(app).post(`/api/chamados/${CUID}/atividades`).send({ texto: '   ' })
      expect(res.status).toBe(400)
      expect(prisma.chamadoAtividade.create).not.toHaveBeenCalled()
    })

    it('não deixa registrar antes do aceite', async () => {
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue(
        chamadoBase({ status: 'ENCAMINHADO', responsavel: TECNICO.nome, responsavelId: TECNICO.id }) as any
      )

      const res = await request(app).post(`/api/chamados/${CUID}/atividades`).send({ texto: 'Fiz algo' })

      expect(res.status).toBe(409)
      expect(prisma.chamadoAtividade.create).not.toHaveBeenCalled()
    })

    it('não deixa registrar depois de reaberto sem aceitar de novo', async () => {
      // `aceitoEm` continua gravado do ciclo anterior — o status é que manda.
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue(
        chamadoBase({
          status: 'ABERTO',
          responsavel: TECNICO.nome,
          responsavelId: TECNICO.id,
          aceitoEm: new Date('2026-10-06T10:00:00Z'),
          reaberturas: 1
        }) as any
      )

      const res = await request(app).post(`/api/chamados/${CUID}/atividades`).send({ texto: 'Fiz algo' })

      expect(res.status).toBe(409)
    })

    it('avisa os administradores no sino', async () => {
      vi.mocked(prisma.chamadoAtividade.create).mockResolvedValue({ id: 'at-1' } as any)

      await request(app).post(`/api/chamados/${CUID}/atividades`).send({ texto: 'Testei a porta 3' })

      expect(notificarAdmins).toHaveBeenCalledWith(
        'CHAMADO_ATIVIDADE',
        expect.stringContaining(PROTOCOLO),
        expect.stringContaining('Testei a porta 3'),
        `/chamados/${CUID}`
      )
    })
  })

  /* --------------------------------------------------------------- concluir */

  describe('POST /:id/concluir', () => {
    beforeEach(() => {
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue(
        chamadoBase({ status: 'ANDAMENTO', responsavel: TECNICO.nome, responsavelId: TECNICO.id }) as any
      )
      vi.mocked(prisma.chamadoAtividade.create).mockResolvedValue({ id: 'at-conc' } as any)
    })

    it('passa para a conferência da escola em vez de encerrar', async () => {
      const res = await request(app)
        .post(`/api/chamados/${CUID}/concluir`)
        .send({ descricaoResolucao: 'Roteador trocado e testado' })

      expect(res.status).toBe(200)
      const dados = vi.mocked(prisma.chamado.update).mock.calls[0][0].data
      expect(dados.status).toBe('AGUARDANDO_CONFERENCIA')
      expect(dados.concluidoEm).toBeInstanceOf(Date)
      expect(dados.descricaoResolucao).toBe('Roteador trocado e testado')
      expect(dados.tecnicoResolucao).toBe(TECNICO.nome)
    })

    it('exige descrever o que foi feito', async () => {
      const res = await request(app).post(`/api/chamados/${CUID}/concluir`).send({ descricaoResolucao: '' })

      expect(res.status).toBe(400)
      expect(prisma.chamado.update).not.toHaveBeenCalled()
    })

    it('guarda a conclusão também como registro datado', async () => {
      await request(app)
        .post(`/api/chamados/${CUID}/concluir`)
        .send({ descricaoResolucao: 'Roteador trocado' })

      expect(vi.mocked(prisma.chamadoAtividade.create).mock.calls[0][0].data.tipo).toBe('CONCLUSAO')
    })

    it('avisa a escola que há o que conferir', async () => {
      await request(app)
        .post(`/api/chamados/${CUID}/concluir`)
        .send({ descricaoResolucao: 'Roteador trocado' })

      expect(notificarUnidade).toHaveBeenCalledWith(
        'E.E. TESTE',
        'CHAMADO_FINALIZADO',
        expect.stringContaining(PROTOCOLO),
        'Roteador trocado',
        `/chamados/${CUID}`
      )
    })
  })

  /* --------------------------------------------------------------- conferir */

  describe('POST /:id/conferir', () => {
    beforeEach(() => {
      usuario = { ...GESTOR }
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue(
        chamadoBase({
          status: 'AGUARDANDO_CONFERENCIA',
          responsavel: TECNICO.nome,
          responsavelId: TECNICO.id,
          concluidoEm: new Date('2026-10-07T12:00:00Z')
        }) as any
      )
    })

    it('aprovação encerra o chamado com nome e horário de quem deu o ok', async () => {
      const res = await request(app)
        .post(`/api/chamados/${CUID}/conferir`)
        .send({ aprovado: true, texto: 'Funcionou direitinho, obrigado' })

      expect(res.status).toBe(200)
      const dados = vi.mocked(prisma.chamado.update).mock.calls[0][0].data
      expect(dados.status).toBe('RESOLVIDO')
      expect(dados.conferidoEm).toBeInstanceOf(Date)
      expect(dados.conferidoPor).toBe('Maria Gestora')
    })

    it('aprovação avisa o técnico responsável', async () => {
      await request(app).post(`/api/chamados/${CUID}/conferir`).send({ aprovado: true })

      expect(notificarTecnicoResponsavel).toHaveBeenCalledWith(
        expect.objectContaining({ responsavelId: TECNICO.id }),
        'CHAMADO_APROVADO',
        expect.stringContaining(PROTOCOLO),
        expect.any(String),
        `/chamados/${CUID}`
      )
    })

    it('contestação reabre o chamado, conta a reabertura e guarda o motivo', async () => {
      const res = await request(app)
        .post(`/api/chamados/${CUID}/conferir`)
        .send({ aprovado: false, texto: 'O sinal continua caindo na sala 3' })

      expect(res.status).toBe(200)
      const dados = vi.mocked(prisma.chamado.update).mock.calls[0][0].data
      expect(dados.status).toBe('ABERTO')
      expect(dados.reaberturas).toEqual({ increment: 1 })
      expect(dados.historico).toContain('O que ficou faltando: O sinal continua caindo na sala 3')
      // Preservar tudo: o aceite e a conclusão anteriores continuam gravados.
      expect(dados.aceitoEm).toBeUndefined()
      expect(dados.descricaoResolucao).toBeUndefined()
    })

    it('contestação registra o que faltou como atividade datada', async () => {
      vi.mocked(prisma.chamadoAtividade.create).mockResolvedValue({ id: 'at-cont' } as any)

      await request(app)
        .post(`/api/chamados/${CUID}/conferir`)
        .send({ aprovado: false, texto: 'Faltou a fonte do roteador' })

      const dados = vi.mocked(prisma.chamadoAtividade.create).mock.calls[0][0].data
      expect(dados.tipo).toBe('CONTESTACAO')
      expect(dados.autorNivel).toBe('GESTOR')
      expect(dados.texto).toBe('Faltou a fonte do roteador')
    })

    it('contestação notifica o administrador E o técnico, como pedido', async () => {
      await request(app)
        .post(`/api/chamados/${CUID}/conferir`)
        .send({ aprovado: false, texto: 'Ainda não funciona' })

      expect(notificarAdmins).toHaveBeenCalledWith(
        'CHAMADO_REABERTO',
        expect.stringContaining(PROTOCOLO),
        expect.stringContaining('Ainda não funciona'),
        `/chamados/${CUID}`
      )
      expect(notificarTecnicoResponsavel).toHaveBeenCalledWith(
        expect.objectContaining({ responsavelId: TECNICO.id }),
        'CHAMADO_REABERTO',
        expect.stringContaining('reaberto'),
        expect.stringContaining('Ainda não funciona'),
        `/chamados/${CUID}`
      )
    })

    it('contestação exige dizer o que faltou', async () => {
      const res = await request(app).post(`/api/chamados/${CUID}/conferir`).send({ aprovado: false })

      expect(res.status).toBe(400)
      expect(prisma.chamado.update).not.toHaveBeenCalled()
    })

    it('não deixa a escola confirmar chamado que o técnico não concluiu', async () => {
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue(chamadoBase({ status: 'ANDAMENTO' }) as any)

      const res = await request(app).post(`/api/chamados/${CUID}/conferir`).send({ aprovado: true })

      expect(res.status).toBe(409)
    })

    it('não deixa a escola de outra unidade tocar no chamado', async () => {
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue(
        chamadoBase({ status: 'AGUARDANDO_CONFERENCIA', unidade: 'E.E. OUTRA' }) as any
      )

      const res = await request(app).post(`/api/chamados/${CUID}/conferir`).send({ aprovado: true })

      expect(res.status).toBe(403)
    })

    it('o técnico não faz a conferência no lugar da escola', async () => {
      usuario = { ...TECNICO }
      const res = await request(app).post(`/api/chamados/${CUID}/conferir`).send({ aprovado: true })

      expect(res.status).toBe(403)
    })
  })
})
