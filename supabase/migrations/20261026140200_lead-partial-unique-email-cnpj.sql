-- SPEC 11, D41 (decidida em 26/10): o webhook v2 precisa criar um lead novo para um contato cujo lead
-- anterior já saiu de "nova oportunidade"/"agendado" (perdido, no show, finalizado etc.). Os uniques
-- (teamId, email) e (teamId, cnpj) eram totais, criados na baseline sem filtro, e bloqueavam isso,
-- inclusive por lead na lixeira (índice incluía deletedAt).
--
-- Passam a valer só entre leads NÃO deletados que ainda estão "em aberto" para o contato:
--   status IS NULL (rascunho), 'new_opportunity' ou 'scheduled'.
-- Continua impossível ter dois leads ativos com o mesmo e-mail/CNPJ no mesmo time.
--
-- Atenção (revisão do SQL do `db:migrate:from-prisma`): o Prisma não modela índice único parcial; o
-- schema.prisma só declara índices comuns. Um diff futuro vai propor DROP destes índices; remova.
--
-- Efeito colateral conhecido: reabrir um lead antigo (ex.: no_show -> scheduled) enquanto existe outro
-- lead ativo com o mesmo e-mail/CNPJ agora viola o índice (P2002). A UI deve tratar com mensagem clara.
--
-- Dados existentes: o unique total já garantia unicidade, que é um superconjunto da regra nova; a
-- criação dos índices parciais não pode falhar por dado existente.
-- Rollback: DROP dos 2 índices parciais e recriar os uniques totais abaixo (falha se já houver duplicata
-- criada depois desta migration; nesse caso resolver as duplicatas antes).
--   CREATE UNIQUE INDEX "corretor_studio_leads_teamId_email_key" ON "public"."corretor_studio_leads" ("teamId", "email");
--   CREATE UNIQUE INDEX "corretor_studio_leads_teamId_cnpj_key"  ON "public"."corretor_studio_leads" ("teamId", "cnpj");

DROP INDEX IF EXISTS "public"."corretor_studio_leads_teamId_email_key";
DROP INDEX IF EXISTS "public"."corretor_studio_leads_teamId_cnpj_key";

CREATE UNIQUE INDEX "corretor_studio_leads_teamId_email_open_key"
  ON "public"."corretor_studio_leads" ("teamId", "email")
  WHERE "deletedAt" IS NULL AND ("status" IS NULL OR "status" IN ('new_opportunity', 'scheduled'));

CREATE UNIQUE INDEX "corretor_studio_leads_teamId_cnpj_open_key"
  ON "public"."corretor_studio_leads" ("teamId", "cnpj")
  WHERE "deletedAt" IS NULL AND ("status" IS NULL OR "status" IN ('new_opportunity', 'scheduled'));

-- Os índices comuns (teamId, email) e (teamId, cnpj) do schema.prisma servem a busca de duplicata.
CREATE INDEX IF NOT EXISTS "corretor_studio_leads_teamId_email_idx" ON "public"."corretor_studio_leads" ("teamId", "email");
CREATE INDEX IF NOT EXISTS "corretor_studio_leads_teamId_cnpj_idx" ON "public"."corretor_studio_leads" ("teamId", "cnpj");
