/**
 * Anexos das perguntas do formulário na abertura do chamado.
 *
 * Fica num arquivo próprio porque o que está em jogo aqui é o contrato com o
 * portal público: o que ele manda em `anexosPergunta[]` precisa chegar ao
 * `ChamadoAnexo` (com o rótulo da pergunta, para o técnico saber de onde veio
 * o arquivo) e voltar na consulta pública — e uma falha de upload NÃO pode
 * derrubar a abertura do chamado, que é o que a escola está tentando fazer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { consultarChamadoPublic, criarChamadoPublic } from './chamados'
import { errorHandler } from '../middleware/errorHandler'
import { pino } from 'pino'
import { prisma } from '../config/prisma'
import { salvarAnexo } from '../services/anexos'

vi.mock('../config/prisma', () => ({
  prisma: {
    chamado: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn()
    },
    chamadoAnexo: {
      createMany: vi.fn()
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

// O upload é efeito colateral no Supabase: aqui ele só devolve uma URL.
vi.mock('../services/anexos', () => ({
  salvarAnexo: vi.fn(),
  salvarAnexoComPath: vi.fn()
}))

vi.mock('../services/notificacoes', () => ({
  notificarAdmins: vi.fn(() => Promise.resolve()),
  notificarUnidade: vi.fn(() => Promise.resolve()),
  notificarUsuario: vi.fn(() => Promise.resolve()),
  notificarTecnicoResponsavel: vi.fn(() => Promise.resolve())
}))

vi.mock('../services/email', () => ({
  notificarChamadoStatusAlterado: vi.fn(() => Promise.resolve()),
  notificarChamadoCriado: vi.fn(() => Promise.resolve()),
  notificarChamadoConcluido: vi.fn(() => Promise.resolve())
}))

vi.mock('../services/encaminhamento', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/encaminhamento')>()),
  encaminharPorRegras: vi.fn(() => Promise.resolve(false)),
  encaminharChamado: vi.fn(),
  tecnicosDaUnidade: vi.fn(() => Promise.resolve([])),
  destinoWhere: {}
}))

const PROTOCOLO = 'CH-20261009-0001'
const EMAIL = 'maria.silva@educacao.sp.gov.br'

/** Corpo mínimo que o `CriarChamadoSchema` aceita. */
function corpoChamado(over: Record<string, any> = {}) {
  return {
    unidade: 'E.E. TESTE',
    solicitante: 'Maria Silva',
    tipo: 'Rede - Lentidão',
    descricao: 'A sala 3 está sem rede',
    urgencia: 'Media - Normal',
    email: EMAIL,
    ...over
  }
}

function chamadoCriado(over: Record<string, any> = {}) {
  return {
    id: 'clh3k4j5k0000abcd1234efgh',
    protocolo: PROTOCOLO,
    unidade: 'E.E. TESTE',
    solicitante: 'Maria Silva',
    funcao: null,
    tipo: 'Rede - Lentidão',
    descricao: 'A sala 3 está sem rede',
    urgencia: 'Media - Normal',
    anexoUrl: null,
    status: 'ABERTO',
    responsavel: null,
    historico: 'Chamado criado em 09/10/2026 08:00',
    tecnicoSetor: null,
    mensagens: [],
    atividades: [],
    anexos: [],
    ...over
  }
}

const createApp = () => {
  const app = express()
  app.use(express.json())
  // criação e consulta são rotas públicas, montadas antes do router autenticado
  app.post('/api/chamados', criarChamadoPublic)
  app.get('/api/chamados/protocolo/:protocolo', consultarChamadoPublic)
  app.use(errorHandler(pino({ level: 'silent' })))
  return app
}

