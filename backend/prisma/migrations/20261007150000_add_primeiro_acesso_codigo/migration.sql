-- CreateTable
CREATE TABLE "CodigoPrimeiroAcesso" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "usadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodigoPrimeiroAcesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodigoConfirmado" (
    "id" TEXT NOT NULL,
    "codigoId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "revogadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodigoConfirmado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CodigoPrimeiroAcesso_usuarioId_idx" ON "CodigoPrimeiroAcesso"("usuarioId");

-- CreateIndex
CREATE INDEX "CodigoPrimeiroAcesso_expiraEm_idx" ON "CodigoPrimeiroAcesso"("expiraEm");

-- CreateIndex
CREATE UNIQUE INDEX "CodigoConfirmado_tokenHash_key" ON "CodigoConfirmado"("tokenHash");

-- CreateIndex
CREATE INDEX "CodigoConfirmado_codigoId_idx" ON "CodigoConfirmado"("codigoId");

-- CreateIndex
CREATE INDEX "CodigoConfirmado_expiraEm_idx" ON "CodigoConfirmado"("expiraEm");

-- AddForeignKey
ALTER TABLE "CodigoPrimeiroAcesso" ADD CONSTRAINT "CodigoPrimeiroAcesso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodigoConfirmado" ADD CONSTRAINT "CodigoConfirmado_codigoId_fkey" FOREIGN KEY ("codigoId") REFERENCES "CodigoPrimeiroAcesso"("id") ON DELETE CASCADE ON UPDATE CASCADE;