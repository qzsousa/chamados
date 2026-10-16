import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import { decodificar, parseRelatorio, parseManifestoGrupos } from './pingInfoView'

function blocoMinimo(overrides: Record<string, string> = {}): string {
  const base: Record<string, string> = {
    Description: 'VIDEO-DVR1 ADM',
    'Host Name': '10.0.0.1',
    'IP Address': '10.0.0.1',
    'Reply IP Address': '10.0.0.1',
    'Succeed Count': '1',
    'Failed Count': '0',
    'Consecutive Failed Count': '',
    'Max Consecutive Failed Count': '',
    'Max Consecutive Failed Time': '',
    '% Failed': '0%',
    'Total Sent Pings': '1',
    'Last Ping Status': 'Succeeded',
    'Last Ping Time': '2.934',
    'Last Ping TTL': '58',
    'Average Ping Time': '2.934',
    'Last Succeed On': '16/10/2026 14:41:15',
    'Last Failed On': '',
    'Minimum Ping Time': '2.934',
    'Maximum Ping Time': '2.934',
    Order: '1',
    Disabled: 'No',
  }
  const merged = { ...base, ...overrides }
  const lines = Object.entries(merged).map(([k, v]) => (k.padEnd(20) + ' : ' + v))
  const iguais = '='.repeat(50)
  return iguais + '\n' + lines.join('\n') + '\n' + iguais
}

describe('decodificar', () => {
  it('BOM UTF-16 LE', () => {
    const bytes = Buffer.from('ola mundo', 'utf16le')
    const out = Buffer.alloc(2 + bytes.length)
    out[0] = 0xff
    out[1] = 0xfe
    bytes.copy(out, 2)
    expect(decodificar(out)).toBe('ola mundo')
  })
  it('BOM UTF-16 BE', () => {
    const body = Buffer.from('ola mundo', 'utf16le')
    const be = Buffer.alloc(body.length)
    for (let i = 0; i < body.length; i += 2) {
      be[i] = body[i + 1]
      be[i + 1] = body[i]
    }
    const out = Buffer.alloc(2 + be.length)
    out[0] = 0xfe
    out[1] = 0xff
    be.copy(out, 2)
    expect(decodificar(out)).toBe('ola mundo')
  })
  it('BOM UTF-8', () => {
    const body = Buffer.from('ola mundo', 'utf8')
    const out = Buffer.alloc(3 + body.length)
    out[0] = 0xef
    out[1] = 0xbb
    out[2] = 0xbf
    body.copy(out, 3)
    expect(decodificar(out)).toBe('ola mundo')
  })
  it('UTF-16 LE sem BOM detectado por NUL intercalado', () => {
    const bytes = Buffer.from('ola', 'utf16le')
    expect(decodificar(bytes)).toBe('ola')
  })
  it('UTF-8 sem BOM', () => {
    expect(decodificar(Buffer.from('ola mundo', 'utf8'))).toBe('ola mundo')
  })
  it('vazio', () => {
    expect(decodificar(Buffer.alloc(0))).toBe('')
  })
})

describe('parseRelatorio - basico', () => {
  it('um DVR online', () => {
    const r = parseRelatorio(blocoMinimo())
    expect(r.total).toBe(1)
    expect(r.online).toBe(1)
    expect(r.offline).toBe(0)
    expect(r.registros[0].ip).toBe('10.0.0.1')
    expect(r.registros[0].hostname).toBe('VIDEO-DVR1')
    expect(r.registros[0].tipo).toBe('ADM')
    expect(r.registros[0].status).toBe('online')
    expect(r.registros[0].latenciaMs).toBe(2.934)
    expect(r.registros[0].ttl).toBe(58)
    expect(r.registros[0].ordem).toBe(1)
    expect(r.registros[0].observacaoEm).toBeInstanceOf(Date)
    expect(r.alertas).toHaveLength(0)
  })
  it('offline', () => {
    const r = parseRelatorio(blocoMinimo({
      'Last Ping Status': 'Request Timeout',
      'Last Ping Time': '',
      'Last Ping TTL': '',
      'Last Succeed On': '',
      'Last Failed On': '16/10/2026 14:41:16',
    }))
    expect(r.offline).toBe(1)
    expect(r.registros[0].status).toBe('offline')
    expect(r.registros[0].latenciaMs).toBeNull()
    expect(r.registros[0].observacaoEm).toBeInstanceOf(Date)
  })
  it('status desconhecido vira alerta', () => {
    const r = parseRelatorio(blocoMinimo({ 'Last Ping Status': 'Random' }))
    expect(r.desconhecido).toBe(1)
    expect(r.registros[0].alertas.join(' ')).toContain('desconhecido')
  })
  it('IP inválido vira alerta', () => {
    const r = parseRelatorio(blocoMinimo({ 'IP Address': '999.0.0.1' }))
    expect(r.registros[0].alertas.join(' ')).toContain('IP inválido')
  })
  it('Description inválida vira alerta', () => {
    const r = parseRelatorio(blocoMinimo({ Description: 'CAMERA-9 XYZ' }))
    expect(r.registros[0].alertas.join(' ')).toContain('Description inválida')
    expect(r.registros[0].hostname).toBe('')
  })
  it('bloco sem IP Address vira registro com alerta', () => {
    const bloco = blocoMinimo().replace(/IP Address.*/, 'IP Address  : ')
    const r = parseRelatorio(bloco)
    expect(r.registros[0].ip).toBe('')
    expect(r.registros[0].alertas.join(' ')).toContain('sem campo IP Address')
  })
})

