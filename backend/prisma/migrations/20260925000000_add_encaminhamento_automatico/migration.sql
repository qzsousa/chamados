-- CreateTable
CREATE TABLE "EncaminhamentoRegra" (
    "id" TEXT NOT NULL,
    "categoriaChave" TEXT NOT NULL,
    "modo" TEXT NOT NULL DEFAULT 'UNIDADE',
    "tecnicoId" TEXT,
    "tecnicoNome" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EncaminhamentoRegra_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Chamado" ADD COLUMN     "categoriaChave" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "EncaminhamentoRegra_categoriaChave_key" ON "EncaminhamentoRegra"("categoriaChave");

-- CreateIndex
CREATE INDEX "EncaminhamentoRegra_ativa_idx" ON "EncaminhamentoRegra"("ativa");

-- CreateIndex
CREATE INDEX "Chamado_categoriaChave_idx" ON "Chamado"("categoriaChave");
