-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "filial" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "primeiroLogin" BOOLEAN NOT NULL DEFAULT true,
    "refreshTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Escola" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeNormalizado" TEXT NOT NULL,
    "tecnico" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Escola_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chamado" (
    "id" TEXT NOT NULL,
    "protocolo" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unidade" TEXT NOT NULL,
    "solicitante" TEXT NOT NULL,
    "funcao" TEXT,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "urgencia" TEXT NOT NULL,
    "anexoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "responsavel" TEXT,
    "ultimaAtualizacao" TIMESTAMP(3) NOT NULL,
    "historico" TEXT,
    "tecnicoResolucao" TEXT,
    "tecnicoSetor" TEXT,
    "inventarioStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chamado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventario" (
    "id" TEXT NOT NULL,
    "escolaId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipamento" (
    "id" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_email_idx" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_filial_idx" ON "Usuario"("filial");

-- CreateIndex
CREATE INDEX "Usuario_nivel_idx" ON "Usuario"("nivel");

-- CreateIndex
CREATE INDEX "Usuario_status_idx" ON "Usuario"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Escola_nome_key" ON "Escola"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Escola_nomeNormalizado_key" ON "Escola"("nomeNormalizado");

-- CreateIndex
CREATE INDEX "Escola_tecnico_idx" ON "Escola"("tecnico");

-- CreateIndex
CREATE UNIQUE INDEX "Chamado_protocolo_key" ON "Chamado"("protocolo");

-- CreateIndex
CREATE INDEX "Chamado_unidade_idx" ON "Chamado"("unidade");

-- CreateIndex
CREATE INDEX "Chamado_status_idx" ON "Chamado"("status");

-- CreateIndex
CREATE INDEX "Chamado_tecnicoSetor_idx" ON "Chamado"("tecnicoSetor");

-- CreateIndex
CREATE INDEX "Chamado_timestamp_idx" ON "Chamado"("timestamp");

-- CreateIndex
CREATE INDEX "Chamado_protocolo_idx" ON "Chamado"("protocolo");

-- CreateIndex
CREATE INDEX "Chamado_responsavel_idx" ON "Chamado"("responsavel");

-- CreateIndex
CREATE UNIQUE INDEX "Inventario_escolaId_key" ON "Inventario"("escolaId");

-- CreateIndex
CREATE INDEX "Inventario_status_idx" ON "Inventario"("status");

-- CreateIndex
CREATE INDEX "Equipamento_categoria_idx" ON "Equipamento"("categoria");

-- CreateIndex
CREATE INDEX "Equipamento_categoria_marca_idx" ON "Equipamento"("categoria", "marca");

-- CreateIndex
CREATE UNIQUE INDEX "Equipamento_categoria_marca_modelo_key" ON "Equipamento"("categoria", "marca", "modelo");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_usuarioId_idx" ON "RefreshToken"("usuarioId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiraEm_idx" ON "RefreshToken"("expiraEm");

-- AddForeignKey
ALTER TABLE "Inventario" ADD CONSTRAINT "Inventario_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "Escola"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;