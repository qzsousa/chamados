import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import chamadoRoutes, { criarChamadoPublic } from './chamados'
import { errorHandler } from '../middleware/errorHandler'
import { pino } from 'pino'
import { prisma } from '../config/prisma'

vi.mock('../config/prisma', () => ({
  prisma: {
    chamado: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn()
    },
    usuario: {
      findMany: vi.fn()
    },
    formularioCategoria: {
      findMany: vi.fn()
    }
  }
}))

vi.mock('../services/normalization', () => ({
  normalizarNomeEscola: vi.fn((nome: string) => nome.toUpperCase().replace(/[^A-Z0-9]/g, '')),
  getMapaTecnicos: vi.fn(() => ({ TESTE: 'TECNICO1' }))
}))

vi.mock('../services/migration', () => ({
  getMapaInventario: vi.fn(() => Promise.resolve({ TESTE: 'CONCLUIDO' }))
}))

// Notificação e e-mail são efeitos colaterais: o teste é do status da resposta.
vi.mock('../services/notificacoes', () => ({
  notificarAdmins: vi.fn(() => Promise.resolve()),
  notificarUnidade: vi.fn(() => Promise.resolve()),
  notificarUsuario: vi.fn(() => Promise.resolve())
}))

vi.mock('../services/email', () => ({
  notificarChamadoStatusAlterado: vi.fn(() => Promise.resolve()),
  notificarChamadoCriado: vi.fn(() => Promise.resolve()),
  notificarChamadoConcluido: vi.fn(() => Promise.resolve())
}))

// Só os efeitos colaterais são mockados; `destinoWhere` e companhia continuam
// vindo do módulo real. `vi.importActual` é ASSÍNCRONO — espalhar o Promise
// direto (`...vi.importActual()`) daria `{}` e sumiria com todo export real.
vi.mock('../services/encaminhamento', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/encaminhamento')>()),
  encaminharPorRegras: vi.fn(() => Promise.resolve(false)),
  encaminharChamado: vi.fn(),
  tecnicosDaUnidade: vi.fn(() => Promise.resolve([])),
  encaminharPendentes: vi.fn(),
}))

/** Usuário do request — os testes trocam o nível (o DELETE em lote é só ADMIN). */
const usuario = { id: 'user-1', email: 'user@test.com', nome: 'Test User', nivel: 'TECNICO', filial: 'E.E. TESTE', status: 'ATIVO', primeiroLogin: false }

vi.mock('../middleware/auth', () => {
  const authMiddleware = (req: any, _res: any, next: any) => {
    req.user = { sub: usuario.id, email: usuario.email, nome: usuario.nome, nivel: usuario.nivel, filial: usuario.filial, type: 'access', iat: Date.now(), exp: Date.now() + 15 * 60 * 1000 }
    // No index.ts quem popula isto é o `attachUserRecord`, montado logo depois do
    // `authMiddleware`. Sem preencher aqui, a listagem nunca veria o nível do
    // usuário e o filtro de escopo (o `OR` do técnico) não existiria.
    req.userRecord = { ...usuario }
    next()
  }
  const requireRole = (...roles: string[]) => (req: any, res: any, next: any) => {
    req.userRecord = { ...usuario }
    if (!roles.includes(req.userRecord.nivel)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Sem permissão' })
    }
    next()
  }
  const attachUserRecord = (req: any, _res: any, next: any) => {
    req.userRecord = { ...usuario }
    next()
  }
  return { authMiddleware, requireRole, attachUserRecord }
})

/** Ids no formato cuid: o schema valida, e o fake 'chamado-1' vira 400. */
const CUID_1 = 'clh3k4j5k0000abcd1234efgh'
const CUID_2 = 'clh3k4j5k0000abcd1234efgi'

