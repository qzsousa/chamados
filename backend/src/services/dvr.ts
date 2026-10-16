import { prisma } from '../config/prisma'
import { parseRelatorio, decodificar } from './pingInfoView'
import { gerarChavesInventario } from './normalization'
import { filtroUnidadesDoUsuario } from './unidades'

export interface ResumoImportacao {
  id: string
  arquivo: string
  importadoEm: string
  importadoPor: string | null
  total: number
  online: number
  offline: number
  desconhecido: number
  naoCorrespondidos: string[]
  observadoEm: string | null
}

interface EscolaResumoOut {
  id: string
  rotulo: string
  escolaId: string
  total: number
  online: number
  offline: number
  desconhecido: number
  adm: { online: number; offline: number }
  ped: { online: number; offline: number }
}

interface HostOut {
  ip: string
  hostname: string
  tipo: string
  faixa: string
  escola: string
  escolaId: string
  portas: number[]
  status: string
  metodo: string | null
  latenciaMs: number | null
  ttl: number | null
  verificadoEm: number | null
  onlineDesde: number | null
  offlineDesde: number | null
  alternancias: number
  historico: string
}

interface Retrato {
  geradoEm?: number
  observacaoEm?: number
  total: number
  online: number
  offline: number
  desconhecido: number
  caidosAgora: number
  percentualOnline: number
  latenciaMediaMs: number | null
  latenciaMaximaMs: number | null
  porFaixa: EscolaResumoOut[]
  emAndamento: boolean
  ultimaVarreduraEm: number | null
  proximaVarreduraEm: number | null
  duracaoVarreduraMs: number | null
  intervaloSegundos: number
  totalVarreduras: number
  concorrencia: number
  timeoutPingMs: number
  configEm?: string
  importacao?: { id: string; arquivo: string; importadoEm: string } | null
  hosts: HostOut[]
}

export async function importarRelatorioDvr(
  arquivo: string,
  conteudoBase64: string,
  login?: string,
): Promise<ResumoImportacao> {
  const bytes = Buffer.from(conteudoBase64, 'base64')
  const texto = decodificar(bytes)
  const relat = parseRelatorio(texto)

  const hostsExistentes = await prisma.dvrHost.findMany({ select: { ip: true } })
  const ipsConhecidos = new Set(hostsExistentes.map((h) => h.ip))

  const escolas = await prisma.escola.findMany({ select: { id: true, nome: true } })
  const indiceEscola = new Map<string, string>()
  for (const e of escolas) {
    for (const chave of gerarChavesInventario(e.nome)) {
      if (!indiceEscola.has(chave)) indiceEscola.set(chave, e.id)
    }
  }
  function resolverEscolaId(nomeManifesto: string): string | null {
    if (!nomeManifesto) return null
    for (const chave of gerarChavesInventario(nomeManifesto)) {
      const id = indiceEscola.get(chave)
      if (id) return id
    }
    return null
  }

  const desconhecido = relat.desconhecido
  const observadoEm = relat.registros
    .map((r) => r.observacaoEm)
    .reduce<Date | null>((acc, cur) => (cur && (!acc || cur > acc) ? cur : acc), null)

  const naoCorrespondidos = relat.registros
    .map((r) => r.ip)
    .filter((ip) => ip && !ipsConhecidos.has(ip))
    .filter((ip, i, arr) => arr.indexOf(ip) === i)

  const result = await prisma.$transaction(async (tx) => {
    for (const r of relat.registros) {
      if (!r.ip) continue
      await tx.dvrHost.upsert({
        where: { ip: r.ip },
        create: {
          ip: r.ip,
          hostname: r.hostname || 'VIDEO-DVR?',
          tipo: r.tipo || 'ADM',
          ordem: r.ordem,
        },
        update: {
          ...(r.hostname ? { hostname: r.hostname } : {}),
          ...(r.tipo ? { tipo: r.tipo } : {}),
          ...(r.ordem ? { ordem: r.ordem } : {}),
        },
      })
    }

    const imp = await tx.dvrImportacao.create({
      data: {
        arquivo,
        importadoPor: login || null,
        total: relat.registros.length,
        online: relat.online,
        offline: relat.offline,
        desconhecido,
        naoCorrespondidos,
        observadoEm: observadoEm || null,
      },
    })

    if (relat.registros.some((r) => r.ip)) {
      await tx.dvrAmostra.createMany({
        data: relat.registros
          .filter((r) => r.ip)
          .map((r) => ({
            ip: r.ip,
            importacaoId: imp.id,
            status: r.status,
            latenciaMs: r.latenciaMs,
            ttl: r.ttl,
            ordem: r.ordem,
          })),
        skipDuplicates: true,
      })
    }
    return imp
  }, { timeout: 60000 })

  return {
    id: result.id,
    arquivo: result.arquivo,
    importadoEm: result.importadoEm.toISOString(),
    importadoPor: result.importadoPor,
    total: result.total,
    online: result.online,
    offline: result.offline,
    desconhecido: result.desconhecido,
    naoCorrespondidos: result.naoCorrespondidos,
    observadoEm: result.observadoEm ? result.observadoEm.toISOString() : null,
  }
}

