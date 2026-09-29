-- CreateTable
CREATE TABLE "FormularioCategoria" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "cor" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormularioCategoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormularioPergunta" (
    "id" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,
    "ajuda" TEXT,
    "tipo" TEXT NOT NULL,
    "obrigatoria" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "dependeDePerguntaId" TEXT,
    "dependeDeOpcao" TEXT,
    "opcoes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormularioPergunta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormularioCategoria_chave_key" ON "FormularioCategoria"("chave");

-- CreateIndex
CREATE INDEX "FormularioCategoria_ativa_ordem_idx" ON "FormularioCategoria"("ativa", "ordem");

-- CreateIndex
CREATE INDEX "FormularioPergunta_categoriaId_ordem_idx" ON "FormularioPergunta"("categoriaId", "ordem");

-- AddForeignKey
ALTER TABLE "FormularioPergunta" ADD CONSTRAINT "FormularioPergunta_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "FormularioCategoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
