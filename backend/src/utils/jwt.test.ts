/**
 * O refresh token precisa ser único por emissão, mesmo quando duas emissões
 * acontecem no mesmo segundo.
 *
 * Sem o `jti`, o payload do refresh é `{ sub, type }` e o `iat` que o
 * jsonwebtoken acrescenta tem precisão de SEGUNDO. Duas emissões do mesmo
 * usuário dentro do mesmo segundo produziam tokens byte a byte idênticos, e como
 * `RefreshToken.tokenHash` é `@unique`, a segunda caía em P2002 e virava 409.
 *
 * O efeito visível: quem clicasse duas vezes em "Entrar" recebia
 * "tokenHash já existe" em vez de entrar.
 *
 * O teste compara o que realmente colide — o hash — e não só a string do token.
 * E repete muitas vezes, porque o defeito é uma colisão de segundo: uma amostra
 * única pode cair em segundos diferentes e passar por sorte.
 */
import { describe, it, expect } from 'vitest'
import { signRefreshToken, verifyRefreshToken, hashToken } from './jwt'

describe('signRefreshToken', () => {
  it('nunca repete o token no mesmo segundo (500 emissões)', () => {
    const hashes: string[] = []

    for (let i = 0; i < 500; i++) {
      // O que colide no banco é o hash, não o token.
      hashes.push(hashToken(signRefreshToken('user-1')))
    }

    const distintos = new Set(hashes).size
    expect(distintos, `hashes repetidos: ${500 - distintos}`).toBe(500)
  })

  it('leva um jti e ele difere entre emissões', () => {
    const a = signRefreshToken('user-1')
    const b = signRefreshToken('user-1')

    expect(a).not.toBe(b)

    const payloadA = verifyRefreshToken(a)
    const payloadB = verifyRefreshToken(b)

    expect(payloadA).not.toBeNull()
    expect(payloadA!.jti).toBeTruthy()
    expect(payloadA!.jti).not.toBe(payloadB!.jti)
  })

  it('preserva o que a verificação usa: sub, type e validade', () => {
    const token = signRefreshToken('user-42')
    const payload = verifyRefreshToken(token)

    expect(payload).not.toBeNull()
    expect(payload!.sub).toBe('user-42')
    expect(payload!.type).toBe('refresh')
    // `exp` continua no futuro — o refresh ainda é um token válido.
    expect(payload!.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('não confunde usuário com usuário', () => {
    const a = hashToken(signRefreshToken('user-1'))
    const b = hashToken(signRefreshToken('user-2'))

    expect(a).not.toBe(b)
  })
})