describe('parseRelatorio - tolerância', () => {
  it('três blocos em sequência', () => {
    const r = parseRelatorio(
      blocoMinimo() + '\n' + blocoMinimo({ 'IP Address': '10.0.0.2', 'Host Name': '10.0.0.2', 'Order': '2', 'Last Ping Status': 'Request Timeout', 'Last Failed On': '16/10/2026 14:41:20', 'Last Succeed On': '' })
    )
    expect(r.total).toBe(2)
  })
  it('CRLF', () => {
    const r = parseRelatorio(blocoMinimo().replace(/\n/g, '\r\n'))
    expect(r.total).toBe(1)
  })
  it('truncado no meio do segundo bloco', () => {
    const r = parseRelatorio(blocoMinimo() + '\n==================================================\nDescription       : VIDEO-DVR2 ADM\n')
    expect(r.total).toBe(1)
  })
})

describe('parseRelatorio - arquivo real', () => {
  const candidatos = [
    'C:/Users/ESPABL~1.SOU/AppData/Local/Temp/opencode/ping-relatorio-real.txt',
    'C:/Users/es.pablo.sousa/Desktop/portal-ure/ping_16102026.txt',
  ]
  const caminho = candidatos.find((p) => fs.existsSync(p))
  it.skipIf(!caminho)('totals 432 / 117 / 315', () => {
    const bytes = fs.readFileSync(caminho as string)
    const texto = decodificar(bytes)
    const r = parseRelatorio(texto)
    expect(r.total).toBe(432)
    expect(r.online).toBe(117)
    expect(r.offline).toBe(315)
    expect(r.desconhecido).toBe(0)
    expect(r.alertas).toHaveLength(0)
  })
  it.skipIf(!caminho)('posicao == Order', () => {
    const bytes = fs.readFileSync(caminho as string)
    const r = parseRelatorio(decodificar(bytes))
    r.registros.forEach((reg, i) => {
      expect(reg.ordem).toBe(i + 1)
    })
  })
})

describe('parseManifestoGrupos', () => {
  const MANIFESTO = [
    'Group: E.E. FOO',
    '10.0.0.10 VIDEO-DVR1 ADM',
    '10.0.0.11 VIDEO-DVR2 ADM',
    '10.0.0.20 VIDEO-DVR1 PED',
    '',
    'Group: E.E. BAR',
    '10.1.0.1 VIDEO-DVR3 PED',
  ].join('\n')
  it('preserva ordem das escolas e ips', () => {
    const m = parseManifestoGrupos(MANIFESTO)
    expect(m.escolas).toHaveLength(2)
    expect(m.escolas[0].escola).toBe('E.E. FOO')
    expect(m.escolas[0].dvrs).toHaveLength(3)
    expect(m.escolas[1].dvrs[0].ip).toBe('10.1.0.1')
  })
  it('escola sem DVR fica vazia', () => {
    const m = parseManifestoGrupos('Group: E.E. VAZIA\n')
    expect(m.escolas).toHaveLength(1)
    expect(m.escolas[0].dvrs).toHaveLength(0)
  })
  it('formato antigo mantem saida compativel', () => {
    const m = parseManifestoGrupos('Group: E.E. X\n10.0.0.1 VIDEO-DVR1 ADM\n')
    expect(m.escolas[0].dvrs[0]).toMatchObject({ ip: '10.0.0.1', hostname: 'VIDEO-DVR1', tipo: 'ADM' })
  })
})
