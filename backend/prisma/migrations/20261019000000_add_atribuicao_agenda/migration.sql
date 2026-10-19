-- Agenda de atendimento: atribuição de um técnico a uma escola em um dia.
--
-- A chave natural é (escola, data): a mesma escola não tem dois técnicos no
-- mesmo dia. O @@unique vira índice único no banco, que é quem impede a
-- duplicidade de verdade (a checagem em aplicação falha em concurência).
--
-- `escola` guarda o NOME da unidade (mesma semântica de "Chamado.unidade"),
-- não o id de "Escola": a agenda é filtrada por unidade visível, e o nome é o
-- que o filtro de visibilidade já usa.
--
-- `tecnicoId` é o id do "Usuario" (de onde vem a cor do T-003) e `tecnicoNome`
-- é o snapshot do nome no momento da atribuição.

-- CreateTable
CREATE TABLE "AtribuicaoAgenda" (
    "id" TEXT NOT NULL,
    "escola" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "tecnicoId" TEXT NOT NULL,
    "tecnicoNome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AtribuicaoAgenda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AtribuicaoAgenda_escola_data_key" ON "AtribuicaoAgenda"("escola", "data");

-- CreateIndex
CREATE INDEX "AtribuicaoAgenda_tecnicoId_idx" ON "AtribuicaoAgenda"("tecnicoId");

-- CreateIndex
CREATE INDEX "AtribuicaoAgenda_data_idx" ON "AtribuicaoAgenda"("data");
