/**
 * Travas de anexo do formulário público: extensão, MIME, tamanho e quantidade.
 *
 * O bucket `anexos` do Supabase é público e o `contentType` gravado vinha do
 * cliente cru — sem allowlist, um `.html`/`.svg` subia e era servido como
 * `text/html` (XSS servido do nosso domínio). E o caminho legado `anexoBase64`
 * era costurado DEPOIS de toda a validação, então 24MB passavam.
 *
 * Aqui não se testa o serviço de Storage (mockado, como no resto da suíte):
 * testa-se o portão — o que o cliente recebe de volta.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { pino } from 'pino'
import { errorHandler } from '../middleware/errorHandler'
import { prisma } from '../config/prisma'
import { criarChamadoPublic } from './chamados'
import { LIMITE_CORPO_JSON } from '@shared/api'
import { salvarAnexoComPath } from '../services/anexos'

vi.mock('../config/prisma', () => ({
  prisma: {
    chamado: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn()
    },
    formularioCategoria: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  }
}))

vi.mock('../services/normalization', () => ({
  normalizarNomeEscola: vi.fn((nome: string) => nome),
  getMapaTecnicos: vi.fn(() => ({ 'E.E. TESTE': 'TECNICO1' }))
}))

vi.mock('../services/migration', () => ({
  getMapaInventario: vi.fn(() => Promise.resolve({ 'E.E. TESTE': 'CONCLUIDO' }))
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
  encaminharPendentes: vi.fn()
}))

vi.mock('../services/anexos', () => ({
  salvarAnexo: vi.fn(async (_b64: string, nome: string) => `https://storage.test/${nome}`),
  salvarAnexoComPath: vi.fn(async (_b64: string, nome: string, _tipo: string, pasta: string) => ({
    url: `https://storage.test/${pasta}/${nome}`,
    path: `${pasta}/${nome}`
  })),
  limparAnexosTemporariosExpirados: vi.fn(() => Promise.resolve(0))
}))

vi.mock('../middleware/auth', () => {
  const authMiddleware = (req: any, _res: any, next: any) => { req.userRecord = { id: 'u1', nivel: 'ADMIN' }; next() }
  const requireRole = () => (_req: any, _res: any, next: any) => next()
  const attachUserRecord = (req: any, _res: any, next: any) => { req.userRecord = { id: 'u1', nivel: 'ADMIN' }; next() }
  const requireFilialAccess = () => (_req: any, _res: any, next: any) => next()
  return { authMiddleware, requireRole, attachUserRecord, requireFilialAccess }
})

const createApp = () => {
  const app = express()
  // Limite importado do contrato (@shared/api), o mesmo que o index.ts usa:
  // replicar '25mb' à mão aqui é o que faz o teste mentir.
  app.use(express.json({ limit: LIMITE_CORPO_JSON }))
  app.post('/api/chamados', criarChamadoPublic)
  app.use(errorHandler(pino({ level: 'silent' })))
  return app
}

const PAYLOAD_BASE = {
  unidade: 'E.E. TESTE',
  solicitante: 'Maria Silva',
  tipo: 'Rede',
  descricao: 'Sem conexão na sala 5',
  urgencia: 'Média',
  email: 'maria.silva@educacao.sp.gov.br'
}

const CHAMADO_CRIADO = {
  id: 'chamado-1',
  protocolo: 'CH-20261008-0001',
  unidade: 'E.E. TESTE',
  solicitante: 'Maria Silva',
  tipo: 'Rede',
  descricao: 'Sem conexão na sala 5',
  urgencia: 'Média',
  anexoUrl: null,
  status: 'ABERTO',
  timestamp: new Date(),
  tecnicoSetor: 'TECNICO1'
} as any

/** base64 com N bytes decodificados (cabe dentro do limite do corpo, não do arquivo). */
function base64De(bytes: number): string {
  return 'A'.repeat(Math.ceil((bytes * 4) / 3))
}

