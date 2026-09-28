# Migrar sci-chamados e SCE do Render para o Google Cloud Run

Guia de operacao. **O Render nao foi desconfigurado**: `render.yaml` continua
intacto e nenhum servico e desligado por este trabalho. Voce pode publicar no
Cloud Run e so cortar o Render depois de validar.

---

## 1. Por que Cloud Run

O gargalo nao era o codigo, era o plano: as 750 instance-hours sao **por
workspace**, divididas entre os seus dois web services (`sci-chamados-api` e
`sce-nyjc`). Com dois servicos, o pool acaba na metade do tempo. Pior: sem cartao
de crédito no cadastro, o Render **suspende** em vez de cobrar.

O Cloud Run nao tem limite de horas. O plano always-free inclui 2 milhoes de
requisicoes, 180.000 vCPU-segundos e 360.000 GB-segundos por mes, e a cobranca e
por uso, entao uma semana sem uso praticamente nao custa nada.

Detalhe que importa: **o banco nunca esteve no Render**. O `DATABASE_URL` aponta
para `aws-0-us-west-2.pooler.supabase.com`. Nao ha dado para migrar, e o banco
continua de pe independente da plataforma da API. Por isso o cutover e so uma
troca de URL.

### Regiao: us-west1 (nao ew1, nao us-central1)

O pooler do seu Supabase esta em `us-west-2`. Usar `us-west1` deixa API e banco
na mesma costa do Pacifico. O custo de latencia de um `us-east1` para Oregon
entra em cada requisicao do Prisma.

---

## 2. O que foi criado

Em `C:\Users\Pablo\Desktop\chamados`:

| Arquivo | Funcao |
|---|---|
| `Dockerfile` | imagem de producao da API (context = raiz do repo) |
| `.dockerignore` | exclui segredos e artefatos locais do build |
| `deploy/deploy-cloudrun.ps1` | build, push, migrations e deploy |
| `deploy/env-producao.example.yaml` | variaveis nao sensiveis |
| `deploy/secrets.example.env` | modelo dos segredos |
| `GUIA-CLOUDRUN.md` | este arquivo |

Em `C:\Users\Pablo\Desktop\sce`: `Dockerfile`, `.dockerignore` e a pasta `deploy/`
(com `deploy-sce.ps1`, `env-producao.example.yaml` e `secrets.example.env`).

**Nenhum arquivo do Render foi alterado ou removido. Nenhum arquivo do
`backend/src` foi tocado** — o cron interno, o CORS e os cookies continuam
exatamente como estavam.

### Detalhe do contexto de build

O `backend/package.json` declara `"@shared/api": "file:../shared/types"`, e o
`.npmrc` do projeto usa `install-links=false` — ou seja, o npm cria um
**junction** de `node_modules/@shared/api` para `shared/types`. Por isso:

- o contexto do build e a **raiz do repo**, nao `backend/`;
- `shared/types` precisa estar **compilado** antes do `npm ci` do backend;
- o `/shared/types` inteiro e copiado para a imagem final, senao o junction
  fica pendurado e o `require('@shared/api')` quebra em runtime.

O `Dockerfile` respeita essa ordem, que e a mesma do `buildCommand` do
`render.yaml` — as duas imagens geram o mesmo bundle.

---

## 3. Pre-requisitos

- Docker Desktop instalado e rodando (nao estava instalado na sua maquina).
- `gcloud` instalado: `gcloud init` e `gcloud auth login`.
- **Billing habilitado** no projeto. Cloud Run exige cartao. Sem billing, nenhum
  servico e criado.
- `secrets.env` e `env-producao.yaml` preenchidos (secoes 4 e 5).

---

## 4. Segredos

```powershell
cd C:\Users\Pablo\Desktop\chamados
Copy-Item deploy\secrets.example.env deploy\secrets.env
Copy-Item deploy\env-producao.example.yaml deploy\env-producao.yaml
```

Preencha `deploy/secrets.env`. Os quatro que quebram o boot se faltarem:

- `DATABASE_URL` e `DIRECT_URL` — Connection string do Supabase. Sao campos
  diferentes: o pooler (host `aws-0-...pooler.supabase.com`) e o direto
  (host `db.<ref>.supabase.co`). O Prisma usa o `DIRECT_URL` nas migrations.
