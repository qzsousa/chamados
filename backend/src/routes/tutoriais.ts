import { Router, type Request, type Response } from 'express'
import { ZodError } from 'zod'
import { isZodError } from '../utils/zodError'
import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma'
import { supabase } from '../config/supabase'
import { requireRole, AuthenticatedRequest } from '../middleware/auth'
import { salvarAnexo } from '../services/anexos'
import {
  AtualizarTutorialCategoriaSchema,
  AtualizarTutorialSchema,
  CriarTutorialCategoriaSchema,
  CriarTutorialSchema
} from '@shared/api'

const router = Router()

/** Mantém o mesmo response shape das demais rotas. */
function respostaValidacao(res: import('express').Response, err: ZodError) {
  return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Dados inválidos', details: err.flatten().fieldErrors })
}

/**
 * Extrai o path interno do bucket `anexos` a partir da URL pública do Storage
 * (formato: {supabaseUrl}/storage/v1/object/public/anexos/{path}). Retorna
 * null quando a URL não é reconhecível (ex.: fallback salvo sem upload).
 */
function storagePathFromUrl(url: string): string | null {
  const marker = '/storage/v1/object/public/anexos/'
  const idx = url.indexOf(marker)
  return idx >= 0 ? decodeURIComponent(url.slice(idx + marker.length)) : null
}

/** Remoção best-effort dos arquivos no Storage; nunca falha a requisição. */
async function removerDoStorage(urls: string[]): Promise<void> {
  if (!supabase) return
  const paths = urls
    .map((u) => storagePathFromUrl(u))
    .filter((p): p is string => Boolean(p))
  if (!paths.length) return

  try {
    await supabase.storage.from('anexos').remove(paths)
  } catch (err) {
    console.error('[tutoriais] Falha ao remover anexos do Storage:', err)
  }
}

// ============================================
// CATEGORIAS
// (definidas antes de '/:id' para não colidir)
// ============================================

router.get('/categorias', async (_req, res) => {
  const categorias = await prisma.tutorialCategoria.findMany({
    orderBy: { nome: 'asc' },
    include: { _count: { select: { tutoriais: true } } }
  })
  return res.json({
    data: categorias.map((c) => ({
      id: c.id,
      nome: c.nome,
      descricao: c.descricao,
      cor: c.cor,
      totalTutoriais: c._count.tutoriais
    }))
  })
})

router.post('/categorias', requireRole('ADMIN'), async (req, res) => {
  try {
    const data = CriarTutorialCategoriaSchema.parse(req.body)
    const categoria = await prisma.tutorialCategoria.create({ data })
    return res.status(201).json(categoria)
  } catch (err) {
    if (isZodError(err)) {
      return respostaValidacao(res, err)
    }
    if ((err as any)?.code === 'P2002') {
      return res.status(409).json({ error: 'CONFLICT', message: 'Já existe uma categoria com esse nome.' })
    }
    throw err
  }
})

router.patch('/categorias/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    const data = AtualizarTutorialCategoriaSchema.parse(req.body)
    const categoria = await prisma.tutorialCategoria.update({
      where: { id: req.params.id },
      data
    })
    return res.json(categoria)
  } catch (err) {
    if (isZodError(err)) {
      return respostaValidacao(res, err)
    }
    if ((err as any)?.code === 'P2002') {
      return res.status(409).json({ error: 'CONFLICT', message: 'Já existe uma categoria com esse nome.' })
    }
    if ((err as any)?.code === 'P2025') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Categoria não encontrada.' })
    }
    throw err
  }
})

router.delete('/categorias/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    // Pré-checagem legível; a FK (onDelete: Restrict) ainda protege de corridas
    const total = await prisma.tutorial.count({ where: { categoriaId: req.params.id } })
    if (total > 0) {
      return res.status(409).json({ error: 'CONFLICT', message: 'Categoria possui tutoriais, mova-os antes de excluir.' })
    }
    await prisma.tutorialCategoria.delete({ where: { id: req.params.id } })
    return res.status(204).send()
  } catch (err) {
    if ((err as any)?.code === 'P2003' || (err as any)?.code === 'P2014') {
      return res.status(409).json({ error: 'CONFLICT', message: 'Categoria possui tutoriais, mova-os antes de excluir.' })
    }
    if ((err as any)?.code === 'P2025') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Categoria não encontrada.' })
    }
    throw err
  }
})

