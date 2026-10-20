-- Conversas da CafeIA persistidas por usuário/conta.

-- CreateTable
CREATE TABLE "ChatIaConversa" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mensagens" JSONB NOT NULL,
    "atualizado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatIaConversa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatIaConversa_usuarioId_updatedAt_idx" ON "ChatIaConversa"("usuarioId", "updatedAt");

-- AddForeignKey
ALTER TABLE "ChatIaConversa" ADD CONSTRAINT "ChatIaConversa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
