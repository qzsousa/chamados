-- CreateTable
CREATE TABLE "ChamadoMensagem" (
    "id" TEXT NOT NULL,
    "chamadoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "autorNome" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChamadoMensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChamadoMensagemAnexo" (
    "id" TEXT NOT NULL,
    "mensagemId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChamadoMensagemAnexo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChamadoMensagem_chamadoId_idx" ON "ChamadoMensagem"("chamadoId");

-- CreateIndex
CREATE INDEX "ChamadoMensagemAnexo_mensagemId_idx" ON "ChamadoMensagemAnexo"("mensagemId");

-- CreateIndex
CREATE INDEX "ChamadoMensagemAnexo_expiresAt_idx" ON "ChamadoMensagemAnexo"("expiresAt");

-- AddForeignKey
ALTER TABLE "ChamadoMensagem" ADD CONSTRAINT "ChamadoMensagem_chamadoId_fkey" FOREIGN KEY ("chamadoId") REFERENCES "Chamado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChamadoMensagemAnexo" ADD CONSTRAINT "ChamadoMensagemAnexo_mensagemId_fkey" FOREIGN KEY ("mensagemId") REFERENCES "ChamadoMensagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