// ============================================
// TUTORIAIS
// ============================================

/**
 * Leitura PÚBLICA de um tutorial (sem login) — link compartilhável gerado pelo
 * portal (/tutorial/:id). É montada diretamente em index.ts, ANTES do
 * authMiddleware. Mesmo comportamento do GET /:id autenticado: registra a
 * visualização e devolve o tutorial com categoria e anexos (as URLs dos
 * anexos já são públicas — bucket público do Storage).
 */
export async function obterTutorialPublic(req: Request, res: Response) {
  try {
    // update + increment registra a visualização e já retorna o registro
    const tutorial = await prisma.tutorial.update({
      where: { id: req.params.id },
      data: { visualizacoes: { increment: 1 } },
      include: { categoria: true, anexos: true }
    })
    return res.json(tutorial)
  } catch (err) {
    if ((err as any)?.code === 'P2025') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Tutorial não encontrado.' })
    }
    throw err
  }
}

// ============================================
// INTERAÇÕES (curtidas e comentários)
// ============================================

interface ComentarioInteracao {
  id: string
  autorNome: string
  texto: string
  parentId: string | null
  createdAt: Date
  updatedAt: Date
  curtidasCount: number
  curtidoPorMim: boolean
  respostas: ComentarioInteracao[]
}

function montarArvoreComentarios(
  todos: Array<{
    id: string
    autorNome: string
    texto: string
    parentId: string | null
    createdAt: Date
    updatedAt: Date
    _count: { curtidas: number }
    curtidas: Array<{ id: string }>
  }>,
): ComentarioInteracao[] {
  const mapa = new Map<string, ComentarioInteracao>()
  for (const c of todos) {
    mapa.set(c.id, {
      id: c.id,
      autorNome: c.autorNome,
      texto: c.texto,
      parentId: c.parentId,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      curtidasCount: c._count.curtidas,
      curtidoPorMim: c.curtidas.length > 0,
      respostas: []
    })
  }
  const raiz: ComentarioInteracao[] = []
  for (const c of todos) {
    const node = mapa.get(c.id)!
    if (c.parentId && mapa.has(c.parentId)) {
      mapa.get(c.parentId)!.respostas.push(node)
    } else {
      raiz.push(node)
    }
  }
  return raiz
}

// Curtir / descurtir um TUTORIAL (toggle).
router.post('/:id/curtir', async (req: AuthenticatedRequest, res) => {
  try {
    const tutorialId = req.params.id
    const usuarioId = req.userRecord!.id
    const existente = await prisma.tutorialCurtida.findUnique({
      where: { tutorialId_usuarioId: { tutorialId, usuarioId } }
    })
    let curtido = false
    if (existente) {
      await prisma.tutorialCurtida.delete({ where: { id: existente.id } })
      curtido = false
    } else {
      await prisma.tutorialCurtida.create({ data: { tutorialId, usuarioId } })
      curtido = true
    }
    const total = await prisma.tutorialCurtida.count({ where: { tutorialId } })
    return res.json({ curtido, total })
  } catch (err) {
    if ((err as any)?.code === 'P2025' || (err as any)?.code === 'P2003') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Tutorial não encontrado.' })
    }
    throw err
  }
})

// Contagem de curtidas do tutorial e se o usuário atual curtiu.
router.get('/:id/curtidas', async (req: AuthenticatedRequest, res) => {
  try {
    const tutorialId = req.params.id
    const usuarioId = req.userRecord!.id
    const total = await prisma.tutorialCurtida.count({ where: { tutorialId } })
    const existente = await prisma.tutorialCurtida.findUnique({
      where: { tutorialId_usuarioId: { tutorialId, usuarioId } }
    })
    return res.json({ total, curtido: Boolean(existente) })
  } catch (err) {
    throw err
  }
})

