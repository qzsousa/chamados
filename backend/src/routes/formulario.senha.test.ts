/**
 * A pergunta de senha esquecida no formulário público.
 *
 * É o destino do botão "esqueci minha senha" da tela de login: quem clica vai
 * para /chamado/novo e precisa chegar na pergunta certa, e não numa lista para
 * escolher.
 *
 * Dois detalhes que estes testes travam:
 *
 *  1. A pergunta só aparece quando a resposta da 1a pergunta é "PortalNet".
 *     `dependsDeOpcao` é o que o portal usa para filtrar (src/utils/formulario.ts
 *     `condicoesDe`), então é o campo que precisa estar certo.
 *
 *  2. O id não pode colidir com 'seed-perg-sist-6' ou '-7'. Esses dois existem
 *     em SEED_FORMULARIO (um para SEI, outro para "Solicitação de acesso") e
 *     NUNCA foram semeados em produção. Reaproveitar o número faria a migration
 *     inserting em cima de uma pergunta de outro assunto, ou o ON CONFLICT
 *     engoliria a inserção silenciosamente — e a pergunta de senha nunca
 *     apareceria, sem erro nenhum.
 */
import { describe, it, expect } from 'vitest'
import { SEED_FORMULARIO } from './formulario'

/** A pergunta de senha, se existir, tanto no seed quanto no banco. */
function perguntasDeSenha(seed = SEED_FORMULARIO) {
  return seed.flatMap((c) => c.perguntas).filter((p) => p.rotulo.toLowerCase().includes('senha'))
}

describe('Pergunta de senha esquecida no formulário público', () => {
  it('existe exatamente uma pergunta de senha no seed', () => {
    const encontradas = perguntasDeSenha()
    expect(encontradas).toHaveLength(1)
  })

  it('é condicional: só aparece quando a resposta for PortalNet', () => {
    const [pergunta] = perguntasDeSenha()
    expect(pergunta.dependeDeOpcao).toBe('PortalNet')
    // Aponta para a pergunta que faz a escolha, senão a condição não tem com
    // que casar e a pergunta nunca aparece.
    expect(pergunta.dependeDePerguntaId).toBeTruthy()
  })

  it('usa um id que não colide com os seeds de SEI e de acesso', () => {
    const [pergunta] = perguntasDeSenha()
    // 'seed-perg-sist-6' e '-7' existem no código para outros assuntos.
    expect(pergunta.id).not.toBe('seed-perg-sist-6')
    expect(pergunta.id).not.toBe('seed-perg-sist-7')
  })

  it('tem id único dentro de toda a categoria', () => {
    const sistemas = SEED_FORMULARIO.find((c) => c.chave === 'sistemas')
    const ids = sistemas!.perguntas.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('pede a descrição do problema em texto longo', () => {
    const [pergunta] = perguntasDeSenha()
    expect(pergunta.tipo).toBe('TEXTO_LONGO')
    expect(pergunta.obrigatoria).toBe(true)
  })

  it('explica o que vai acontecer, em vez de só pedir a senha', () => {
    const [pergunta] = perguntasDeSenha()
    // O texto precisa dizer que a Matriz entrega senha provisória: quem caiu
    // aqui esqueceu a senha e não quer digitar a antiga em nenhum campo.
    expect(pergunta.ajuda).toMatch(/provis/i)
  })

  it('aparece depois das perguntas que já existem, não no meio delas', () => {
    const sistemas = SEED_FORMULARIO.find((c) => c.chave === 'sistemas')
    const [senha] = perguntasDeSenha()
    const ordens = sistemas!.perguntas.filter((p) => p.id !== senha.id).map((p) => p.ordem)
    expect(senha.ordem).toBeGreaterThan(Math.max(...ordens))
  })
})