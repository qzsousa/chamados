-- AlterTable
-- aceitoEm e concluidoEm já vêm da migration 20261006000000_add_aceito_concluido_em:
-- esta não os recria para não estourar P3005 no banco.
ALTER TABLE "Chamado" ADD COLUMN     "responsavelId" TEXT,
ADD COLUMN     "reaberturas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aceitoPor" TEXT,
ADD COLUMN     "conferidoEm" TIMESTAMP(3),
ADD COLUMN     "conferidoPor" TEXT;

-- CreateTable
CREATE TABLE "ChamadoAtividade" (
    "id" TEXT NOT NULL,
    "chamadoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "autorNome" TEXT NOT NULL,
    "autorNivel" TEXT,
    "texto" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChamadoAtividade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChamadoAtividadeAnexo" (
    "id" TEXT NOT NULL,
    "atividadeId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT,
    "url" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChamadoAtividadeAnexo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Chamado_responsavelId_idx" ON "Chamado"("responsavelId");

-- CreateIndex
CREATE INDEX "ChamadoAtividade_chamadoId_criadoEm_idx" ON "ChamadoAtividade"("chamadoId", "criadoEm");

-- CreateIndex
CREATE INDEX "ChamadoAtividadeAnexo_atividadeId_idx" ON "ChamadoAtividadeAnexo"("atividadeId");

-- AddForeignKey
ALTER TABLE "ChamadoAtividade" ADD CONSTRAINT "ChamadoAtividade_chamadoId_fkey" FOREIGN KEY ("chamadoId") REFERENCES "Chamado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChamadoAtividadeAnexo" ADD CONSTRAINT "ChamadoAtividadeAnexo_atividadeId_fkey" FOREIGN KEY ("atividadeId") REFERENCES "ChamadoAtividade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