// Listar comentários (árvore) de um tutorial.
router.get('/:id/comentarios', async (req: AuthenticatedRequest, res) => {
  try {
    const tutorialId = req.params.id
    const usuarioId = req.userRecord!.id
    const todos = await prisma.tutorialComentario.findMany({
      where: { tutorialId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { curtidas: true } },
        curtidas: { where: { usuarioId }, select: { id: true } }
      }
    })
    return res.json({ data: montarArvoreComentarios(todos as any) })
  } catch (err) {
    throw err
  }
})

// Criar comentário (ou resposta, se parentId informado).
router.post('/:id/comentarios', async (req: AuthenticatedRequest, res) => {
  try {
    const tutorialId = req.params.id
    const usuarioId = req.userRecord!.id
    const autorNome = req.userRecord!.nome
    const texto = typeof req.body?.texto === 'string' ? req.body.texto.trim() : ''
    const parentId = typeof req.body?.parentId === 'string' && req.body.parentId ? req.body.parentId : null

    if (!texto || texto.length > 2000) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Comentário inválido.' })
    }

    const tutorial = await prisma.tutorial.findUnique({ where: { id: tutorialId } })
    if (!tutorial) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Tutorial não encontrado.' })
    }

    if (parentId) {
      const pai = await prisma.tutorialComentario.findUnique({ where: { id: parentId } })
      if (!pai || pai.tutorialId !== tutorialId) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Comentário pai não encontrado.' })
      }
    }

    const comentario = await prisma.tutorialComentario.create({
      data: { tutorialId, usuarioId, autorNome, texto, parentId },
      include: {
        _count: { select: { curtidas: true } },
        curtidas: { where: { usuarioId }, select: { id: true } }
      }
    })

    return res.status(201).json({
      id: comentario.id,
      autorNome: comentario.autorNome,
      texto: comentario.texto,
      parentId: comentario.parentId,
      createdAt: comentario.createdAt,
      updatedAt: comentario.updatedAt,
      curtidasCount: comentario._count.curtidas,
      curtidoPorMim: comentario.curtidas.length > 0,
      respostas: []
    })
  } catch (err) {
    throw err
  }
})

// Curtir / descurtir um COMENTÁRIO (toggle).
router.post('/comentarios/:id/curtir', async (req: AuthenticatedRequest, res) => {
  try {
    const comentarioId = req.params.id
    const usuarioId = req.userRecord!.id
    const existente = await prisma.tutorialComentarioCurtida.findUnique({
      where: { comentarioId_usuarioId: { comentarioId, usuarioId } }
    })
    let curtido = false
    if (existente) {
      await prisma.tutorialComentarioCurtida.delete({ where: { id: existente.id } })
      curtido = false
    } else {
      await prisma.tutorialComentarioCurtida.create({ data: { comentarioId, usuarioId } })
      curtido = true
    }
    const total = await prisma.tutorialComentarioCurtida.count({ where: { comentarioId } })
    return res.json({ curtido, total })
  } catch (err) {
    if ((err as any)?.code === 'P2003') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Comentário não encontrado.' })
    }
    throw err
  }
})

// Excluir um comentário (dono ou ADMIN).
router.delete('/comentarios/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id
    const existente = await prisma.tutorialComentario.findUnique({ where: { id } })
    if (!existente) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Comentário não encontrado.' })
    }
    const ehDono = existente.usuarioId === req.userRecord!.id
    const ehAdmin = req.userRecord!.nivel === 'ADMIN'
    if (!ehDono && !ehAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Sem permissão.' })
    }
    await prisma.tutorialComentario.delete({ where: { id } })
    return res.status(204).send()
  } catch (err) {
    if ((err as any)?.code === 'P2025') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Comentário não encontrado.' })
    }
    throw err
  }
})

router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 12))
  const q = (req.query.q as string) || ''
  const categoriaId = req.query.categoriaId as string | undefined

  const where: Prisma.TutorialWhereInput = {}
  if (q) {
    where.OR = [
      { titulo: { contains: q, mode: 'insensitive' } },
      { subtitulo: { contains: q, mode: 'insensitive' } },
      { conteudo: { contains: q, mode: 'insensitive' } }
    ]
  }
  if (categoriaId) where.categoriaId = categoriaId

  const [total, data] = await Promise.all([
    prisma.tutorial.count({ where }),
    prisma.tutorial.findMany({
      where,
      include: { categoria: true, anexos: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })
  ])

  return res.json({
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
  })
})

