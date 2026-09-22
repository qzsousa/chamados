-- CreateTable
CREATE TABLE "TutorialCategoria" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "cor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorialCategoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tutorial" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "subtitulo" TEXT,
    "conteudo" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "criadoPor" TEXT NOT NULL,
    "visualizacoes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tutorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorialAnexo" (
    "id" TEXT NOT NULL,
    "tutorialId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "TutorialAnexo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TutorialCategoria_nome_key" ON "TutorialCategoria"("nome");

-- CreateIndex
CREATE INDEX "Tutorial_categoriaId_idx" ON "Tutorial"("categoriaId");

-- CreateIndex
CREATE INDEX "Tutorial_createdAt_idx" ON "Tutorial"("createdAt");

-- AddForeignKey
ALTER TABLE "Tutorial" ADD CONSTRAINT "Tutorial_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "TutorialCategoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorialAnexo" ADD CONSTRAINT "TutorialAnexo_tutorialId_fkey" FOREIGN KEY ("tutorialId") REFERENCES "Tutorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
