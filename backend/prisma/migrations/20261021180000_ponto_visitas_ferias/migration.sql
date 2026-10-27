-- AlterTable Usuario: férias
ALTER TABLE "Usuario" ADD COLUMN "feriasInicio" TIMESTAMP(3);
ALTER TABLE "Usuario" ADD COLUMN "feriasFim" TIMESTAMP(3);

-- AlterTable RegistroPonto: visita por escola
ALTER TABLE "RegistroPonto" ADD COLUMN "agendaId" TEXT;
ALTER TABLE "RegistroPonto" ADD COLUMN "escola" TEXT;

-- Backfill escola from escolasReferencia[0] when null
UPDATE "RegistroPonto" SET "escola" = "escolasReferencia"[1] WHERE "escola" IS NULL AND array_length("escolasReferencia", 1) > 0;

-- Drop old unique and create new
DROP INDEX IF EXISTS "RegistroPonto_usuarioId_data_key";
CREATE UNIQUE INDEX "RegistroPonto_usuarioId_data_escola_key" ON "RegistroPonto"("usuarioId", "data", "escola");

CREATE INDEX IF NOT EXISTS "RegistroPonto_agendaId_idx" ON "RegistroPonto"("agendaId");
