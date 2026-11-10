-- Acesso oculto da equipe Corretor Studio (Manager do backoffice) às contas dos clientes.
-- A linha em corretor_studio_team_members fica fora das listas de membros do cliente
-- e nunca entra na cobrança.
ALTER TABLE "public"."corretor_studio_team_members"
  ADD COLUMN IF NOT EXISTS "isSupportAccess" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "corretor_studio_team_members_teamId_isSupportAccess_idx"
  ON "public"."corretor_studio_team_members" ("teamId", "isSupportAccess");
