// ==========================================
// Parser do relatório exportado pelo pingInfoView (.txt)
//
// Funções puras: nada de banco, nada de express, nada de rede. O serviço
// de importação (T-002) e a futura leitura dependem apenas do que sai daqui.
//
// O pingInfoView grava o arquivo em UTF-16 LE com BOM, e no Windows o
// caminho é frágil (BOM, CRLF, LF, caractere "tempo" em latino). Por isso
// `decodificar` é isolado: toda a lógica de bytes fica fora do parser de
// texto, que nunca precisa saber em qual encoding o relatório chegou.
// ==========================================

const DESCRICAO_DVR = /^VIDEO-DVR([123])\s+(ADM|PED)$/
const IP_V4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

export type TipoDvr = 'ADM' | 'PED'
export type StatusPing = 'online' | 'offline' | 'desconhecido'

export interface RegistroPing {
  /** Endereço IP do DVR no manifesto (chave de junção). */
  ip: string
  /** VIDEO-DVR1 / VIDEO-DVR2 / VIDEO-DVR3. */
  hostname: string
  tipo: string
  /** Resultado do ping naquele momento. */
  status: StatusPing
  latenciaMs: number | null
  ttl: number | null
  /** Posição do DVR na execução do pingInfoView (polemicamente chamada "Order"). */
  ordem: number | null
  /** Quando o DVR respondeu (ou falhou), em hora local do servidor. */
  observacaoEm: Date | null
  /** Alertas de validação deste bloco (vínculo de school, IP inválido, etc.). */
  alertas: string[]
}

export interface RelatorioPing {
  total: number
  online: number
  offline: number
  desconhecido: number
  registros: RegistroPing[]
  alertas: string[]
}

export interface ManifestoDvr {
  ip: string
  hostname: string
  tipo: string
}

export interface ManifestoGrupo {
  escola: string
  dvrs: ManifestoDvr[]
}

export interface ManifestoGrupos {
  escolas: ManifestoGrupo[]
}

/**
 * Decodifica os bytes exportados pelo pingInfoView para texto.
 *
 * A ordem dos testes é intencional:
 *   1. BOM explícito (UTF-16 LE/BE, UTF-8) tem precedência porque é o único
 *      sinal confiável de encoding. O pingInfoView atual grava com BOM LE.
 *   2. Quando não há BOM mas há bytes nulos nas posições pares, é UTF-16 LE
 *      sem BOM (comum em exportadores mais antigos) — decodificar como UTF-8
 *      produziria texto intercalado com '\u0000', que é pior que não ter painel.
 *   3. Caso contrário, assumo UTF-8 (o mais comum hoje).
 */
export function decodificar(bytes: Buffer): string {
  const n = bytes.length
  if (n === 0) return ''

  // BOM UTF-16 LE
  if (n >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return bytes.toString('utf16le', 2)
  }
  // BOM UTF-16 BE
  if (n >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const buf = bytes.subarray(2)
    const words = new Uint16Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 2))
    let out = ''
    for (let i = 0; i < words.length; i++) {
      const w = words[i]
      const be = ((w >> 8) & 0xff) | ((w & 0xff) << 8)
      out += String.fromCharCode(be)
    }
    return out
  }
  // BOM UTF-8
  if (n >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return bytes.toString('utf8', 3)
  }

  // Heurística: muitos bytes nulos nas posições pares → UTF-16 LE sem BOM.
  if (n % 2 === 0) {
    let nulosPosicoesImpares = 0
    const pares = n / 2
    for (let i = 0; i < n; i += 2) {
      if (bytes[i + 1] === 0x00) nulosPosicoesImpares++
    }
    if (pares > 0 && nulosPosicoesImpares / pares >= 0.5) {
      return bytes.toString('utf16le')
    }
  }

  return bytes.toString('utf8')
}

function numeroOuNull(v: string): number | null {
  const n = Number(String(v).replace(',', '.').trim())
  return Number.isFinite(n) ? n : null
}