describe('Travas de anexo do chamado público', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
    vi.clearAllMocks()
    vi.mocked(prisma.chamado.findFirst).mockResolvedValue(null as any)
    vi.mocked(prisma.chamado.create).mockResolvedValue(CHAMADO_CRIADO)
  })

  describe('extensão e MIME', () => {
    it('recusa .html com 400 nomeando o arquivo e a extensão', async () => {
      const res = await request(app).post('/api/chamados').send({
        ...PAYLOAD_BASE,
        anexos: [{ nome: 'ata.html', tipo: 'text/html', base64: base64De(1024) }]
      })

      expect(res.status).toBe(400)
      const detalhes = JSON.stringify(res.body.details)
      expect(detalhes).toContain('ata.html')
      expect(detalhes).toContain('.html')
      expect(salvarAnexoComPath).not.toHaveBeenCalled()
    })

    it('recusa .svg (SVG servido como text/html é XSS no bucket público)', async () => {
      const res = await request(app).post('/api/chamados').send({
        ...PAYLOAD_BASE,
        anexos: [{ nome: 'logo.svg', base64: base64De(1024) }]
      })

      expect(res.status).toBe(400)
      expect(JSON.stringify(res.body.details)).toContain('.svg')
    })

    it('recusa arquivo sem extensão', async () => {
      const res = await request(app).post('/api/chamados').send({
        ...PAYLOAD_BASE,
        anexos: [{ nome: 'print', base64: base64De(1024) }]
      })

      expect(res.status).toBe(400)
      expect(JSON.stringify(res.body.details)).toContain('print')
    })

    it('recusa .png declarado como text/html (MIME não bate com a extensão)', async () => {
      const res = await request(app).post('/api/chamados').send({
        ...PAYLOAD_BASE,
        anexos: [{ nome: 'foto.png', tipo: 'text/html', base64: base64De(1024) }]
      })

      expect(res.status).toBe(400)
      expect(JSON.stringify(res.body.details)).toContain('text/html')
    })

    it('aceita .jpg legítimo', async () => {
      const res = await request(app).post('/api/chamados').send({
        ...PAYLOAD_BASE,
        anexos: [{ nome: 'foto.jpg', tipo: 'image/jpeg', base64: base64De(1024) }]
      })

      expect(res.status).toBe(201)
      expect(salvarAnexoComPath).toHaveBeenCalled()
    })
  })

  describe('tamanho — caminho legado anexoBase64', () => {
    it('recusa anexoBase64 acima de 5MB (antes passava o arquivo inteiro)', async () => {
      const res = await request(app).post('/api/chamados').send({
        ...PAYLOAD_BASE,
        anexoNome: 'video.mp4',
        anexoTipo: 'video/mp4',
        anexoBase64: base64De(6 * 1024 * 1024)
      })

      expect(res.status).toBe(400)
      expect(JSON.stringify(res.body.details)).toContain('video.mp4')
      expect(JSON.stringify(res.body.details)).toContain('5MB')
      expect(salvarAnexoComPath).not.toHaveBeenCalled()
    })

    it('anexoBase64 de 24MB é barrado pelo limite de CORPO com 413 (não 500)', async () => {
      const res = await request(app).post('/api/chamados').send({
        ...PAYLOAD_BASE,
        anexoNome: 'video.mp4',
        anexoTipo: 'video/mp4',
        anexoBase64: base64De(24 * 1024 * 1024)
      })

      expect(res.status).toBe(413)
      expect(salvarAnexoComPath).not.toHaveBeenCalled()
    })

    it('recusa anexoBase64 com extensão fora da allowlist', async () => {
      const res = await request(app).post('/api/chamados').send({
        ...PAYLOAD_BASE,
        anexoNome: 'pagina.html',
        anexoTipo: 'text/html',
        anexoBase64: base64De(1024)
      })

      expect(res.status).toBe(400)
      expect(JSON.stringify(res.body.details)).toContain('.html')
      expect(salvarAnexoComPath).not.toHaveBeenCalled()
    })

    it('aceita anexoBase64 dentro do limite', async () => {
      const res = await request(app).post('/api/chamados').send({
        ...PAYLOAD_BASE,
        anexoNome: 'foto.png',
        anexoTipo: 'image/png',
        anexoBase64: base64De(1024 * 1024)
      })

      expect(res.status).toBe(201)
      expect(salvarAnexoComPath).toHaveBeenCalled()
    })

    it('recusa anexo em `anexos` acima de 5MB', async () => {
      const res = await request(app).post('/api/chamados').send({
        ...PAYLOAD_BASE,
        anexos: [{ nome: 'grande.jpg', tipo: 'image/jpeg', base64: base64De(6 * 1024 * 1024) }]
      })

      expect(res.status).toBe(400)
      expect(JSON.stringify(res.body.details)).toContain('grande.jpg')
    })
  })

  describe('quantidade', () => {
    it('soma anexos + anexosPergunta e barra acima do limite único', async () => {
      const anexos = Array.from({ length: 3 }, (_, i) => ({
        nome: `foto${i}.jpg`, tipo: 'image/jpeg', base64: base64De(1024)
      }))
      const anexosPergunta = Array.from({ length: 3 }, (_, i) => ({
        perguntaId: `p${i}`, pergunta: 'Print do erro', nome: `print${i}.png`, tipo: 'image/png', base64: base64De(1024)
      }))

      const res = await request(app).post('/api/chamados').send({ ...PAYLOAD_BASE, anexos, anexosPergunta })

      expect(res.status).toBe(400)
      expect(JSON.stringify(res.body.details)).toContain('no máximo 5 arquivos')
    })
  })

  describe('anexosPergunta', () => {
    it('salva o arquivo da pergunta (antes era descartado em silêncio)', async () => {
      const res = await request(app).post('/api/chamados').send({
        ...PAYLOAD_BASE,
        anexosPergunta: [
          { perguntaId: 'p1', pergunta: 'Anexo do equipamento com defeito', nome: 'defeito.jpg', tipo: 'image/jpeg', base64: base64De(2048) }
        ]
      })

      expect(res.status).toBe(201)
      expect(salvarAnexoComPath).toHaveBeenCalledTimes(1)
      expect(res.body.anexos).toHaveLength(1)
      expect(res.body.anexos[0].nome).toBe('defeito.jpg')
    })

    it('preserva o vínculo com a pergunta no caminho interno do arquivo', async () => {
      await request(app).post('/api/chamados').send({
        ...PAYLOAD_BASE,
        anexosPergunta: [
          { perguntaId: 'p1', pergunta: 'Print do erro', nome: 'erro.png', tipo: 'image/png', base64: base64De(1024) }
        ]
      })

      const pasta = vi.mocked(salvarAnexoComPath).mock.calls[0][3]
      expect(pasta).toContain('p1')
    })

    it('passa pelas mesmas travas: extensão fora da allowlist', async () => {
      const res = await request(app).post('/api/chamados').send({
        ...PAYLOAD_BASE,
        anexosPergunta: [
          { perguntaId: 'p1', pergunta: 'Print', nome: 'xss.html', tipo: 'text/html', base64: base64De(1024) }
        ]
      })

      expect(res.status).toBe(400)
      expect(JSON.stringify(res.body.details)).toContain('xss.html')
      expect(salvarAnexoComPath).not.toHaveBeenCalled()
    })

    it('passa pelas mesmas travas: acima de 5MB', async () => {
      const res = await request(app).post('/api/chamados').send({
        ...PAYLOAD_BASE,
        anexosPergunta: [
          { perguntaId: 'p1', pergunta: 'Print', nome: 'grande.png', tipo: 'image/png', base64: base64De(6 * 1024 * 1024) }
        ]
      })

      expect(res.status).toBe(400)
      expect(JSON.stringify(res.body.details)).toContain('grande.png')
    })

    it('exige perguntaId para o arquivo não ficar órfão', async () => {
      const res = await request(app).post('/api/chamados').send({
        ...PAYLOAD_BASE,
        anexosPergunta: [{ pergunta: 'Print', nome: 'erro.png', base64: base64De(1024) }]
      })

      expect(res.status).toBe(400)
      expect(JSON.stringify(res.body.details)).toContain('perguntaId')
    })
  })

  // O portal precisa saber a qual pergunta cada anexo pertence. Sem isso ele
  // recebe o arquivo e não tem como colocá-lo junto da pergunta que o pediu.
  describe('contrato da resposta 201', () => {
    it('anexo de pergunta volta com perguntaId, pergunta e pasta', async () => {
      const res = await request(app).post('/api/chamados').send({
        ...PAYLOAD_BASE,
        anexosPergunta: [
          { perguntaId: 'seed-perg-sist-1', pergunta: 'Anexo do erro na tela', nome: 'erro.jpg', tipo: 'image/jpeg', base64: base64De(1024) }
        ]
      })

      expect(res.status).toBe(201)
      expect(res.body.anexos[0]).toMatchObject({
        nome: 'erro.jpg',
        perguntaId: 'seed-perg-sist-1',
        pergunta: 'Anexo do erro na tela'
      })
      expect(res.body.anexos[0].pasta).toContain('p-seed-perg-sist-1')
      expect(res.body.anexos[0].url).toBeTruthy()
      expect(res.body.anexos[0].path).toBeTruthy()
    })

    it('anexo comum volta sem perguntaId, e o campo é omitido (não vem vazio)', async () => {
      const res = await request(app).post('/api/chamados').send({
        ...PAYLOAD_BASE,
        anexos: [{ nome: 'foto.jpg', tipo: 'image/jpeg', base64: base64De(1024) }]
      })

      expect(res.status).toBe(201)
      expect(res.body.anexos[0].nome).toBe('foto.jpg')
      expect(res.body.anexos[0]).not.toHaveProperty('perguntaId')
      expect(res.body.anexos[0]).not.toHaveProperty('pergunta')
    })

    it('caminho legado segue sem perguntaId', async () => {
      const res = await request(app).post('/api/chamados').send({
        ...PAYLOAD_BASE,
        anexoNome: 'foto.png',
        anexoTipo: 'image/png',
        anexoBase64: base64De(1024)
      })

      expect(res.status).toBe(201)
      expect(res.body.anexos[0].nome).toBe('foto.png')
      expect(res.body.anexos[0]).not.toHaveProperty('perguntaId')
    })

    it('mistura anexo de pergunta e comum na mesma resposta, cada um com seu vínculo', async () => {
      const res = await request(app).post('/api/chamados').send({
        ...PAYLOAD_BASE,
        anexos: [{ nome: 'geral.jpg', tipo: 'image/jpeg', base64: base64De(1024) }],
        anexosPergunta: [
          { perguntaId: 'p9', pergunta: 'Print da tela', nome: 'print.png', tipo: 'image/png', base64: base64De(1024) }
        ]
      })

      expect(res.status).toBe(201)
      expect(res.body.anexos).toHaveLength(2)
      const comPergunta = res.body.anexos.find((a: any) => a.nome === 'print.png')
      const semPergunta = res.body.anexos.find((a: any) => a.nome === 'geral.jpg')
      expect(comPergunta.perguntaId).toBe('p9')
      expect(comPergunta.pergunta).toBe('Print da tela')
      expect(semPergunta).not.toHaveProperty('perguntaId')
    })
  })

  /**
   * O que o Prisma realmente grava.
   *
   * A rota montava um objeto por anexo com `pasta` e mandava o objeto inteiro no
   * `anexos.create`. `pasta` não é coluna de `ChamadoAnexo`, e o Prisma valida o
   * payload em TEMPO DE EXECUÇÃO — com o prisma mockado o `Unknown arg` nunca
   * acontecia e os 431 testes passavam. Em produção, qualquer chamado com anexo
   * morria com PrismaClientValidationError, inclusive o anexo comum (a `pasta` é
   * preenchida sempre).
   *
   * O guarda aqui é propositalmente raso: não interessa o formato do payload, só
   * que nenhum campo de fora do modelo escape para dentro.
   */
  describe('payload enviado ao Prisma', () => {
    const COLUNAS_DE_CHAMADO_ANEXO = ['id', 'nome', 'tipo', 'url', 'path', 'criadoEm', 'perguntaId', 'pergunta', 'chamadoId']

    function anexosEnviadosAoPrisma(): any[] {
      const arg = vi.mocked(prisma.chamado.create).mock.calls[0]?.[0] as any
      return arg?.data?.anexos?.create ?? []
    }

    it('anexo comum não manda campo fora do modelo', async () => {
      const res = await request(app).post('/api/chamados').send({
        ...PAYLOAD_BASE,
        anexos: [{ nome: 'foto.jpg', tipo: 'image/jpeg', base64: base64De(1024) }]
      })

      expect(res.status).toBe(201)
      const enviados = anexosEnviadosAoPrisma()
      expect(enviados).toHaveLength(1)
      for (const campo of Object.keys(enviados[0])) {
        expect(COLUNAS_DE_CHAMADO_ANEXO).toContain(campo)
      }
      // `pasta` é derivável do `path`: guardar as duas coisas é o que quebrava.
      expect(enviados[0]).not.toHaveProperty('pasta')
    })

    it('anexo de pergunta grava o vínculo e segue sem campo fora do modelo', async () => {
      const res = await request(app).post('/api/chamados').send({
        ...PAYLOAD_BASE,
        anexosPergunta: [
          { perguntaId: 'p9', pergunta: 'Print da tela', nome: 'print.png', tipo: 'image/png', base64: base64De(1024) }
        ]
      })

      expect(res.status).toBe(201)
      const enviados = anexosEnviadosAoPrisma()
      expect(enviados).toHaveLength(1)
      for (const campo of Object.keys(enviados[0])) {
        expect(COLUNAS_DE_CHAMADO_ANEXO).toContain(campo)
      }
      expect(enviados[0]).not.toHaveProperty('pasta')
      expect(enviados[0].perguntaId).toBe('p9')
      expect(enviados[0].pergunta).toBe('Print da tela')
    })

    it('caminho legado também não manda campo fora do modelo', async () => {
      const res = await request(app).post('/api/chamados').send({
        ...PAYLOAD_BASE,
        anexoNome: 'foto.png',
        anexoTipo: 'image/png',
        anexoBase64: base64De(1024)
      })

      expect(res.status).toBe(201)
      const enviados = anexosEnviadosAoPrisma()
      expect(enviados).toHaveLength(1)
      for (const campo of Object.keys(enviados[0])) {
        expect(COLUNAS_DE_CHAMADO_ANEXO).toContain(campo)
      }
      expect(enviados[0]).not.toHaveProperty('pasta')
    })
  })
})