- `JWT_SECRET` e `JWT_REFRESH_SECRET` — minimo de 32 caracteres, exigidos pelo
  zod em `src/config/env.ts`. **Use os mesmos valores do Render**, senao todo
  token emitido antes do cutover e invalidado e o usuario precisa logar de novo.
  `openssl rand -base64 48` para gerar.

Para o `GOOGLE_SERVICE_ACCOUNT_JSON`, o arquivo local tem que virar **uma linha
sem quebra** (JSON com `\n` no meio quebra a variavel de ambiente):

```powershell
(Get-Content backend\gcp-service-account.json -Raw) -replace '\s+',''
```

O script cria um secret por linha, com nome `chamados-<chave em kebab-case>`
(`DATABASE_URL` vira `chamados-database-url`) e injeta via `--set-secrets`.
O `gcp-service-account.json` esta explicitamente no `.dockerignore`: sem essa
linha a chave da conta de servico entraria na imagem.

---

## 5. Publicar a API de chamados

```powershell
cd C:\Users\Pablo\Desktop\chamados
.\deploy\deploy-cloudrun.ps1 -ProjectId SEU-PROJETO -SecretsFile deploy\secrets.env
```

O script, em ordem: habilita as APIs, cria o repositorio de imagens, sobe os
segredos, builda e publica a imagem, roda `prisma migrate deploy` como **Cloud Run
Job** e so entao publica o servico. No fim faz health check e imprime a URL.

Passos uteis:

```powershell
# so o servico, sem refazer build nem migracao
.\deploy\deploy-cloudrun.ps1 -ProjectId SEU-PROJETO -SkipMigrations

# logs
gcloud run services logs tail sci-chamados-api --region us-west1
```

### Por que as migrations rodam separadas

O `render.yaml` roda `prisma migrate deploy` dentro do `buildCommand`. Numa imagem
isso e ruim: o build passa a depender do banco de producao e a imagem deixa de
ser reproduzivel. Aqui as migrations viram um Job, com a mesma imagem, logo antes
do deploy. O script **aborta** se o Job falhar, para nao subir servico com schema
desatualizado.

### O cron interno nao muda de comportamento (ainda)

`src/index.ts` roda `autoSyncInventario` e a limpeza de anexos por `setInterval`
de 6h, e dispara 5s apos o boot. No Cloud Run com `--min-instances 0` a instancia
e congelada entre requisicoes, entao nao existe "a cada 6h": o sync passa a
rodar a cada cold start, e a cada 6h enquanto a instancia estiver acordada.

Para uso escolar isso costuma bastar (o sistema acorda varias vezes por dia), e
**e exatamente o que ja acontecia no Render free**, que tambem dormia apos 15 min
de inatividade. Para garantia de 6h cravado, o caminho e mover esses dois jobs
para um agendador externo. A rota `POST /api/inventario/sync` ja existe e chama
`syncInventario`, mas exige `requireRole('ADMIN')` com JWT da aplicacao — o Cloud
Scheduler manda token do Google, nao JWT. Entao seria preciso um endpoint
dedicado protegido por um segredo, o que **nao foi feito aqui** para nao mexer no
codigo do app sem sua aprovacao.

---

## 6. Migrar o SCE

O SCE e bem mais simples: sem Prisma, sem migrations, sem build step. O
`server.js` e JS puro e so precisa de 4 segredos e 2 variaveis.

```powershell
cd C:\Users\Pablo\Desktop\sce
Copy-Item deploy\secrets.example.env deploy\secrets.env
Copy-Item deploy\env-producao.example.yaml deploy\env-producao.yaml
.\deploy\deploy-sce.ps1 -ProjectId portal-ure -SecretsFile deploy\secrets.env
```

### Nao precisa levar as credenciais do Google

