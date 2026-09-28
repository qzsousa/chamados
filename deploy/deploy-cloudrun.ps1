<#
.SYNOPSIS
  Publica o sci-chamados-api no Google Cloud Run, sem tocar no Render.

.DESCRIPTION
  Ordem: APIs -> Artifact Registry -> imagem -> migracoes (Job) -> servico.
  O Render continua configurado: nada aqui altera o render.yaml, e o servico
  pode continuar no ar durante a migracao (o banco e o mesmo Supabase dos dois,
  entao da para validar o Cloud Run antes de desligar o Render).

  O regiao padrao e us-west1 de proposito: o pooler do seu Supabase fica em
  us-west-2. Ficar na mesma costa do Pacifico evita uma ida e volta pela rede.

.PARAMETER ProjectId
  ID do projeto do Google Cloud (o que aparece no console, nao o "nome").

.PARAMETER Region
  Padrao us-west1. Ver o comentario acima.

.EXAMPLE
  ./deploy-cloudrun.ps1 -ProjectId meu-projeto -SecretsFile deploy/secrets.env

.EXAMPLE
  Rodar sem mexer nos segredos (eles ja estao no Secret Manager):
  ./deploy-cloudrun.ps1 -ProjectId meu-projeto
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [string]$Region      = 'us-west1',
  [string]$Service     = 'sci-chamados-api',
  [string]$Repository  = 'sci-chamados',
  [string]$EnvFile     = 'deploy/env-producao.yaml',
  [string]$SecretsFile = '',
  [string]$Tag         = '',
  [switch]$SkipMigrations
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }
function Die($msg)  { Write-Host "    ERRO: $msg" -ForegroundColor Red; exit 1 }

# --- pre-requisitos --------------------------------------------------------
Step 'Verificando ferramentas'
foreach ($bin in @('gcloud', 'docker')) {
  if (-not (Get-Command $bin -ErrorAction SilentlyContinue)) { Die "'$bin' nao encontrado no PATH." }
}
if (-not $Tag) { $Tag = (Get-Date -Format 'yyyyMMdd-HHmmss') }
Ok "gcloud e docker ok. Tag: $Tag"

gcloud config set project $ProjectId | Out-Null
gcloud config set run/region $Region   | Out-Null

# --- 1. APIs ---------------------------------------------------------------
Step 'Habilitando APIs do Google Cloud'
foreach ($api in @('run.googleapis.com', 'artifactregistry.googleapis.com',
                   'cloudbuild.googleapis.com', 'secretmanager.googleapis.com')) {
  gcloud services enable $api --quiet 2>$null
}
Ok 'APIs habilitadas'

# --- 2. Artifact Registry --------------------------------------------------
$Registry = "$Region-docker.pkg.dev"
$RepoPath = "$ProjectId/$Repository"

Step 'Garantindo o repositorio de imagens'
$exists = gcloud artifacts repositories describe $RepoPath --location $Region --format='value(name)' 2>$null
if (-not $exists) {
  gcloud artifacts repositories create $Repository `
    --repository-format docker --location $Region `
    --description 'Imagens do sci-chamados-api' --quiet | Out-Null
  Ok "repositorio $Repository criado"
} else {
  Ok "repositorio $Repository ja existe"
}

$Image = "$Registry/$RepoPath/${Service}:$Tag"

# --- 3. Segredos -----------------------------------------------------------
$SecretEnvVars = @(
  'DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET',
  'SUPABASE_SERVICE_KEY', 'GOOGLE_SERVICE_ACCOUNT_JSON',
  'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS',
  'BREVO_API_KEY', 'SCE_SYNC_KEY', 'SENTRY_DSN'
)

if ($SecretsFile) {
  $resolved = if ([IO.Path]::IsPathRooted($SecretsFile)) { $SecretsFile } else { Join-Path $RepoRoot $SecretsFile }
  if (-not (Test-Path $resolved)) { Die "SecretsFile nao encontrado: $resolved" }

  Step 'Criando/atualizando segredos no Secret Manager'
  foreach ($line in Get-Content $resolved) {
    if ($line -match '^\s*(#|$)') { continue }
    $parts = $line -split '=', 2
    if ($parts.Count -ne 2) { continue }
    $key = $parts[0].Trim()
    $val = $parts[1].Trim()
    if (-not $val) { Warn "$key vazio no arquivo, pulando"; continue }
    if ($key -notin $SecretEnvVars) { Warn "$key nao esta na lista conhecida, pulando"; continue }

    $kebab = ($key -creplace '([a-z0-9])([A-Z])', '$1-$2').ToLower()
    $name = "chamados-$kebab"

    # --data-file=- le o payload do stdin. O proprio gcloud faz a base64,
    # entao mandamos o valor em texto puro (evita dupla codificacao).
    if (gcloud secrets describe $name --location $Region 2>$null) {
      $val | gcloud secrets versions add $name --data-file=- --location $Region --quiet | Out-Null
    } else {
      gcloud secrets create $name --replication-policy automatic --location $Region --quiet | Out-Null
      $val | gcloud secrets versions add $name --data-file=- --location $Region --quiet | Out-Null
    }
    Ok "secret $name atualizado"
  }
}

