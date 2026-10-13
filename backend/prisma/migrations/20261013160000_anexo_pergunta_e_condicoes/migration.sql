-- Vincula o anexo de abertura à pergunta que o pediu e permite MAIS DE UMA
-- condição de exibição por pergunta.
--
-- 1) `ChamadoAnexo.perguntaId`/`pergunta`: a rota de criação já montava esses dois
--    campos no objeto enviado ao `anexos.create` e o Prisma rejeitava a chamada
--    (`Unknown arg`), então qualquer chamado com anexo quebrava. Aqui eles viram
--    coluna. `pasta` NÃO vira coluna: é derivável do `path`.
--
-- 2) `FormularioPergunta.condicoes`: lista de {perguntaId, opcao} com semântica
--    de OU. Nasce NULL para não mudar o que já existe, e o backfill abaixo
--    converte o par legado (dependeDePerguntaId/dependeDeOpcao) em uma condição
--    só — as colunas antigas são mantidas em paralelo porque a API ainda as
--    preenche quando há só uma condição.

-- AlterTable
ALTER TABLE "ChamadoAnexo"
    ADD COLUMN "perguntaId" TEXT,
    ADD COLUMN "pergunta" TEXT;

-- AlterTable
ALTER TABLE "FormularioPergunta" ADD COLUMN "condicoes" JSONB;

-- Backfill: pergunta condicional legada vira uma condição só. Sem o par completo
-- não há condição que caiba — NULL significa "sempre exibir", que é o que essas
-- perguntas já faziam.
UPDATE "FormularioPergunta"
SET "condicoes" = jsonb_build_array(
  jsonb_build_object('perguntaId', "dependeDePerguntaId", 'opcao', "dependeDeOpcao")
)
WHERE "dependeDePerguntaId" IS NOT NULL
  AND "dependeDeOpcao" IS NOT NULL
  AND "dependeDeOpcao" <> '';

-- O mesmo quando só a pergunta de origem existe (aparece com qualquer resposta):
-- a opção vem vazia, que é o mesmo que "qualquer resposta".
UPDATE "FormularioPergunta"
SET "condicoes" = jsonb_build_array(
  jsonb_build_object('perguntaId', "dependeDePerguntaId", 'opcao', '')
)
WHERE "dependeDePerguntaId" IS NOT NULL
  AND ("dependeDeOpcao" IS NULL OR "dependeDeOpcao" = '')
  AND "condicoes" IS NULL;
