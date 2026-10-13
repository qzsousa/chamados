-- Pergunta para quem esqueceu a senha do portal.
--
-- Aparece só quando a resposta da 1a pergunta da categoria Sistemas é
-- "PortalNet" (dependsDeOpcao), que é onde o botão "esqueci minha senha" do
-- login leva. Por isso NÃO passa pelo caminho do código de primeiro acesso:
-- esta pergunta é para quem JÁ tem senha e não lembra.
--
-- Id no mesmo formato dos outros seeds da categoria, mas com sufixo próprio:
-- 'seed-perg-sist-6' e 'seed-perg-sist-7' existem em SEED_FORMULARIO e nunca
-- foram semeados em produção, então reaproveitar o número faria a migration
-- colidir com uma pergunta de outro assunto.
--
-- `ordem` 20 para ficar depois de todas as perguntas que já existem na
-- categoria — a ordem delas no banco vai até 11.
INSERT INTO "FormularioPergunta" (
  "id", "categoriaId", "rotulo", "ajuda", "tipo", "obrigatoria", "ordem",
  "ativa", "dependeDePerguntaId", "dependeDeOpcao", "opcoes", "createdAt", "updatedAt"
)
SELECT
  'seed-perg-sist-senha',
  "id",
  'Esqueci minha senha',
  'Escreva abaixo o que aconteceu. A Matriz vai verificar e entregar uma senha provisória para você usar na entrada — e você vai trocá-la assim que conseguir.',
  'TEXTO_LONGO',
  true,
  20,
  true,
  'seed-perg-sist-1',
  'PortalNet',
  NULL,
  NOW(),
  NOW()
FROM "FormularioCategoria" WHERE "chave" = 'sistemas'
ON CONFLICT ("id") DO NOTHING;