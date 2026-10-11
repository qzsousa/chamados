-- Rotas que o usuário pode alcançar. VAZIO = sem restrição (comportamento de
-- sempre, decidido só pelo nível). Preenchido, tudo fora da lista é 403.
--
-- É String[] e não uma tabela de relação porque a lista é curta, fixa e lida
-- inteira em toda requisição — no mesmo formato que `escopoTipos`, que já
-- funciona exatamente assim.
ALTER TABLE "Usuario" ADD COLUMN "rotasPermitidas" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "Usuario_rotasPermitidas_idx" ON "Usuario" USING GIN ("rotasPermitidas");