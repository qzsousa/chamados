-- A senha atual foi gerada pela Matriz e precisa ser trocada no primeiro login.
--
-- Coluna separada de `primeiroLogin` porque as duas perguntas são diferentes:
-- "esta pessoa já definiu senha?" e "esta senha é definitiva?". Com o DEFAULT
-- false, nenhum usuário existente muda de comportamento — a senha de quem já
-- tem senha definitiva continua definitiva.
ALTER TABLE "Usuario" ADD COLUMN "senhaProvisoria" BOOLEAN NOT NULL DEFAULT false;

-- Índice para quem a Matriz precisa achar: os usuários com senha provisória.
CREATE INDEX "Usuario_senhaProvisoria_idx" ON "Usuario" ("senhaProvisoria") WHERE "senhaProvisoria" = true;