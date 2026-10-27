-- AlterTable
ALTER TABLE "Escola" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Escola" ADD COLUMN "longitude" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "RegistroPonto" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "batidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "dentroDoRaio" BOOLEAN,
    "distanciaMetros" INTEGER,
    "escolasReferencia" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "semAgenda" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'NO_HORARIO',
    "autorizadoPor" TEXT,
    "autorizadoEm" TIMESTAMP(3),
    "justificativa" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistroPonto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistroPonto_usuarioId_data_key" ON "RegistroPonto"("usuarioId", "data");

CREATE INDEX "RegistroPonto_usuarioId_idx" ON "RegistroPonto"("usuarioId");

CREATE INDEX "RegistroPonto_data_idx" ON "RegistroPonto"("data");

CREATE INDEX "RegistroPonto_status_idx" ON "RegistroPonto"("status");

-- AddForeignKey
ALTER TABLE "RegistroPonto" ADD CONSTRAINT "RegistroPonto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