describe('Anexos das perguntas na abertura do chamado', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
    vi.clearAllMocks()
    vi.mocked(prisma.chamado.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.chamado.create).mockResolvedValue(chamadoCriado() as any)
    vi.mocked(prisma.chamadoAnexo.createMany).mockResolvedValue({ count: 1 } as any)
    vi.mocked(salvarAnexo).mockResolvedValue('https://storage/abertura/foto.jpg')
  })

  describe('POST / (público)', () => {
    it('grava um ChamadoAnexo por arquivo, com o rótulo da pergunta', async () => {
      const res = await request(app)
        .post('/api/chamados')
        .send(corpoChamado({
          anexosPergunta: [
            {
              perguntaId: 'perg-arquivo-1',
              pergunta: 'Print do erro do PortalNet',
              nome: 'erro.png',
              tipo: 'image/png',
              base64: 'aGVsbG8='
            }
          ]
        }))

      expect(res.status).toBe(201)
      expect(salvarAnexo).toHaveBeenCalledWith('aGVsbG8=', 'erro.png', 'image/png', `abertura/${PROTOCOLO}`)
      expect(prisma.chamadoAnexo.createMany).toHaveBeenCalledWith({
        data: [
          {
            perguntaId: 'perg-arquivo-1',
            pergunta: 'Print do erro do PortalNet',
            nome: 'erro.png',
            tipo: 'image/png',
            url: 'https://storage/abertura/foto.jpg',
            chamadoId: 'clh3k4j5k0000abcd1234efgh'
          }
        ]
      })
    })

    it('aceita vários anexos, um por pergunta', async () => {
      const res = await request(app)
        .post('/api/chamados')
        .send(corpoChamado({
          anexosPergunta: [
            { perguntaId: 'perg-1', pergunta: 'Print do erro', nome: 'a.png', base64: 'YQ==' },
            { perguntaId: 'perg-2', pergunta: 'Foto da sala', nome: 'b.jpg', tipo: 'image/jpeg', base64: 'Yg==' }
          ]
        }))

      expect(res.status).toBe(201)
      const data = vi.mocked(prisma.chamadoAnexo.createMany).mock.calls[0]?.[0] as any
      expect(data.data).toHaveLength(2)
      expect(data.data.map((a: any) => a.perguntaId)).toEqual(['perg-1', 'perg-2'])
      // pasta do Storage é por protocolo: os arquivos do chamado ficam juntos
      expect(salvarAnexo).toHaveBeenCalledWith('YQ==', 'a.png', '', `abertura/${PROTOCOLO}`)
      expect(salvarAnexo).toHaveBeenCalledWith('Yg==', 'b.jpg', 'image/jpeg', `abertura/${PROTOCOLO}`)
    })

    it('recusa mais de 20 anexos', async () => {
      const res = await request(app)
        .post('/api/chamados')
        .send(corpoChamado({
          anexosPergunta: Array.from({ length: 21 }, (_, i) => ({
            perguntaId: `perg-${i}`,
            nome: `arquivo-${i}.png`,
            base64: 'YQ=='
          }))
        }))

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
      expect(prisma.chamado.create).not.toHaveBeenCalled()
    })

    it('recusa anexo sem perguntaId (o arquivo tem de saber de onde veio)', async () => {
      const res = await request(app)
        .post('/api/chamados')
        .send(corpoChamado({ anexosPergunta: [{ nome: 'orfao.png', base64: 'YQ==' }] }))

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
      expect(prisma.chamadoAnexo.createMany).not.toHaveBeenCalled()
    })

    it('sem anexosPergunta não cria registro nenhum', async () => {
      const res = await request(app).post('/api/chamados').send(corpoChamado())

      expect(res.status).toBe(201)
      expect(prisma.chamadoAnexo.createMany).not.toHaveBeenCalled()
    })

    it('upload que falha é pulado: o chamado abre mesmo assim', async () => {
      vi.mocked(salvarAnexo).mockResolvedValue(null)

      const res = await request(app)
        .post('/api/chamados')
        .send(corpoChamado({
          anexosPergunta: [{ perguntaId: 'perg-1', pergunta: 'Print do erro', nome: 'erro.png', base64: 'aGVsbG8=' }]
        }))

      expect(res.status).toBe(201)
      // Nada sobrou para gravar — e nenhuma URL quebrada foi para o banco.
      expect(prisma.chamadoAnexo.createMany).not.toHaveBeenCalled()
    })

    it('anexo geral da identificação continua indo para anexoUrl', async () => {
      const res = await request(app)
        .post('/api/chamados')
        .send(corpoChamado({
          anexoBase64: 'aWRlbnRpZmljYWNhbw==',
          anexoNome: 'documento.pdf',
          anexoTipo: 'application/pdf'
        }))

      expect(res.status).toBe(201)
      expect(salvarAnexo).toHaveBeenCalledWith('aWRlbnRpZmljYWNhbw==', 'documento.pdf', 'application/pdf', PROTOCOLO)
      expect(vi.mocked(prisma.chamado.create).mock.calls[0]?.[0] as any).toMatchObject({
        data: expect.objectContaining({ anexoUrl: 'https://storage/abertura/foto.jpg' })
      })
    })
  })

  describe('GET /protocolo/:protocolo (público)', () => {
    it('devolve os anexos das perguntas junto do chamado', async () => {
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue(chamadoCriado({
        status: 'RESOLVIDO',
        email: EMAIL,
        anexoUrl: 'https://storage/documento.pdf',
        atividades: [],
        anexos: [
          {
            id: 'anexo-1',
            perguntaId: 'perg-arquivo-1',
            pergunta: 'Print do erro do PortalNet',
            nome: 'erro.png',
            tipo: 'image/png',
            url: 'https://storage/abertura/erro.png'
          }
        ]
      }) as any)

      const res = await request(app)
        .get(`/api/chamados/protocolo/${PROTOCOLO}`)
        .query({ email: EMAIL })

      expect(res.status).toBe(200)
      expect(res.body.anexos).toHaveLength(1)
      expect(res.body.anexos[0]).toMatchObject({
        perguntaId: 'perg-arquivo-1',
        pergunta: 'Print do erro do PortalNet',
        nome: 'erro.png',
        url: 'https://storage/abertura/erro.png'
      })
      // O anexo geral da identificação continua no campo de sempre.
      expect(res.body.anexoUrl).toBe('https://storage/documento.pdf')
    })

    it('chamado sem anexo de pergunta devolve lista vazia', async () => {
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue(chamadoCriado({ email: EMAIL, atividades: [], anexos: [] }) as any)

      const res = await request(app)
        .get(`/api/chamados/protocolo/${PROTOCOLO}`)
        .query({ email: EMAIL })

      expect(res.status).toBe(200)
      expect(res.body.anexos).toEqual([])
    })
  })
})