const createApp = () => {
  const app = express()
  app.use(express.json())
  // A criação é rota PÚBLICA, montada no index.ts antes do router autenticado.
  app.post('/api/chamados', criarChamadoPublic)
  app.use('/api/chamados', chamadoRoutes)
  app.use(errorHandler(pino({ level: 'silent' })))
  return app
}

describe('Chamados Routes', () => {
  let app: express.Express

  beforeEach(() => {
    app = createApp()
    vi.clearAllMocks()
    Object.assign(usuario, { nivel: 'TECNICO', filial: 'E.E. TESTE', nome: 'Test User' })
  })

  describe('POST / (público)', () => {
    it('should return 400 for invalid data', async () => {
      const res = await request(app)
        .post('/api/chamados')
        .send({ unidade: '', solicitante: '', tipo: '', descricao: '', urgencia: '' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('should create chamado with protocolo', async () => {
      vi.mocked(prisma.chamado.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.chamado.create).mockResolvedValue({
        id: 'chamado-1',
        protocolo: 'CH-20240101-0001',
        timestamp: new Date(),
        unidade: 'E.E. TESTE',
        solicitante: 'João',
        funcao: null,
        tipo: 'Hardware',
        descricao: 'Problema no computador',
        urgencia: 'Alta',
        anexoUrl: null,
        status: 'ABERTO',
        responsavel: null,
        ultimaAtualizacao: new Date(),
        historico: 'Chamado criado em 01/01/2024',
        tecnicoResolucao: null,
        tecnicoSetor: 'TECNICO1',
        inventarioStatus: 'CONCLUIDO'
      })

      const res = await request(app)
        .post('/api/chamados')
        .send({
          unidade: 'E.E. TESTE',
          solicitante: 'João',
          tipo: 'Hardware',
          descricao: 'Problema no computador',
          urgencia: 'Alta',
          email: 'solicitante@test.com'
        })

      expect(res.status).toBe(201)
      expect(res.body.protocolo).toMatch(/^CH-\d{8}-\d{4}$/)
      expect(res.body.unidade).toBe('E.E. TESTE')
      expect(res.body.tecnicoSetor).toBe('TECNICO1')
    })
  })

  describe('GET /', () => {
    it('should return paginated chamados', async () => {
      vi.mocked(prisma.chamado.count).mockResolvedValue(1)
      vi.mocked(prisma.chamado.findMany).mockResolvedValue([
        { id: 'chamado-1', protocolo: 'CH-20240101-0001', timestamp: new Date(), unidade: 'E.E. TESTE', solicitante: 'João', funcao: null, tipo: 'Hardware', descricao: 'Problema', urgencia: 'Alta', anexoUrl: null, status: 'ABERTO', responsavel: null, ultimaAtualizacao: new Date(), historico: null, tecnicoResolucao: null, tecnicoSetor: 'TECNICO1', inventarioStatus: 'CONCLUIDO' }
      ])

      const res = await request(app).get('/api/chamados')

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 })
    })
  })

  /* ---- Filtros de categoria e técnico (selects da listagem) ---- */
  describe('GET / — filtros', () => {
    beforeEach(() => {
      vi.mocked(prisma.chamado.count).mockResolvedValue(0)
      vi.mocked(prisma.chamado.findMany).mockResolvedValue([])
      vi.mocked(prisma.formularioCategoria.findMany).mockResolvedValue([
        { chave: 'equipamento', nome: 'Equipamento' },
        { chave: 'rede', nome: 'Rede' },
      ] as any)
    })

    /** O `where` que a rota monta para o Prisma — é o que interessa no filtro. */
    async function whereDaListagem(query: string) {
      await request(app).get(`/api/chamados?${query}`)
      return vi.mocked(prisma.chamado.findMany).mock.calls[0][0]?.where
    }

    /**
     * A chave sozinha não acha os chamados antigos (364 dos 365 no banco):
     * o filtro tem de cair no texto do `tipo` também.
     */
    it('categoriaChave traz a chave OU o texto do tipo dos chamados antigos', async () => {
      const where = await whereDaListagem('categoriaChave=equipamento')

      expect(where.AND).toEqual([
        {
          OR: [
            { categoriaChave: { equals: 'equipamento', mode: 'insensitive' } },
            { tipo: { startsWith: 'Equipamento', mode: 'insensitive' } },
          ],
        },
      ])
    })

    it('categoriaChave só considera categorias ativas ao casar pelo texto', async () => {
      await whereDaListagem('categoriaChave=equipamento')

      expect(prisma.formularioCategoria.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ativa: true } })
      )
    })

    /**
     * O `where.OR` do nível TECNICO (unidades que ele atende OU chamados
     * dele) já está em uso: o filtro de categoria precisa ir em `AND`, senão
     * um sobrescreve o outro e o técnico passa a ver chamado de outra unidade.
     */
    it('não sobrescreve o OR de escopo do técnico', async () => {
      const where = await whereDaListagem('categoriaChave=equipamento')

      expect(where.OR).toBeDefined()
      expect(where.AND).toHaveLength(1)
    })

    /**
     * `__sem__` precisa ser o COMPLEMENTO das categorias, não só `chave IS
     * NULL`: senão um chamado antigo cujo `tipo` começa com "Rede" aparece
     * tanto em "Rede" quanto em "Sem categoria", e a pessoa não sabe em qual
     * dos dois filtros achá-lo.
     *
     * A forma exata importa e não é a óbvia — ver as armadilhas comentadas em
     * `clausesForaDeTodas`. Contra o banco real, só esta conta 338 (e as
     * categorias 28, fechando as 366); `NOT { OR: [...] }` devolve 0.
     */
    it('categoriaChave=__sem__ é o que não bate com NENHUMA categoria', async () => {
      const where = await whereDaListagem('categoriaChave=__sem__')

      expect(where.AND).toEqual([
        // "não é Equipamento": a chave pode ser NULA, então o `not` da chave
        // precisa do `IS NULL` ao lado, senão a linha é descartada.
        { OR: [{ categoriaChave: null }, { categoriaChave: { not: 'equipamento' } }] },
        { NOT: { tipo: { startsWith: 'Equipamento', mode: 'insensitive' } } },
        { OR: [{ categoriaChave: null }, { categoriaChave: { not: 'rede' } }] },
        { NOT: { tipo: { startsWith: 'Rede', mode: 'insensitive' } } },
      ])
    })

    /**
     * `tipo` é NOT NULL, então o `NOT` sobre ele é um booleano de verdade —
     * é o que garante que as duas metades (categoria / sem categoria) somem
     * exatamente o total, sem chamado contado duas vezes.
     */
    it('o NOT do tipo fica no objeto, não dentro do campo', async () => {
      const where = await whereDaListagem('categoriaChave=__sem__')

      // `{ tipo: { not: /…/ } }` é aceito pelo Prisma e NÃO filtra nada nesta
      // versão; `notStartsWith` nem existe. A negation precisa vir do NOT.
      for (const termo of where.AND) {
        if (termo.tipo) throw new Error('filtro por tipo deve vir dentro de um NOT')
      }
    })

    it('responsavel filtra pelo nome, sem acento e sem diferenciar maiúsculas', async () => {
      const where = await whereDaListagem('responsavel=joao')

      expect(where.responsavel).toEqual({ contains: 'joao', mode: 'insensitive' })
    })

    it('categoria (texto do tipo) e categoriaChave convivem como filtros distintos', async () => {
      const where = await whereDaListagem('categoria=PortalNet&categoriaChave=sistemas')

      expect(where.tipo).toEqual({ contains: 'PortalNet', mode: 'insensitive' })
      expect(where.AND).toHaveLength(1)
    })

    it('sem os filtros, nada é restringido', async () => {
      const where = await whereDaListagem('')

      expect(where).not.toHaveProperty('categoriaChave')
      expect(where).not.toHaveProperty('responsavel')
      expect(where).not.toHaveProperty('AND')
    })
  })

  describe('GET /filtros/tecnicos', () => {
    it('lista os ativos e quem já tem chamado em seu nome, sem repetir', async () => {
      vi.mocked(prisma.usuario.findMany).mockResolvedValue([
        { nome: 'FERNANDA' },
        { nome: 'PABLO' },
      ] as any)
      vi.mocked(prisma.chamado.findMany).mockResolvedValue([
        { responsavel: 'PABLO' },
        { responsavel: 'Tecnico Desativado' },
        { responsavel: null },
      ] as any)

      const res = await request(app).get('/api/chamados/filtros/tecnicos')

      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data).toEqual(['FERNANDA', 'PABLO', 'Tecnico Desativado'])
    })

    /**
     * No banco a mesma pessoa aparece como "JESSICA", "Jessica" e "jessica" em
     * chamados antigos. O filtro casa sem diferenciar maiúsculas, então uma
     * opção só por pessoa — as três viriam repetição sem ganho, e a pessoa não
     * saberia qual das três oferece o chamado antigo.
     */
    it('agrupa o mesmo técnico escrito de jeitos diferentes', async () => {
      vi.mocked(prisma.usuario.findMany).mockResolvedValue([{ nome: 'JESSICA' }] as any)
      vi.mocked(prisma.chamado.findMany).mockResolvedValue([
        { responsavel: 'Jessica' },
        { responsavel: 'jessica' },
      ] as any)

      const res = await request(app).get('/api/chamados/filtros/tecnicos')

      expect(res.body.data).toEqual(['JESSICA'])
    })

    /**
     * Acento NÃO pode entrar no agrupamento: o filtro casa por `contains`, que
     * não ignora acento. Agrupar "Joao" (cadastro) com "JOÃO" (chamado)
     * entregaria uma opção que não acha chamado nenhum — os 5 chamados do
     * "JOÃO" ficariam inalcançáveis, sem erro nenhum para avisar.
     */
    it('NÃO agrupa nomes que só diferem no acento', async () => {
      vi.mocked(prisma.usuario.findMany).mockResolvedValue([{ nome: 'Joao' }] as any)
      vi.mocked(prisma.chamado.findMany).mockResolvedValue([{ responsavel: 'JOÃO' }] as any)

      const res = await request(app).get('/api/chamados/filtros/tecnicos')

      expect(res.body.data).toEqual(['Joao', 'JOÃO'])
    })

    it('nomes diferentes continuam separados ("HERBERT" não é "HEBERT")', async () => {
      vi.mocked(prisma.usuario.findMany).mockResolvedValue([
        { nome: 'HERBERT' },
        { nome: 'HEBERT' },
      ] as any)
      vi.mocked(prisma.chamado.findMany).mockResolvedValue([] as any)

      const res = await request(app).get('/api/chamados/filtros/tecnicos')

      expect(res.body.data).toEqual(['HEBERT', 'HERBERT'])
    })

    it('GESTOR também consegue chamar (a tela /chamados é aberta por ele)', async () => {
      Object.assign(usuario, { nivel: 'GESTOR' })
      vi.mocked(prisma.usuario.findMany).mockResolvedValue([])
      vi.mocked(prisma.chamado.findMany).mockResolvedValue([])

      const res = await request(app).get('/api/chamados/filtros/tecnicos')

      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([])
    })

    it('ignora chamado excluído e responsável em branco', async () => {
      vi.mocked(prisma.usuario.findMany).mockResolvedValue([])
      vi.mocked(prisma.chamado.findMany).mockResolvedValue([{ responsavel: '   ' }] as any)

      const res = await request(app).get('/api/chamados/filtros/tecnicos')

      expect(res.body.data).toEqual([])
      // `excluido: false` evita que o filtro ofereça quem só tem chamado apagado.
      expect(vi.mocked(prisma.chamado.findMany).mock.calls[0][0]?.where).toEqual(
        expect.objectContaining({ excluido: false })
      )
    })
  })

  describe('GET /:id', () => {
    it('should return 404 for non-existent chamado', async () => {
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue(null)

      const res = await request(app).get('/api/chamados/non-existent')

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('NOT_FOUND')
    })

    it('should return chamado data', async () => {
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue({
        id: 'chamado-1',
        protocolo: 'CH-20240101-0001',
        timestamp: new Date(),
        unidade: 'E.E. TESTE',
        solicitante: 'João',
        funcao: null,
        tipo: 'Hardware',
        descricao: 'Problema',
        urgencia: 'Alta',
        anexoUrl: null,
        status: 'ABERTO',
        responsavel: null,
        ultimaAtualizacao: new Date(),
        historico: null,
        tecnicoResolucao: null,
        tecnicoSetor: 'TECNICO1',
        inventarioStatus: 'CONCLUIDO'
      })

      const res = await request(app).get('/api/chamados/chamado-1')

      expect(res.status).toBe(200)
      expect(res.body.id).toBe('chamado-1')
    })
  })

  describe('PATCH /:id/status', () => {
    it('should return 400 for invalid status', async () => {
      const res = await request(app)
        .patch('/api/chamados/chamado-1/status')
        .send({ status: 'INVALID' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('should return 404 for non-existent chamado', async () => {
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue(null)

      const res = await request(app)
        .patch('/api/chamados/non-existent/status')
        .send({ status: 'ANDAMENTO' })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('NOT_FOUND')
    })

    it('should update status and add to historico', async () => {
      // A rota relê o chamado no fim (devolve a versão já salva): o mock
      // responde o original na primeira busca e o atualizado na segunda.
      vi.mocked(prisma.chamado.findUnique)
        .mockResolvedValueOnce({
          id: CUID_1,
          protocolo: 'CH-20240101-0001',
          unidade: 'E.E. TESTE',
          status: 'ABERTO',
          tecnicoSetor: 'TECNICO1',
          responsavel: 'Test User',
          historico: 'Histórico anterior',
          tecnicoResolucao: null
        })
        .mockResolvedValue({
          id: CUID_1,
          status: 'ANDAMENTO',
          responsavel: 'Test User',
          ultimaAtualizacao: new Date(),
          tecnicoResolucao: 'Técnico Resolução',
          historico: 'Histórico anterior\n[01/01/2024] Status alterado para "ANDAMENTO" por Test User (técnico: Técnico Resolução)'
        })
      vi.mocked(prisma.chamado.update).mockResolvedValue({
        id: CUID_1,
        status: 'ANDAMENTO',
        responsavel: 'Test User',
        ultimaAtualizacao: new Date(),
        tecnicoResolucao: 'Técnico Resolução',
        historico: 'Histórico anterior\n[01/01/2024] Status alterado para "ANDAMENTO" por Test User (técnico: Técnico Resolução)'
      })

      const res = await request(app)
        .patch(`/api/chamados/${CUID_1}/status`)
        .send({ status: 'ANDAMENTO', tecnicoResolucao: 'Técnico Resolução' })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ANDAMENTO')
      expect(res.body.tecnicoResolucao).toBe('Técnico Resolução')
      expect(res.body.historico).toContain('Status alterado para "ANDAMENTO"')
    })

    // Regra de dono: o técnico só mexe no chamado dele ou da unidade dele.
    it('403 para técnico que não é o responsável e não atende a unidade', async () => {
      Object.assign(usuario, { filial: 'E.E. OUTRA' })
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue({
        id: CUID_1,
        protocolo: 'CH-20240101-0001',
        unidade: 'E.E. TESTE',
        status: 'ABERTO',
        responsavel: 'Outro Técnico',
        historico: ''
      })

      const res = await request(app)
        .patch(`/api/chamados/${CUID_1}/status`)
        .send({ status: 'ANDAMENTO' })

      expect(res.status).toBe(403)
      expect(res.body.error).toBe('FORBIDDEN')
    })

    it('ADMIN mexe em qualquer chamado, de qualquer unidade', async () => {
      Object.assign(usuario, { nivel: 'ADMIN', filial: '' })
      vi.mocked(prisma.chamado.findUnique).mockResolvedValue({
        id: CUID_1,
        protocolo: 'CH-20240101-0001',
        unidade: 'E.E. TESTE',
        status: 'ABERTO',
        responsavel: 'Outro Técnico',
        historico: ''
      })
      vi.mocked(prisma.chamado.update).mockResolvedValue({ id: CUID_1, status: 'RESOLVIDO', historico: 'x' })

      const res = await request(app)
        .patch(`/api/chamados/${CUID_1}/status`)
        .send({ status: 'RESOLVIDO', descricaoResolucao: 'Resolvido' })

      expect(res.status).toBe(200)
    })
  })

  describe('POST /:id/resposta', () => {
    it('should add resposta to historico', async () => {
      vi.mocked(prisma.chamado.findUnique)
        .mockResolvedValueOnce({
          id: CUID_1,
          protocolo: 'CH-20240101-0001',
          unidade: 'E.E. TESTE',
          status: 'ABERTO',
          responsavel: 'Test User',
          historico: 'Histórico anterior'
        })
        .mockResolvedValue({
          id: CUID_1,
          historico: 'Histórico anterior\n[01/01/2024] Test User: Nova resposta'
        })
      vi.mocked(prisma.chamado.update).mockResolvedValue({
        id: CUID_1,
        historico: 'Histórico anterior\n[01/01/2024] Test User: Nova resposta'
      })

      const res = await request(app)
        .post(`/api/chamados/${CUID_1}/resposta`)
        .send({ texto: 'Nova resposta' })

      expect(res.status).toBe(200)
      expect(res.body.historico).toContain('Nova resposta')
    })
  })

  describe('PATCH /batch', () => {
    it('should return 400 for empty ids', async () => {
      const res = await request(app)
        .patch('/api/chamados/batch')
        .send({ ids: [], status: 'RESOLVIDO' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('VALIDATION_ERROR')
    })

    it('should batch update chamados', async () => {
      vi.mocked(prisma.chamado.findMany).mockResolvedValue([
        { id: CUID_1, unidade: 'E.E. TESTE', responsavel: 'Test User', historico: '', tecnicoResolucao: null },
        { id: CUID_2, unidade: 'E.E. TESTE', responsavel: 'Test User', historico: '', tecnicoResolucao: null }
      ])
      vi.mocked(prisma.chamado.update).mockResolvedValue({})

      const res = await request(app)
        .patch('/api/chamados/batch')
        .send({ ids: [CUID_1, CUID_2], status: 'RESOLVIDO', resposta: 'Resolvido em lote' })

      expect(res.status).toBe(200)
      expect(res.body.atualizados).toBe(2)
      expect(prisma.chamado.update).toHaveBeenCalledTimes(2)
    })
  })

  describe('DELETE /batch', () => {
    it('should delete chamados (ADMIN only)', async () => {
      Object.assign(usuario, { nivel: 'ADMIN' })
      // Exclusão lógica: a rota marca `excluido: true` (updateMany), não apaga a linha.
      vi.mocked(prisma.chamado.updateMany).mockResolvedValue({ count: 2 })

      const res = await request(app)
        .delete('/api/chamados/batch')
        .send({ ids: [CUID_1, CUID_2] })

      expect(res.status).toBe(200)
      expect(res.body.removidos).toBe(2)
      expect(prisma.chamado.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { excluido: true } }),
      )
    })

    it('403 para quem não é ADMIN', async () => {
      const res = await request(app)
        .delete('/api/chamados/batch')
        .send({ ids: [CUID_1, CUID_2] })

      expect(res.status).toBe(403)
    })
  })
})
