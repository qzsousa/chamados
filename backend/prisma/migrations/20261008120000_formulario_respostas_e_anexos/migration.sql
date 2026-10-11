-- Respostas do formulário dinâmico + anexos da abertura do chamado.
--
-- `formularioRespostas` guarda o retrato do que a escola respondeu no momento da
-- abertura (Json): se o ADMIN reescrever a pergunta depois, o técnico continua
-- vendo o texto que a escola leu.
ALTER TABLE "Chamado" ADD COLUMN "formularioRespostas" JSONB;

-- CreateTable
CREATE TABLE "ChamadoAnexo" (
    "id" TEXT NOT NULL,
    "chamadoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT,
    "url" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChamadoAnexo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChamadoAnexo_chamadoId_idx" ON "ChamadoAnexo"("chamadoId");

-- AddForeignKey
ALTER TABLE "ChamadoAnexo" ADD CONSTRAINT "ChamadoAnexo_chamadoId_fkey" FOREIGN KEY ("chamadoId") REFERENCES "Chamado"("id") ON DELETE CASCADE ON UPDATE CASCADE;