-- CreateTable
CREATE TABLE "TutorialCurtida" (
    "id" TEXT NOT NULL,
    "tutorialId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorialCurtida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorialComentario" (
    "id" TEXT NOT NULL,
    "tutorialId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "autorNome" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorialComentario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorialComentarioCurtida" (
    "id" TEXT NOT NULL,
    "comentarioId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorialComentarioCurtida_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TutorialCurtida_tutorialId_usuarioId_key" ON "TutorialCurtida"("tutorialId", "usuarioId");

-- CreateIndex
CREATE INDEX "TutorialCurtida_tutorialId_idx" ON "TutorialCurtida"("tutorialId");

-- CreateIndex
CREATE INDEX "TutorialCurtida_usuarioId_idx" ON "TutorialCurtida"("usuarioId");

-- CreateIndex
CREATE INDEX "TutorialComentario_tutorialId_idx" ON "TutorialComentario"("tutorialId");

-- CreateIndex
CREATE INDEX "TutorialComentario_parentId_idx" ON "TutorialComentario"("parentId");

-- CreateIndex
CREATE INDEX "TutorialComentario_usuarioId_idx" ON "TutorialComentario"("usuarioId");

-- CreateIndex
CREATE INDEX "TutorialComentario_createdAt_idx" ON "TutorialComentario"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TutorialComentarioCurtida_comentarioId_usuarioId_key" ON "TutorialComentarioCurtida"("comentarioId", "usuarioId");

-- CreateIndex
CREATE INDEX "TutorialComentarioCurtida_comentarioId_idx" ON "TutorialComentarioCurtida"("comentarioId");

-- CreateIndex
CREATE INDEX "TutorialComentarioCurtida_usuarioId_idx" ON "TutorialComentarioCurtida"("usuarioId");

-- AddForeignKey
ALTER TABLE "TutorialCurtida" ADD CONSTRAINT "TutorialCurtida_tutorialId_fkey" FOREIGN KEY ("tutorialId") REFERENCES "Tutorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorialCurtida" ADD CONSTRAINT "TutorialCurtida_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorialComentario" ADD CONSTRAINT "TutorialComentario_tutorialId_fkey" FOREIGN KEY ("tutorialId") REFERENCES "Tutorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorialComentario" ADD CONSTRAINT "TutorialComentario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorialComentario" ADD CONSTRAINT "TutorialComentario_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TutorialComentario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorialComentarioCurtida" ADD CONSTRAINT "TutorialComentarioCurtida_comentarioId_fkey" FOREIGN KEY ("comentarioId") REFERENCES "TutorialComentario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorialComentarioCurtida" ADD CONSTRAINT "TutorialComentarioCurtida_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
