import { Router } from 'express'
import { ZodError } from 'zod'
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

/**
 * Os schemas vêm do pacote linkado @shared/api, que traz sua própria cópia do
 * zod — `instanceof ZodError` falha entre as duas cópias. Checar também o
 * nome da classe. (Mantém o mesmo response shape das demais rotas.)
 */
function isZodError(err: unknown): err is ZodError {
  return err instanceof ZodError || (err as any)?.name === 'ZodError'
}

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
