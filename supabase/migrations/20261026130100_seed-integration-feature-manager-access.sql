-- SPEC 15 (Hub de Integrações) — R15-1, achado bloqueante da revisão.
--
-- A feature `integration` (FEATURE_SLUGS.CONFIGURATION) foi seedada só com
-- MASTER=FULL (prisma/seed-backoffice-products.ts). Enquanto a página de
-- Integrações era gate por `lib/integrationsAccess.ts` (lista fixa de times,
-- sem checar papel), isso não importava. Ao remover a lista e passar a
-- depender só de `hasAccess("integration")`, qualquer membro não-master com
-- papel MANAGER perde acesso — inclusive nos 3 times legados, e mesmo sendo
-- o papel que as rotas de backend (`requireManager` em
-- app/api/v1/integrations/webhooks/route.ts e
-- app/api/v1/integrations/studio-webhook/route.ts) já exigem para operar
-- webhooks e o token do webhook legado.
--
-- Esta migration concede FULL também para o principal MANAGER, alinhando a
-- regra de acesso da feature com quem o backend já autoriza a operar
-- Webhooks/Integrações. Não estende a OPERATOR/SDR/CLOSER/BACKOFFICE porque
-- essas rotas continuam exigindo `role === "manager"` — dar acesso ao card
-- sem poder usar as ações criaria um novo estado enganoso (achado R15-7).
--
-- Idempotente: reaplicar não duplica nem reverte nenhuma outra regra.

DO $$
DECLARE
  v_feature_id uuid;
BEGIN
  SELECT id INTO v_feature_id
  FROM "public"."backoffice_features"
  WHERE "slug" = 'integration';

  IF v_feature_id IS NOT NULL THEN
    INSERT INTO "public"."backoffice_feature_access_rules"
      ("id", "featureId", "principal", "accessLevel", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid(), v_feature_id, 'MANAGER', 'FULL', now(), now())
    ON CONFLICT ("featureId", "principal")
    DO UPDATE SET "accessLevel" = 'FULL', "updatedAt" = now();
  END IF;
END $$;