export async function obterRetratoDvr(unidadeFiltro?: string, options: { escopoNomes?: string[] } = {}): Promise<Retrato> {
  const latest = await prisma.dvrImportacao.findFirst({
    orderBy: { importadoEm: 'desc' },
  })
  const previous = latest
    ? await prisma.dvrImportacao.findFirst({
        where: { importadoEm: { lt: latest.importadoEm } },
        orderBy: { importadoEm: 'desc' },
      })
    : null

  // Historico: ultimas N importacoes (mais antigas -> mais recentes).
  const N_HIST = 30
  const recentesDesc = await prisma.dvrImportacao.findMany({
    orderBy: { importadoEm: 'desc' },
    take: N_HIST,
  })
  const recentes = recentesDesc.slice().reverse()
  const recentesIds = recentes.map((i) => i.id)

  const allHosts = await prisma.dvrHost.findMany({
    include: { escola: true },
    orderBy: [{ escolaNome: 'asc' }, { ip: 'asc' }],
  })

  const amostrasLatest = latest
    ? await prisma.dvrAmostra.findMany({ where: { importacaoId: latest.id } })
    : []
  const amostrasPrev = previous
    ? await prisma.dvrAmostra.findMany({ where: { importacaoId: previous.id } })
    : []
  const mapaLatest = new Map(amostrasLatest.map((a) => [a.ip, a]))
  const mapaPrev = new Map(amostrasPrev.map((a) => [a.ip, a]))

  const amostrasHistorico = recentesIds.length
    ? await prisma.dvrAmostra.findMany({ where: { importacaoId: { in: recentesIds } } })
    : []
  const mapaHistPorIp = new Map<string, Map<string, string>>()
  for (const a of amostrasHistorico) {
    if (!mapaHistPorIp.has(a.ip)) mapaHistPorIp.set(a.ip, new Map())
    mapaHistPorIp.get(a.ip)!.set(a.importacaoId, a.status)
  }

  // Escopo por unidade (TECNICO).
  let permitidos: Set<string> | null = null
  if (options.escopoNomes && options.escopoNomes.length) {
    const frag = filtroUnidadesDoUsuario(options.escopoNomes.join(','))
    const filtroOr = (frag as any).OR as Array<{ unidade: { contains: string; mode: string } }>
    // Convertemos para match manual: para cada host, escolaNome deve satisfazer.
    permitidos = null // marcador: usa matchEscola abaixo
  }
  function atendeUnidade(escolaNome: string): boolean {
    if (!options.escopoNomes || options.escopoNomes.length === 0) return true
    const frag = filtroUnidadesDoUsuario(options.escopoNomes.join(','))
    const lista = (frag as any).OR as Array<{ unidade: { contains: string; mode: string } }>
    const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    return lista.some((clause) => norm(escolaNome).includes(norm(clause.unidade.contains)))
  }

  const hosts: HostOut[] = []
  let online = 0
  let offline = 0
  let desconhecido = 0
  let caidosAgora = 0
  let somaLat = 0
  let nLat = 0
  let maxLat = 0
  const porEscolaMap = new Map<string, EscolaResumoOut>()

  for (const h of allHosts) {
    const escolaNome = h.escola?.nome || h.escolaNome || ''
    if (!atendeUnidade(escolaNome)) continue

    const a = latest ? mapaLatest.get(h.ip) : undefined
    const status = a ? a.status : 'desconhecido'
    if (status === 'online') online++
    else if (status === 'offline') offline++
    else desconhecido++

    if (a && a.latenciaMs != null) {
      somaLat += a.latenciaMs
      nLat++
      if (a.latenciaMs > maxLat) maxLat = a.latenciaMs
    }

    const prev = previous ? mapaPrev.get(h.ip) : undefined
    if (prev && prev.status === 'online' && status === 'offline') caidosAgora++

    // alternancias: contagem de transicoes entre imports consecutivos
    const serie = recentes.map((imp) => {
      const st = (mapaHistPorIp.get(h.ip) || new Map()).get(imp.id)
      return st === 'online' ? '1' : (st ? '0' : '')
    })
    const historicoBase = serie.filter((c) => c !== '').join('')
    const historico = (historicoBase.length > N_HIST ? historicoBase.slice(-N_HIST) : historicoBase) || ''
    let alt = 0
    for (let i = 1; i < historico.length; i++) {
      if (historico[i] !== historico[i - 1]) alt++
    }

    const faixa = h.escola?.id || h.escolaNome || ''
    const escolaId = h.escola?.id || h.escolaId || ''
    hosts.push({
      ip: h.ip,
      hostname: h.hostname,
      tipo: h.tipo as string,
      faixa,
      escola: escolaNome,
      escolaId,
      portas: [],
      status,
      metodo: latest ? 'importado' : null,
      latenciaMs: a ? a.latenciaMs : null,
      ttl: a ? a.ttl : null,
      verificadoEm: latest ? latest.importadoEm.getTime() : null,
      onlineDesde: null,
      offlineDesde: null,
      alternancias: alt,
      historico,
    })

    // porFaixa
    const chaveEsc = escolaId || escolaNome || h.ip
    if (!porEscolaMap.has(chaveEsc)) {
      porEscolaMap.set(chaveEsc, {
        id: chaveEsc,
        rotulo: escolaNome || chaveEsc,
        escolaId,
        total: 0,
        online: 0,
        offline: 0,
        desconhecido: 0,
        adm: { online: 0, offline: 0 },
        ped: { online: 0, offline: 0 },
      })
    }
    const resumo = porEscolaMap.get(chaveEsc)!
    resumo.total++
    if (status === 'online') resumo.online++
    else if (status === 'offline') resumo.offline++
    else resumo.desconhecido++
    const bucket = h.tipo === 'PED' ? resumo.ped : resumo.adm
    if (status === 'online') bucket.online++
    else if (status === 'offline') bucket.offline++
  }

  const total = hosts.length
  return {
    geradoEm: Date.now(),
    observacaoEm: latest ? latest.importadoEm.getTime() : undefined,
    total,
    online,
    offline,
    desconhecido,
    caidosAgora,
    percentualOnline: total > 0 ? Math.round((online / total) * 10000) / 100 : 0,
    latenciaMediaMs: nLat > 0 ? Math.round((somaLat / nLat) * 100) / 100 : null,
    latenciaMaximaMs: maxLat > 0 ? maxLat : null,
    porFaixa: [...porEscolaMap.values()],
    emAndamento: false,
    ultimaVarreduraEm: latest ? latest.importadoEm.getTime() : null,
    proximaVarreduraEm: null,
    duracaoVarreduraMs: null,
    intervaloSegundos: 0,
    totalVarreduras: await prisma.dvrImportacao.count(),
    concorrencia: 0,
    timeoutPingMs: 0,
    configEm: latest ? latest.importadoEm.toISOString() : undefined,
    importacao: latest
      ? { id: latest.id, arquivo: latest.arquivo, importadoEm: latest.importadoEm.toISOString() }
      : null,
    hosts,
  }
}

export async function listarImportacoesDvr(limite: number): Promise<ResumoImportacao[]> {
  const rows = await prisma.dvrImportacao.findMany({
    orderBy: { importadoEm: 'desc' },
    take: Math.max(1, Math.min(limite || 30, 100)),
  })
  return rows.map((r) => ({
    id: r.id,
    arquivo: r.arquivo,
    importadoEm: r.importadoEm.toISOString(),
    importadoPor: r.importadoPor,
    total: r.total,
    online: r.online,
    offline: r.offline,
    desconhecido: r.desconhecido,
    naoCorrespondidos: r.naoCorrespondidos,
    observadoEm: r.observadoEm ? r.observadoEm.toISOString() : null,
  }))
}
