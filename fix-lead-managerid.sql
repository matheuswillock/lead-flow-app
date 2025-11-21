-- Script para corrigir o managerId do lead existente
-- Execute este comando no Prisma Studio ou diretamente no PostgreSQL

UPDATE "Lead"
SET "managerId" = 'c29cca1e-830f-4ab2-af5c-0df884a479ef'
WHERE "id" = 'd29c9f63-ea75-441c-a524-2caeecd5deaa';

-- Verificar se foi atualizado
SELECT 
  id,
  name,
  "managerId",
  "createdBy",
  "assignedTo"
FROM "Lead"
WHERE id = 'd29c9f63-ea75-441c-a524-2caeecd5deaa';
