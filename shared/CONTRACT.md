# API Contract - sci-chamados

## Base URL
- **Dev**: `http://localhost:3000/api`
- **Prod**: `https://sci-chamados-api.onrender.com/api`

## Autenticação
- **Access Token**: JWT 15min (header `Authorization: Bearer <token>`)
- **Refresh Token**: HttpOnly Cookie `refreshToken` (7 dias, `SameSite=Lax`, `Secure`, `Path=/`)
- **Renovação automática**: Interceptor no frontend captura 401 → `POST /auth/refresh` → retry request original
- **Logout**: Invalida refresh token no BD + limpa cookie

---

## Endpoints

### Auth (`/api/auth`)

| Método | Rota | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/login` | ❌ | `LoginRequest` | `LoginResponse` |
| POST | `/refresh` | ❌ | (cookie) | `LoginResponse` |
| POST | `/logout` | ✅ | - | `{ success: true }` |
| GET | `/me` | ✅ | - | `User` |
| POST | `/change-password` | ✅ | `ChangePassword` | `{ success: true }` |
| POST | `/admin/gerar-senha-temporaria` | ADMIN | `GerarSenhaTemporaria` | `GerarSenhaTemporariaResponse` |

### Usuários (`/api/usuarios`) - ADMIN

| Método | Rota | Query/Body | Response |
|--------|------|------------|----------|
| GET | `/` | `page, limit, search, nivel, status` | `PaginatedResponse<User>` |
| POST | `/` | `UserCreate` | `UserWithTempPassword` |
| GET | `/:id` | - | `User` |
| PATCH | `/:id` | `UserUpdate` | `User` |
| DELETE | `/:id` | - | `{ success: true }` |

### Chamados (`/api/chamados`)

| Método | Rota | Auth | Body/Query | Response |
|--------|------|------|------------|----------|
| POST | `/` | ✅ | `CriarChamado` | `Chamado` |
| GET | `/` | ✅ | `FiltrosChamado` | `PaginatedResponse<Chamado>` |
| GET | `/:id` | ✅ | - | `Chamado` |
| PATCH | `/:id/status` | ✅ | `AtualizarStatusChamado` | `Chamado` |
| POST | `/:id/resposta` | ✅ | `ResponderChamado` | `Chamado` |
| PATCH | `/batch` | TECNICO/ADMIN | `BatchUpdateChamados` | `{ atualizados: number }` |
| DELETE | `/batch` | ADMIN | `BatchDeleteChamados` | `{ removidos: number }` |

### Dashboards (`/api/dashboard`)

| Método | Rota | Auth | Response |
|--------|------|------|----------|
| GET | `/matriz` | ❌ | `DashboardMatrizResponse` |
| GET | `/filtrado` | ✅ | `DashboardFiltradoResponse` |
| GET | `/stats` | ✅ | `DashboardKPIs` |

### Escolas (`/api/escolas`)

| Método | Rota | Auth | Response |
|--------|------|------|----------|
| GET | `/` | ✅ | `Escola[]` |
| GET | `/tecnicos` | ✅ | `{ [escola: string]: tecnico }` |

### Equipamentos (`/api/equipamentos`)

| Método | Rota | Auth | Response |
|--------|------|------|----------|
| GET | `/` | ✅ | `Equipamento[]` |
| GET | `/categorias` | ✅ | `string[]` |
| GET | `/marcas` | ✅ | `string[]` (query: `categoria`) |
| GET | `/modelos` | ✅ | `string[]` (query: `categoria`, `marca`) |
| GET | `/filtrados` | ✅ | `Equipamento[]` (query: `categoria`, `marca`, `modelo`) |

### Inventário (`/api/inventario`)

| Método | Rota | Auth | Response |
|--------|------|------|----------|
| GET | `/` | ✅ | `Inventario[]` |
| PATCH | `/:escolaId` | ADMIN | `InventarioUpdate` |

---

## Códigos de Erro

| Code | HTTP | Descrição |
|------|------|-----------|
| `UNAUTHORIZED` | 401 | Token inválido/expirado |
| `FORBIDDEN` | 403 | Sem permissão (RBAC) |
| `VALIDATION_ERROR` | 400 | Body inválido (Zod) |
| `NOT_FOUND` | 404 | Recurso não encontrado |
| `RATE_LIMITED` | 429 | Muitas requisições |
| `INTERNAL_ERROR` | 500 | Erro interno |

### Formato de Erro
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Dados inválidos",
  "details": [
    { "field": "email", "message": "Email inválido" }
  ]
}
```

---

## Rate Limiting

| Endpoint | Limite |
|----------|--------|
| `POST /auth/login` | 10 req/min por IP |
| `POST /auth/refresh` | 30 req/min por IP |
| Demais endpoints | 100 req/min por IP |

---

## CORS

```
Allow-Origin: https://sci-chamados-frontend.onrender.com, http://localhost:5173
Allow-Credentials: true
Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
Allow-Headers: Content-Type, Authorization
```

---

## Cookies

| Cookie | Atributos |
|--------|-----------|
| `refreshToken` | HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age=604800 (7d) |

---

## Variáveis de Ambiente (Backend)

```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
NODE_ENV=production
FRONTEND_URL=https://sci-chamados-frontend.onrender.com
SENTRY_DSN=...
PORT=10000
```

---

## Versionamento

- Header `Accept: application/vnd.sci-chamados.v1+json` (opcional)
- Breaking changes = nova versão no path `/api/v2/`