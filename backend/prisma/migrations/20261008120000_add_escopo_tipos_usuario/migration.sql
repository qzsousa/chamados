-- AlterTable
-- Escopo de tipos de chamado por usuário.
--
-- Lista de "<chaveDaCategoria>::<rótulo da opção>" (ex.: 'sistemas::PortalNet').
-- VAZIO = SEM RESTRIÇÃO: é o comportamento de sempre, o usuário respeita
-- apenas o `filial` como antes. Por isso a coluna nasce com default e não é uma
-- tabela nova — nada muda para quem já está cadastrado.
ALTER TABLE "Usuario" ADD COLUMN     "escopoTipos" TEXT[] DEFAULT ARRAY[]::TEXT[];