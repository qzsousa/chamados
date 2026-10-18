-- Cor do usuário no portal, hex de 6 dígitos ("#3b82f6"). NULL = sem cor
-- definida: o portal usa a cor padrão do tema. Quem preenche é a tela de
-- edição do usuário no portal (ainda não existe — ver T-007).
--
-- A coluna nasce NULA para todo mundo: não há seed nem valor padrão, esta
-- migration só cria o campo.
ALTER TABLE "Usuario" ADD COLUMN "cor" TEXT;