function parseDataBr(s: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(s.trim())
  if (!m) return null
  const [, dd, mm, aaaa, hh, mi, ss] = m
  // No fuso do SERVIDOR: `new Date(a,m,d,h,...)` interpreta local, o que é
  // o que se quer — o relatório não carrega timezone e a equipe local lê no
  // mesmo fuso em que o observador operou.
  return new Date(
    Number(aaaa), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss),
  )
}

function validarIp(ip: string): boolean {
  const m = IP_V4.exec(ip)
  if (!m) return false
  return [m[1], m[2], m[3], m[4]].every((n) => Number(n) >= 0 && Number(n) <= 255)
}

interface CamposBloco { [k: string]: string }

function extrairCampos(bloco: string): CamposBloco {
  const out: CamposBloco = {}
  // Chaves permitidas no formato "Last Ping Status": letras, espaços e dígitos;
  // evita capturar uma linha de log acidental.
  for (const linha of bloco.split(/\r?\n/)) {
    const m = /^([A-Za-z][A-Za-z 0-9]*?)\s*:\s?(.*)$/.exec(linha)
    if (m) {
      const chave = m[1].trim().replace(/\s+/g, ' ')
      out[chave] = m[2].trim()
    }
  }
  return out
}

function dividirEmBlocos(texto: string): string[] {
  const blocos: string[] = []
  let atual: string[] = []
  for (const linha of texto.split(/\r?\n/)) {
    if (/^=+$/.test(linha.trim())) {
      if (atual.length > 0 && atual.some((l) => l.trim().length > 0)) {
        blocos.push(atual.join('\n'))
      }
      atual = []
    } else {
      atual.push(linha)
    }
  }
  if (
    atual.some((l) => l.trim().length > 0) &&
    atual.some((l) => /IP Address:/i.test(l))
  ) {
    blocos.push(atual.join('\n'))
  }
  return blocos
}

/**
 * Faz o parse de um relatório completo.
 *
 * Um bloco é inválido quando falta IP ou o IP é inválido, ou a Description
 * não é `VIDEO-DVRN ADM/PED`. Mesmo assim ele entra na lista de registros
 * com o que foi possível ler, e a lista de alertas do bloco descreve o quê
 * impediu a leitura confiável. Nenhuma exceção é lançada: a função devolve
 * tudo o que conseguiu, e o chamador decide o que fazer.
 */
