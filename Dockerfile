# syntax=docker/dockerfile:1
#
# Imagem de producao do sci-chamados-backend (API de chamados / SEINTEC).
#
# IMPORTANTE: o contexto de build e a RAIZ deste repositorio, porque o backend
# depende de shared/types via "file:../shared/types". Portanto:
#
#   docker build -f Dockerfile -t IMG .
#                  ^ nao "docker build ." de dentro de backend/
#
# A ordem dos passos (shared/types compilado ANTES do `npm ci` do backend)
# espelha o buildCommand do render.yaml de proposito, para que a imagem daqui
# e a do Render produzam exatamente o mesmo bundle.
#
# Este Dockerfile convive com o render.yaml. O Render nao usa Dockerfile, entao
# o deploy atual continua funcionando sem nenhuma alteracao.

# ---------------------------------------------------------------------------
# Stage 1 - shared/types: contratos Zod compartilhados entre backend e frontend
# ---------------------------------------------------------------------------
FROM node:22-slim AS shared

# openssl: exigido pelo engine do Prisma e pelo TLS do googleapis/supabase.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /shared/types
COPY shared/types/package.json shared/types/package-lock.json ./
RUN npm ci

# .dockerignore exclui o dist local, entao este build gera o artefato limpo.
COPY shared/types/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2 - build do backend
# ---------------------------------------------------------------------------
FROM node:22-slim AS build

# Mesmo motivo do stage shared: o postinstall do @prisma/client baixa e verifica
# os engines durante o `npm ci`, e o runtime fala TLS com Supabase e Google.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# /shared/types precisa existir e estar compilado ANTES do `npm ci` do backend.
# O .npmrc do projeto usa install-links=false, ou seja, o pacote file: e
# instalado por symlink para este diretorio.
COPY --from=shared /shared/types /shared/types

COPY backend/package.json backend/package-lock.json backend/.npmrc ./
RUN npm ci

COPY backend/ ./

# `prisma generate` nao acessa o banco, mas o schema referencia env("DATABASE_URL").
# O placeholder abaixo satisfaz a validacao do schema em tempo de build - o valor
# real so e usado em runtime, e as migracoes rodam em um Job separado.
ARG PLACEHOLDER_DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV DATABASE_URL=${PLACEHOLDER_DATABASE_URL}

RUN npx prisma generate && npm run build

# ---------------------------------------------------------------------------
# Stage 3 - runtime: somente dependencias de producao
# ---------------------------------------------------------------------------
FROM node:22-slim AS runtime

# NODE_OPTIONS=--dns-result-order=ipv4first e a mesma flag do render.yaml: evita
# que o pooler do Supabase seja resolvido por IPv6 em runners so com IPv4.
ENV NODE_ENV=production \
    PORT=8080 \
    NODE_OPTIONS=--dns-result-order=ipv4first

WORKDIR /app

COPY --from=shared /shared/types /shared/types
COPY backend/package.json backend/package-lock.json backend/.npmrc ./
RUN npm ci --omit=dev \
 && npm cache clean --force

# CLI do Prisma instalada globalmente (fora da arvore do projeto, para nao
# interferir no lockfile) para permitir `prisma migrate deploy` em um Cloud Run Job.
RUN npm i -g prisma@5.10.0 \
 && npm cache clean --force

# Client gerado e JS compilado vem do stage de build, nunca do host.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist

# schema + migrations + seed, usados pelo Job de migracao.
COPY backend/prisma ./prisma

EXPOSE 8080
USER node

CMD ["node", "dist/index.js"]