# Monta --set-secrets apontando para "latest" de cada segredo que existir.
$secretFlags = @()
foreach ($key in $SecretEnvVars) {
  $kebab = ($key -creplace '([a-z0-9])([A-Z])', '$1-$2').ToLower()
  $name = "chamados-$kebab"
  if (gcloud secrets describe $name --location $Region 2>$null) {
    $secretFlags += "$key=${name}:latest"
  }
}
if ($secretFlags.Count -eq 0) { Die 'Nenhum segredo encontrado no Secret Manager. Crie-os ou use -SecretsFile.' }
Ok "$($secretFlags.Count) segredo(s) seront injetados"

# --- 4. Imagem -------------------------------------------------------------
Step 'Build da imagem (contexto = raiz do repo)'
Push-Location $RepoRoot
try {
  docker build -f Dockerfile -t $Image .
  if ($LASTEXITCODE -ne 0) { Die 'docker build falhou.' }
  docker push $Image
  if ($LASTEXITCODE -ne 0) { Die 'docker push falhou.' }
  Ok "imagem publicada: $Image"
} finally { Pop-Location }

# --- 5. Migracoes (Job) ----------------------------------------------------
# Rodam aqui, e nao no build da imagem, para que a imagem nao precise de acesso
# ao banco e o deploy continue reproduzivel.
if (-not $SkipMigrations) {
  Step 'Rodando migrations (prisma migrate deploy) como Cloud Run Job'
  $job = 'chamados-migrate'
  $jobExists = gcloud run jobs describe $job --region $Region 2>$null

  $envFileArg = @()
  if ($EnvFile -and (Test-Path (Join-Path $RepoRoot $EnvFile))) {
    $envFileArg = @('--set-env-vars-file', $EnvFile)
    Ok "usando $EnvFile"
  }

  if ($jobExists) {
    gcloud run jobs update $job --image $Image --region $Region --command 'prisma migrate deploy' `
      --set-secrets ($secretFlags -join ',') @envFileArg --quiet | Out-Null
  } else {
    gcloud run jobs create $job --image $Image --region $Region `
      --command 'prisma migrate deploy' --set-secrets ($secretFlags -join ',') `
      @envFileArg --quiet | Out-Null
  }
  gcloud run jobs run $job --region $Region --wait
  if ($LASTEXITCODE -ne 0) { Die 'Job de migracao falhou. Nao continue: o servico pode estar com schema desatualizado.' }
  Ok 'migrations aplicadas'
}

# --- 6. Servico ------------------------------------------------------------
Step 'Publicando o servico'
$envFileArg2 = @()
if ($EnvFile -and (Test-Path (Join-Path $RepoRoot $EnvFile))) {
  $envFileArg2 = @('--set-env-vars-file', $EnvFile)
}

gcloud run deploy $Service `
  --image $Image `
  --region $Region `
  --platform managed `
  --allow-unauthenticated `
  --port 8080 `
  --cpu 1 `
  --memory 512Mi `
  --concurrency 80 `
  --min-instances 0 `
  --max-instances 10 `
  --no-cpu-throttling `
  --startup-probe 'httpGet.path=/health,httpGet.port=8080,initialDelaySeconds=0,periodSeconds=5,timeoutSeconds=5,failureThreshold=12' `
  --set-secrets ($secretFlags -join ',') `
  @envFileArg2 `
  --quiet

if ($LASTEXITCODE -ne 0) { Die 'gcloud run deploy falhou.' }

$url = (gcloud run services describe $Service --region $Region --format='value(status.url)' 2>$null)
Ok "servico no ar: $url"

# --- 7. Validacao ----------------------------------------------------------
Step 'Health check'
$healthUrl = "$url/health"
$ok = $false
for ($i = 0; $i -lt 12; $i++) {
  Start-Sleep -Seconds 5
  try {
    $r = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 10
    if ($r.status -eq 'ok') {
      Ok "saudavel (banco: $($r.database))"
      $ok = $true
      break
    }
  } catch { }
}
if (-not $ok) { Warn "Ainda nao respondeu ok. Cold start do Prisma pode demorar; confira: gcloud run services logs tail $Service --region $Region" }

Write-Host "`n--- Proximos passos ------------------------------------------" -ForegroundColor Cyan
Write-Host "1. Aponte o portal para a nova API (Vercel > Settings > Env Vars):"
Write-Host "     VITE_API_CHAMADOS_URL = $url/api"
Write-Host "   O Vite congela essa variavel no BUILD: depois de salvar, faca um novo"
Write-Host "   deploy do portal (o redeploy sozinho do Vercel pode nao bastar)."
Write-Host "2. Valide o login em $url/api/auth/login antes de desligar o Render."
Write-Host "3. So desligue o servico do Render DEPOIS que o portal estiver usando a nova URL."
Write-Host "   (o banco e o mesmo Supabase nos dois, entao nao ha migracao de dados)"
Write-Host "4. O cron interno (sync de inventario a cada 6h) so roda com a instancia"
Write-Host "   acordada. No Cloud Run com min-instances 0 ele roda a cada cold start."
