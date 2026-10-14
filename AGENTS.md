# chamados — backend Express/Prisma + frontend

Sistema de chamados: backend Node/TypeScript/Prisma sobre PostgreSQL e frontend
próprio. Repositório de produto.

## Antes de mexer

```bash
cd shared/types && npm run build     # pacote compilado; TS lê dist/api.d.ts
cd backend && npm run prisma:generate
```

Sem isso, o typecheck mente ("propriedade não existe").

## Comandos

Backend (`backend/`):
```bash
npm run dev           # tsx watch (porta 10000)
npm run build         # tsc
npm run typecheck     # tsc --noEmit
npm run lint          # eslint src
npm run test          # vitest run
npm run test:coverage
```

Subir para os gates do orq:
```bash
dev-restart -Port 10000 -Dir "C:\Users\Pablo\Desktop\chamados\backend" -Script "dev-entry.mjs"
```

## Semântica de contrato

- Backend de chamados usa códigos HTTP reais (400/401/403/404/409/422).
- Auth: access token em memória, refresh token em cookie httpOnly.
  Não mova o access token para `localStorage`.

## Regras

- Não faça push sem autorização explícita.
- Termine com a árvore limpa (tudo commitado).
- Só edite arquivos do escopo da tarefa.
- Mudanças em contrato de API devem descrever o impacto no outro lado (frontend,
  portal, SCE).

## Skills a carregar (OpenCode)

Use a tool `skill` antes de trabalhar, conforme o escopo:
- Node/Express/Prisma/Postgres: `backend-patterns`, `postgres-patterns`
- Padrões/código: `coding-standards`, `security-review`, `tdd-workflow`
- Qualidade/gates: `verification-loop`, `eval-harness`, `strategic-compact`
- Aprendizado/contexto: `continuous-learning`, `continuous-learning-v2`,
  `iterative-retrieval`

Se mais de uma se aplica, carregue em paralelo.