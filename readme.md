# sci-chamados - Migração Apps Script → Render + Supabase + Vue 3

## Visão Geral

Este projeto migra o sistema de chamados da URE Leste 3 do Google Apps Script para uma arquitetura moderna:

- **Backend**: Node.js + Express + TypeScript + Prisma + Supabase (PostgreSQL)
- **Frontend**: Vue 3 + Vite + TypeScript + Pinia + Vue Router
- **Deploy**: Render (Free Tier)
- **Database**: Supabase (PostgreSQL)
- **Auth**: JWT (Access 15min + Refresh 7d em HttpOnly Cookie)

---

## Estrutura do Projeto

```
sci-chamados/
├── backend/                 # API REST
│   ├── src/
│   │   ├── config/         # env, prisma, supabase
│   │   ├── routes/         # auth, usuarios, chamados, escolas, equipamentos, inventario, dashboard
│   │   ├── middleware/     # auth, RBAC, rateLimit
│   │   ├── services/       # auth, password, protocolo, normalization, migration
│   │   ├── utils/          # jwt, tokens
│   │   └── index.ts        # Entry point
│   ├── prisma/
│   │   └── schema.prisma   # Schema do banco
│   ├── package.json
│   ├── tsconfig.json
│   └── render.yaml
│
├── frontend/                # SPA Vue 3
│   ├── src/
│   │   ├── api/            # Axios client + interceptors
│   │   ├── components/     # UI components (Button, Input, Select, Card, Toast)
│   │   ├── composables/    # Composables reutilizáveis
│   │   ├── router/         # Vue Router + guards
│   │   ├── stores/         # Pinia stores (auth, chamados, ui)
│   │   ├── views/          # LoginView, FormsView, DashboardMatrizView, DashboardFiltradoView, AdminUsuariosView, TrocarSenhaView
│   │   ├── styles/         # Design system (CSS variables)
│   │   └── main.ts         # Entry point
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── render.yaml
│
├── shared/                  # Contrato compartilhado (source of truth)
│   ├── types/
│   │   └── api.ts          # Zod schemas + TypeScript types
│   ├── CONTRACT.md         # Documentação da API
│   └── migration/
│       └── checklist.md    # Checklist de migração de dados
│
└── docs/
    ├── ARCHITECTURE.md
    └── DEPLOY.md
```

---

## Configurações Confirmadas

| Item | Valor |
|------|-------|
| Porta Backend | 10000 (Render default) |
| CORS Origins | `https://sci-chamados-frontend.onrender.com`, `http://localhost:5173` |
| Auth | JWT Access 15min + Refresh 7d (HttpOnly Cookie, SameSite=Lax, Secure) |
| Rate Limiting | Login 10/min, Refresh 30/min, Geral 100/min |
| Logs | Pino (backend), Console (frontend) |
| Testes | Vitest (unit) + Playwright (E2E) |
| Monitoramento | Sentry |

---

## Como Iniciar Cada IA

### 🤖 IA 1 - BACKEND LEAD

**Pasta**: `backend/`

```bash
cd backend
npm install
cp .env.example .env  # Configure as variáveis
npm run dev           # Desenvolvimento (tsx watch)
npm run build         # Build produção
npm run prisma:generate
npm run prisma:migrate
npm run test
```

**Tarefas prioritárias**:
1. Verificar se `src/index.ts` sobe sem erros
2. Validar `prisma/schema.prisma` com `npx prisma migrate deploy`
3. Testar endpoints de auth: `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`
4. Implementar rotas CRUD restantes
5. Rodar migração de dados: `npm run migration:run`

---

### 🤖 IA 2 - FRONTEND LEAD

**Pasta**: `frontend/`

```bash
cd frontend
npm install
npm run dev           # Vite dev server (porta 5173)
npm run build         # Build produção
npm run test          # Vitest
npm run test:e2e      # Playwright
npm run typecheck     # vue-tsc
```

**Tarefas prioritárias**:
1. Verificar se `npm run dev` sobe sem erros
2. Testar fluxo de login → dashboard
3. Validar FormsView (porta do FormsIndex.html)
4. Testar DashboardMatrizView e DashboardFiltradoView
5. Testar AdminUsuariosView (CRUD usuários)

---

### 🤖 IA 3 - DEVOPS / MIGRATION (Opcional)

**Pasta**: `backend/` + `shared/migration/`

```bash
# Configurar variáveis no Render Dashboard:
# - DATABASE_URL (auto do Render Postgres)
# - JWT_SECRET, JWT_REFRESH_SECRET (generateValue: true)
# - FRONTEND_URL=https://sci-chamados-frontend.onrender.com
# - SENTRY_DSN
# - GOOGLE_SERVICE_ACCOUNT_JSON (base64)
# - GOOGLE_SHEETS_ID

# Rodar migração local:
cd backend
npm run migration:run
```

---

## Variáveis de Ambiente

