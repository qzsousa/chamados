-- Condicionais múltiplas (OU) + anexos por pergunta.
--
-- 1) `condicoes`: lista de {perguntaId, opcao}. Uma pergunta aparece quando
--    QUALQUER uma das condições for satisfeita. Nasce NULL para não mudar nada
--    de quem já tem pergunta cadastrada; o backfill abaixo converte o par
--    legado (dependeDePerguntaId/dependeDeOpcao) e as colunas antigas são
--    mantidas em paralelo — a API ainda as preenche quando há só uma condição,
--    então um frontend antigo continua funcionando.
--
-- 2) `ChamadoAnexo`: anexos das perguntas do formulário na abertura do chamado.
--    O `anexoUrl` continua existindo (o anexo geral da etapa de identificação).
--    Sem `expiresAt`, diferente dos anexos de conversa: anexo de abertura é
--    permanente, e é isso que o técnico precisa para resolver o chamado.
ALTER TABLE "FormularioPergunta" ADD COLUMN "condicoes" JSONB;

-- Backfill: perguntas condicionais legadas viram uma condição só.
UPDATE "FormularioPergunta"
SET "condicoes" = jsonb_build_array(
  jsonb_build_object('perguntaId', "dependeDePerguntaId", 'opcao', "dependeDeOpcao")
)
WHERE "dependeDePerguntaId" IS NOT NULL
  AND "dependeDeOpcao" IS NOT NULL
  AND "dependeDeOpcao" <> '';

CREATE TABLE "ChamadoAnexo" (
    "id" TEXT NOT NULL,
    "chamadoId" TEXT NOT NULL,
    "perguntaId" TEXT,
    "pergunta" TEXT,
    "nome" TEXT NOT NULL,
    "tipo" TEXT,
    "url" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChamadoAnexo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChamadoAnexo_chamadoId_idx" ON "ChamadoAnexo"("chamadoId");

ALTER TABLE "ChamadoAnexo"
    ADD CONSTRAINT "ChamadoAnexo_chamadoId_fkey"
    FOREIGN KEY ("chamadoId") REFERENCES "Chamado"("id") ON DELETE CASCADE ON UPDATE CASCADE;