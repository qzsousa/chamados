# Checklist de Migração: Google Sheets → Supabase

## Pré-requisitos
- [ ] Service Account JSON com acesso às planilhas
- [ ] ID da planilha origem (`GOOGLE_SHEETS_ID`)
- [ ] Projeto Supabase criado com `DATABASE_URL`
- [ ] Prisma schema sincronizado (`npx prisma migrate deploy`)

---

## 1. Usuários (Aba: `Usuarios`)

**Campos origem:** email, nome, nivel, filial, status
**Campos destino:** User (com senha temporária + primeiroLogin=true)

- [ ] Ler todas as linhas da aba `Usuarios`
- [ ] Para cada usuário ativo:
  - [ ] Gerar senha temporária: `passwordPolicy.generateTemp()` (12 chars)
  - [ ] Hash com bcrypt (cost 12)
  - [ ] Inserir no Supabase com `primeiroLogin: true`
  - [ ] Registrar mapping: `email → senhaTemporaria` para entrega ao admin
- [ ] Validar: contagem origem = destino
- [ ] Entregar lista de senhas temporárias ao admin (console/log)

---

## 2. Escolas (Aba: `Escolas` ou lista hardcoded no Código.js)

**Campos origem:** nome, tecnico
**Campos destino:** Escola (nome, nomeNormalizado, tecnico)

- [ ] Ler lista de escolas (84 escolas do `NOMES_PADRONIZADOS`)
- [ ] Ler mapeamento escola→técnico (84 entradas do `LISTA_ESCOLAS_TECNICOS`)
- [ ] Para cada escola:
  - [ ] Normalizar nome: `normalizarNomeEscola(nome)`
  - [ ] Inserir no Supabase
- [ ] Validar: 84 escolas inseridas
- [ ] Validar: cada escola tem técnico mapeado

---

## 3. Equipamentos (Planilha externa: `ID_PLANILHA_INVENTARIO`, Aba: `Equipamentos`)

**Campos origem:** id, equipment_name/nome, category/categoria, brand/marca, model/modelo
**Campos destino:** Equipamento (categoria, marca, modelo)

- [ ] Conectar na planilha externa via Google Sheets API
- [ ] Ler aba `Equipamentos`
- [ ] Detectar colunas (case-insensitive): id, nome, categoria, marca, modelo
- [ ] Para cada linha válida:
  - [ ] Inserir no Supabase (unique: categoria+marca+modelo)
- [ ] Validar: contagem linhas válidas = inseridos

---

## 4. Inventário (Planilha externa: `ID_PLANILHA_INVENTARIO`, Aba: `Base de Dados`)

**Campos origem:** Escola, Status do Inventário
**Campos destino:** Inventario (escolaId, status)

- [ ] Ler aba `Base de Dados`
- [ ] Para cada linha:
  - [ ] Normalizar nome da escola
  - [ ] Buscar `escolaId` no Supabase (match por nomeNormalizado ou substring)
  - [ ] Mapear status: "Concluído"→CONCLUIDO, "Em Andamento"→EM_ANDAMENTO, "Não Realizado"→NAO_REALIZADO
  - [ ] Upsert no Supabase
- [ ] Validar: escolas com inventário = linhas processadas

---

## 5. Chamados (Aba: `Chamados`)

**Campos origem:** ID, Timestamp, Unidade, Solicitante, Função, Tipo, Descrição, Urgência, Anexo, Status, Responsável, Última Atualização, Histórico, Técnico Resolução
**Campos destino:** Chamado (todos os campos + tecnicoSetor + inventarioStatus)

- [ ] Ler aba `Chamados`
- [ ] Para cada linha:
  - [ ] Normalizar escola → buscar `tecnicoSetor` via mapeamento
  - [ ] Buscar `inventarioStatus` via escola normalizada
  - [ ] Converter status: "Aberto"→ABERTO, "Em andamento"→ANDAMENTO, "Comunicado"→COMUNICADO, "Resolvido"→RESOLVIDO
  - [ ] Inserir no Supabase (manter `protocolo` original como ID único)
- [ ] **Deduplicação** (mesma lógica Apps Script):
  - [ ] Chave: `unidade|descricao|solicitante|timestamp`
  - [ ] Manter primeira ocorrência
- [ ] Validar: contagem únicos origem ≈ destino

---

## 6. Validação Pós-Migração

- [ ] `SELECT COUNT(*) FROM Usuario` = usuários ativos na planilha
- [ ] `SELECT COUNT(*) FROM Escola` = 84
- [ ] `SELECT COUNT(*) FROM Equipamento` > 0
- [ ] `SELECT COUNT(*) FROM Inventario` = escolas com inventário
- [ ] `SELECT COUNT(*) FROM Chamado` = chamados únicos na planilha
- [ ] Spot-check: 5 chamados aleatórios - dados batem?
- [ ] Spot-check: 3 escolas - técnico/inventário batem?
- [ ] Login teste: admin com senha temporária → força troca → dashboard carrega

---

## 7. Rollback Plan

Se migração falhar:
1. `npx prisma migrate reset --force` (limpa BD)
2. Corrigir script
3. Re-executar

---

## Execução

```bash
# No backend/
npm run migration:run
# ou
npx ts-node src/services/migration.ts
```