### Backend (`.env`)

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/sci_chamados
JWT_SECRET=seu-secret-super-seguro-min-32-chars
JWT_REFRESH_SECRET=outro-secret-diferente-min-32-chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
SENTRY_DSN=
GOOGLE_SERVICE_ACCOUNT_JSON=
GOOGLE_SHEETS_ID=
```

### Frontend (`.env`)

```env
VITE_API_URL=http://localhost:3000/api
VITE_SENTRY_DSN=
```

---

## Comandos Úteis

### Backend
```bash
npm run dev              # Dev com hot reload
npm run build            # Compila para dist/
npm run start            # Roda dist/index.js
npm run prisma:studio    # Abre Prisma Studio
npm run prisma:migrate   # Aplica migrations
npm run migration:run    # Roda migração Sheets → Supabase
npm run test             # Vitest
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
```

### Frontend
```bash
npm run dev              # Vite dev server
npm run build            # Build para dist/
npm run preview          # Preview do build
npm run test             # Vitest
npm run test:e2e         # Playwright
npm run lint             # ESLint
npm run typecheck        # vue-tsc --noEmit
```

---

## Fluxo de Autenticação

```
1. POST /api/auth/login {email, senha}
   → Retorna accessToken + seta cookie HttpOnly refreshToken
   → Se primeiroLogin=true → redireciona /trocar-senha

2. Requisições autenticadas:
   Header: Authorization: Bearer <accessToken>
   Cookie: refreshToken (HttpOnly)

3. 401 → Interceptor chama POST /api/auth/refresh (com cookie)
   → Novo accessToken + novo refreshToken (rotação)
   → Retry request original

4. POST /api/auth/logout
   → Invalida refreshToken no BD + limpa cookie
```

---

## Endpoints Principais

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/auth/login` | ❌ | Login |
| POST | `/api/auth/refresh` | ❌ | Refresh token |
| POST | `/api/auth/logout` | ✅ | Logout |
| GET | `/api/auth/me` | ✅ | Usuario logado |
| POST | `/api/auth/change-password` | ✅ | Trocar senha |
| POST | `/api/auth/admin/gerar-senha-temporaria` | ADMIN | Gerar senha temp |
| GET | `/api/usuarios` | ADMIN | Listar usuários |
| POST | `/api/usuarios` | ADMIN | Criar usuário |
| GET | `/api/chamados` | ✅ | Listar chamados |
| POST | `/api/chamados` | ✅ | Criar chamado |
| GET | `/api/dashboard/matriz` | ❌ | Dashboard público |
| GET | `/api/dashboard/filtrado` | ✅ | Dashboard filtrado |
| GET | `/api/escolas` | ✅ | Lista escolas + técnicos |
| GET | `/api/equipamentos` | ✅ | Catálogo equipamentos |

---

## Migração de Dados

Execute após configurar `GOOGLE_SERVICE_ACCOUNT_JSON` e `GOOGLE_SHEETS_ID`:

```bash
cd backend
npm run migration:run
```

Isso migra:
- Usuários (com senha temporária "Mudar@123" + primeiroLogin=true)
- Escolas (84 escolas + mapeamento técnico)
- Equipamentos (catálogo)
- Inventário (status por escola)
- Chamados (com deduplicação)

---

## Deploy no Render

1. **Crie o banco**: Render Dashboard → New → PostgreSQL → Free
2. **Backend**: New → Web Service → Connect repo → `backend/`
   - Build: `npm ci && npm run build && npx prisma migrate deploy`
   - Start: `npm run start`
   - Env vars: conforme `backend/render.yaml`
3. **Frontend**: New → Static Site → Connect repo → `frontend/`
   - Build: `npm ci && npm run build`
   - Publish: `./dist`
   - Routes: `/* → /index.html`
   - Env vars: conforme `frontend/render.yaml`
4. **Configure DNS** se tiver domínio próprio

---

## Testes

### Unitários (Vitest)
```bash
# Backend
cd backend && npm run test

# Frontend
cd frontend && npm run test
```

### E2E (Playwright)
```bash
cd frontend
npm run test:e2e
```

---

## Convenções de Código

- **TypeScript strict mode** ativado
- **ESLint + Prettier** configurados
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`)
- **Branches**: `feat/nome`, `fix/nome`, `chore/nome`
- **PRs**: Requerem aprovação + testes passando

---

## Suporte

- **Logs backend**: `pino` (structured JSON)
- **Logs frontend**: Console + Sentry
- **Health check**: `GET /health`
- **Prisma Studio**: `npm run prisma:studio`

---

## Próximos Passos

1. ✅ Estrutura base criada
2. 🔄 IAs começam implementação paralela
3. 🔄 Integração frontend ↔ backend
4. 🔄 Migração de dados
5. 🔄 Deploy staging
6. 🔄 Testes E2E completos
6. 🚀 Deploy produção#   f o r c e   r e b u i l d  
 