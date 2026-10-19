/**
 * O `tipo` do chamado é montado pelo servidor, com o nome da categoria que está
 * no banco.
 *
 * Antes ele vinha do cliente, e o `FormsView.vue` que está no ar montava
 * `'Sistema - ' + rotulo` com o nome fixo no código. Quando a categoria foi
 * renomeada de "Sistema" para "Sistemas", o formulário continuou gravando o
 * nome velho — 79 chamados ficaram fora do escopo de quem deveria atendê-los,
 * sem erro e sem aviso, só a lista vazia.
 *
 * O teste pega a regressão que importa: um cliente que manda o nome velho tem o
 * `tipo` corrigido pelo servidor.
 */
import { describe, it, expect } from 'vitest'
import { derivarTipo, type CategoriaAvaliavel, type RespostaAceita } from './formulario'

const SISTEMAS: CategoriaAvaliavel = {
  chave: 'sistemas',
  nome: 'Sistemas',
  perguntas: [
    { id: 'p1', rotulo: 'Qual sistema?', tipo: 'OPCOES', obrigatoria: true },
    { id: 'p2', rotulo: 'Detalhe', tipo: 'TEXTO', obrigatoria: false },
    { id: 'p3', rotulo: 'Anexo', tipo: 'ARQUIVO', obrigatoria: false },
  ],
}

const resposta = (perguntaId: string, r: string): RespostaAceita => ({
  perguntaId,
  rotulo: 'x',
  resposta: r,
})

describe('derivarTipo', () => {
  it('usa o nome da CATEGORIA, não o que o cliente mandou', () => {
    const tipo = derivarTipo(SISTEMAS, [resposta('p1', 'PortalNet')])
    // O ponto do teste: "Sistemas", o nome atual. Se voltar "Sistema" aqui, o
    // defeito voltou.
    expect(tipo).toBe('Sistemas - PortalNet')
  })

  it('a 1ª pergunta de OPCOES define o tipo, mesmo respondo outras antes', () => {
    const tipo = derivarTipo(SISTEMAS, [resposta('p2', 'texto qualquer'), resposta('p1', 'SEI')])
    expect(tipo).toBe('Sistemas - SEI')
  })

  it('categoria sem resposta de OPCOES fica só com o nome', () => {
    // A 1ª pergunta do E-mail institucional é o CIE da escola, não uma opção.
    const email: CategoriaAvaliavel = {
      chave: 'email',
      nome: 'E-mail institucional',
      perguntas: [{ id: 'c1', rotulo: 'CIE', tipo: 'TEXTO', obrigatoria: true }],
    }
    expect(derivarTipo(email, [resposta('c1', '123456')])).toBe('E-mail institucional')
  })

  it('ignora pergunta desativada e pergunta sem resposta', () => {
    const categoria: CategoriaAvaliavel = {
      chave: 'sistemas',
      nome: 'Sistemas',
      perguntas: [
        { id: 'p0', rotulo: 'Antiga', tipo: 'OPCOES', obrigatoria: false, ativa: false },
        { id: 'p1', rotulo: 'Qual sistema?', tipo: 'OPCOES', obrigatoria: true },
      ],
    }
    expect(derivarTipo(categoria, [resposta('p1', 'PortalNet')])).toBe('Sistemas - PortalNet')
  })

  it('devolve null quando não há nome — o chamador decide o fallback', () => {
    expect(derivarTipo({ nome: '', perguntas: [] }, [])).toBeNull()
  })

  it('corta em 100 caracteres, igual ao portal e ao escopo', () => {
    // 80 do nome + " - " + 40 da resposta = 123, que precisa ser cortado. Um
    // nome que somasse menos de 100 não exercitaria o corte — e foi assim que a
    // primeira versão deste teste passava sem testar nada.
    const categoria: CategoriaAvaliavel = {
      chave: 'x',
      nome: 'N'.repeat(80),
      perguntas: [{ id: 'p1', rotulo: 'r', tipo: 'OPCOES', obrigatoria: true }],
    }
    const tipo = derivarTipo(categoria, [resposta('p1', 'R'.repeat(40))])
    expect(tipo).toHaveLength(100)
  })
})