router.get('/:id', async (req, res) => {
  try {
    // update + increment registra a visualização e já retorna o registro
    const tutorial = await prisma.tutorial.update({
      where: { id: req.params.id },
      data: { visualizacoes: { increment: 1 } },
      include: { categoria: true, anexos: true }
    })
    return res.json(tutorial)
  } catch (err) {
    if ((err as any)?.code === 'P2025') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Tutorial não encontrado.' })
    }
    throw err
  }
})

router.post('/', requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const data = CriarTutorialSchema.parse(req.body)

    const categoria = await prisma.tutorialCategoria.findUnique({ where: { id: data.categoriaId } })
    if (!categoria) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Categoria não encontrada.' })
    }

    const tutorial = await prisma.tutorial.create({
      data: {
        titulo: data.titulo,
        subtitulo: data.subtitulo,
        conteudo: data.conteudo,
        categoriaId: data.categoriaId,
        criadoPor: req.userRecord!.nome
      }
    })

    for (const a of data.anexos ?? []) {
      const url = await salvarAnexo(a.base64, a.nome, a.tipo ?? '', `tutoriais/${tutorial.id}`)
      if (!url) continue // storage indisponível — tutorial segue sem o anexo
      await prisma.tutorialAnexo.create({
        data: { tutorialId: tutorial.id, nome: a.nome, tipo: a.tipo ?? '', url }
      })
    }

    const completo = await prisma.tutorial.findUnique({
      where: { id: tutorial.id },
      include: { categoria: true, anexos: true }
    })
    return res.status(201).json(completo)
  } catch (err) {
    if (isZodError(err)) {
      return respostaValidacao(res, err)
    }
    throw err
  }
})

router.patch('/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    const data = AtualizarTutorialSchema.parse(req.body)

    const existente = await prisma.tutorial.findUnique({
      where: { id: req.params.id },
      include: { anexos: true }
    })
    if (!existente) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Tutorial não encontrado.' })
    }

    if (data.categoriaId) {
      const categoria = await prisma.tutorialCategoria.findUnique({ where: { id: data.categoriaId } })
      if (!categoria) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Categoria não encontrada.' })
      }
    }

    const removerIds = data.removerAnexoIds ?? []
    if (removerIds.length) {
      const removidos = existente.anexos.filter((a) => removerIds.includes(a.id))
      await prisma.tutorialAnexo.deleteMany({
        where: { tutorialId: existente.id, id: { in: removerIds } }
      })
      removerDoStorage(removidos.map((a) => a.url)).catch(() => {})
    }

    for (const a of data.anexosNovos ?? []) {
      const url = await salvarAnexo(a.base64, a.nome, a.tipo ?? '', `tutoriais/${existente.id}`)
      if (!url) continue
      await prisma.tutorialAnexo.create({
        data: { tutorialId: existente.id, nome: a.nome, tipo: a.tipo ?? '', url }
      })
    }

    const atualizado = await prisma.tutorial.update({
      where: { id: existente.id },
      data: {
        titulo: data.titulo,
        subtitulo: data.subtitulo,
        conteudo: data.conteudo,
        categoriaId: data.categoriaId
      },
      include: { categoria: true, anexos: true }
    })
    return res.json(atualizado)
  } catch (err) {
    if (isZodError(err)) {
      return respostaValidacao(res, err)
    }
    if ((err as any)?.code === 'P2025') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Tutorial não encontrado.' })
    }
    throw err
  }
})

router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    const existente = await prisma.tutorial.findUnique({
      where: { id: req.params.id },
      include: { anexos: true }
    })
    if (!existente) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Tutorial não encontrado.' })
    }

    // anexos somem pelo onDelete: Cascade
    await prisma.tutorial.delete({ where: { id: existente.id } })
    removerDoStorage(existente.anexos.map((a) => a.url)).catch(() => {})

    return res.status(204).send()
  } catch (err) {
    if ((err as any)?.code === 'P2025') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Tutorial não encontrado.' })
    }
    throw err
  }
})

export default router