export function parseRelatorio(texto: string): RelatorioPing {
  const blocos = dividirEmBlocos(texto)
  const registros: RegistroPing[] = []
  const alertasGerais: string[] = []

  let online = 0
  let offline = 0
  let desconhecido = 0

  blocos.forEach((bloco, idx) => {
    const c = extrairCampos(bloco)
    const blocoAlertas: string[] = []

    const ip = (c['IP Address'] || '').trim()
    if (!ip) {
      blocoAlertas.push('bloco sem campo IP Address')
      registros.push({
        ip: '',
        hostname: '',
        tipo: '',
        status: 'desconhecido',
        latenciaMs: null,
        ttl: null,
        ordem: null,
        observacaoEm: null,
        alertas: blocoAlertas,
      })
      desconhecido++
      return
    }
    if (!validarIp(ip)) {
      blocoAlertas.push(`IP inválido: ${ip}`)
    }

    const descricao = (c['Description'] || '').trim()
    // hostname e tipo nessa fase vêm da Description (`VIDEO-DVR2 ADM`). Se
    // não casar, o bloco fica inutilizável para vínculo com o manifesto —
    // o relatório só carrega hostname/tipo aí dentro.
    let hostname = ''
    let tipo = ''
    const md = DESCRICAO_DVR.exec(descricao)
    if (!md) {
      if (descricao) blocoAlertas.push(`Description inválida: ${descricao}`)
      else blocoAlertas.push('bloco sem Description')
    } else {
      hostname = `VIDEO-DVR${md[1]}`
      tipo = md[2]
    }

    // Status: Succeeded → online, Request Timeout → offline. Qualquer outra
    // coisa é "desconhecido" + alerta — não vou adivinhar o estado.
    const rawStatus = c['Last Ping Status'] || ''
    let status: StatusPing = 'desconhecido'
    if (/^succeed(ed)?$/i.test(rawStatus)) status = 'online'
    else if (/request timeout/i.test(rawStatus) || /^timeout$/i.test(rawStatus)) status = 'offline'
    else if (rawStatus) {
      blocoAlertas.push(`Last Ping Status desconhecido: ${rawStatus}`)
    } else {
      blocoAlertas.push('bloco sem Last Ping Status')
    }

    if (status === 'online') online++
    else if (status === 'offline') offline++
    else desconhecido++

    let ordem: number | null = null
    const rawOrder = c['Order']
    if (rawOrder) {
      const o = Number(rawOrder)
      if (Number.isFinite(o)) ordem = o
      else blocoAlertas.push(`Order inválido: ${rawOrder}`)
    }

    let latenciaMs: number | null = null
    const rawLat = c['Last Ping Time']
    if (rawLat) {
      const l = numeroOuNull(rawLat)
      if (l === null) blocoAlertas.push(`Last Ping Time inválido: ${rawLat}`)
      else latenciaMs = l
    }
    const rawTtl = c['Last Ping TTL']
    const ttl: number | null = rawTtl ? numeroOuNull(rawTtl) : null

    const succeedOn = c['Last Succeed On'] || ''
    const failedOn = c['Last Failed On'] || ''
    const observacaoEm = succeedOn ? parseDataBr(succeedOn) : (failedOn ? parseDataBr(failedOn) : null)
    if (succeedOn || failedOn) {
      if (!observacaoEm) {
        blocoAlertas.push(`data de observação inválida: ${succeedOn || failedOn}`)
      }
    }

    if (blocoAlertas.length > 0) {
      alertasGerais.push(`bloco ${idx + 1}: ${blocoAlertas.join('; ')}`)
    }

    registros.push({
      ip,
      hostname,
      tipo,
      status,
      latenciaMs,
      ttl,
      ordem,
      observacaoEm,
      alertas: blocoAlertas,
    })
  })

  return {
    total: registros.length,
    online,
    offline,
    desconhecido,
    registros,
    alertas: alertasGerais,
  }
}

/**
 * Lê o manifesto "old-style" do pingInfoView (`Group: NOME` seguido de
 * `IP HOSTNAME TIPO`). Devolve uma escola por grupo, preservando a ordem
 * em que elas aparecem.
 */
export function parseManifestoGrupos(texto: string): ManifestoGrupos {
  const escolas: ManifestoGrupo[] = []
  let atual: ManifestoGrupo | null = null

  for (const linhaRaw of texto.split(/\r?\n/)) {
    const linha = linhaRaw.trim()
    if (!linha) continue
    if (linha.startsWith('Group:')) {
      atual = { escola: linha.replace(/^Group:\s*/, '').trim(), dvrs: [] }
      escolas.push(atual)
      continue
    }
    const partes = linha.split(/\s+/)
    if (partes.length >= 3 && validarIp(partes[0]) && /^VIDEO-DVR[123]$/.test(partes[1]) && /^(ADM|PED)$/.test(partes[2])) {
      if (!atual) continue
      atual.dvrs.push({ ip: partes[0], hostname: partes[1], tipo: partes[2] })
    }
  }

  // Escolas sem DVR (bloco vazio) ficam com dvrs:[], o que é correto — não
  // descarto a escola só porque o grupo está mal-formado.
  return { escolas }
}

/** Auxiliar para detectar formato "old-style" a partir dos bytes. */
export function éManifesto(texto: string): boolean {
  return /^Group:/m.test(texto) && /^\d+\.\d+\.\d+\.\d+\s+VIDEO-DVR[123]\s+(ADM|PED)\s*$/m.test(texto)
}