`GOOGLE_PRIVATE_KEY`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PROJECT_ID` e os
`SPREADSHEET_*_ID` **nao sao usados pelo container**. O `googleSheetsService.js` so
e importado pelos scripts locais (`migrate.js`, `find-duplicados.js`,
`diagnostico-migracao.js`), e nao pelo `server.js` — o export `sheets` que o
servidor importa vem do `supabaseService.js` e e apenas um wrapper sobre o
Supabase. Isso economiza a `GOOGLE_PRIVATE_KEY`, que e multilinha e quebra em
`--set-env-vars`.

### Os dois valores que precisam bater com o backend de chamados

- `SSO_SECRET` **igual** ao `JWT_SECRET`. O `server.js:80` faz
  `jwt.verify(token, SSO_SECRET)` sobre o access token emitido pelo backend de
  chamados. Se divergir, o login no portal funciona mas toda chamada ao SCE
  volta 401 — falha bem confusa de diagnosticar.
- `SCE_SYNC_KEY` igual ao `SCE_SYNC_KEY` de la (e o header do sync de usuarios).

### NODE_ENV precisa ser explicito

O `server.js:1627` tem default `'development'`. Sem `NODE_ENV=production` no
`env-producao.yaml`, a API sobe em modo de desenvolvimento sem aviso.

### Cutover do SCE

No `sce/vercel.json` a linha 8 hoje aponta para o Render:

```json
{ "source": "/api/(.*)", "destination": "https://sce-nyjc.onrender.com/api/$1" }
```

Troque o destino pela URL que o script imprimir. **Nao fiz essa edicao** porque a
URL so existe depois do deploy.

Se o `VITE_API_SCE_URL` do portal aponta direto para o host antigo do Render
(instead de passar pelo `sce-ebon.vercel.app`, que faz o proxy), atualize e
**refaca o deploy do portal** — o Vite congela a variavel no build.

---

## 7. Cutover

1. Anote a URL do Cloud Run, algo como
   `https://sci-chamados-api-xxxx-uc.a.run.app`.
2. No Vercel, **Settings > Environment Variables** do `portal`:
   `VITE_API_CHAMADOS_URL` = `https://sci-chamados-api-xxxx-uc.a.run.app/api`
3. **Dispare um novo deploy do portal.** Isso nao e opcional: o Vite congela
   `import.meta.env` no bundle em tempo de build
   (`src/api/http.ts:14`). Salvar a variavel sem rebuild nao muda o JS publicado.
4. Teste o login em um navegador limpo. Confirme que da para autenticar e que
   `/health` responde `ok`.
5. So agora desligue o servico no Render. Se algo quebrar, volte a
   `VITE_API_CHAMADOS_URL` para `https://sci-chamados-api.onrender.com/api` e
   redeploye o portal — o banco nunca mudou, entao o rollback e imediato.

Sugestao de seguranca: deixe o Render no ar por **um dia util** em paralelo. Os
dois pointed para o mesmo Supabase, entao rodar os dois ao mesmo tempo e seguro
(e o `sync` do inventario pode disparar nos dois, o que e idempotente).

---

## 8. Custos e limites

Always-free do Cloud Run, por mes: 2M requisicoes, 180.000 vCPU-segundos,
360.000 GB-segundos, 1 GB de saida daAmerica do Norte.

O ponto que costuma estourar e `--min-instances 1`: uma instancia sempre ligada
consome ~2,6 milhoes de vCPU-segundos por mes, quase 15x a cota gratuita. Por
isso o script usa `--min-instances 0`. Se voce aceitar pagar para nao ter cold
start, o preco real fica em torno de US$ 7 a 18 por mes, dependendo do CPU
alocado.

**Orcamento:** um alerta de orcamento so avisa por e-mail, nao trava a conta. Para
um teto de verdade, crie uma funcao que disable o billing por cima do limite, ou
simplesmente use o alerta como sinal para agir. Sem cartao cadastrado, o servico
fica sem acesso a rede para saida — o que, para uma API interna, e uma trava
segura por acidente.

---

## 9. Pendencias conhecidas

- **Os Dockerfiles nao foram buildados localmente** — nao havia Docker instalado na
  sua maquina. A logica de build (ordem do `shared/types`, junction, `prisma
  generate`, `npm ci --omit=dev`) foi conferida contra o repositorio, mas o
  primeiro build real vai ser o de verdade. Se o `prisma generate` reclamar de
  `DATABASE_URL`, o stage de build ja tem um placeholder para isso.
- `deploy/secrets.env` e `deploy/env-producao.yaml` estao no `.gitignore` do
  repo. Confirme antes do primeiro `git add -A`.
- Se voce decidir nao usar Cloud Run, o Dockerfile serve para Fly.io, Railway ou
  qualquer plataforma com build de container, sem mudanca.
