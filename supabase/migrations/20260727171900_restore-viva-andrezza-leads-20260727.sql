-- Restore 7 leads agendados Andrezza Jesus / Viva Seguros (incidente hard-delete backoffice).
-- Fontes: EmailLog closer_schedule_notification + Resend get-email + notifications MEETING_REMINDER
--   (tmp/recovery/viva-andrezza-leads-agendados-recuperados-20260727.csv)
-- teamId=a1b2c3d4-0001-4000-8000-000000000001
-- assignedTo=Andrezza Jesus (34d5a729-8a6b-4412-8cf4-6b0003e7e6bc, conta recriada 2026-07-27)
-- closer=Pedro Falcão (a3983ca7-5f03-4e34-a252-34966166750b)
-- Telefone: indisponível no template Resend antigo.
-- Idempotente: ON CONFLICT (leadCode) DO NOTHING; schedule por leadId único.

DO $$
DECLARE
  v_team uuid := 'a1b2c3d4-0001-4000-8000-000000000001';
  v_closer uuid := 'a3983ca7-5f03-4e34-a252-34966166750b';
  v_sdr uuid := '34d5a729-8a6b-4412-8cf4-6b0003e7e6bc';
  v_manager uuid;
  v_lead_id uuid;
BEGIN
  SELECT "masterId" INTO v_manager FROM "public"."corretor_studio_teams" WHERE id = v_team AND "deletedAt" IS NULL;
  IF v_manager IS NULL THEN
    RAISE NOTICE 'Team Viva Seguros não encontrado — skip restore';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "public"."corretor_studio_profiles"
    WHERE id = v_closer AND "deletedAt" IS NULL
  ) THEN
    v_closer := NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "public"."corretor_studio_profiles"
    WHERE id = v_sdr AND "deletedAt" IS NULL
  ) THEN
    v_sdr := NULL;
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt", "deletedAt", "deletedByProfileId"
  ) VALUES (
    '6cda2a94-be4e-4873-978e-a624cd5c9c64'::uuid,
    'M936194R',
    'Marcio Peixoto Da Silva Junior',
    'mpeixotojr@gmail.com',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    v_sdr,
    v_closer,
    'Reunião agendada com Marcio Peixoto Da Silva Junior
[restore:EmailLog+Resend 20260727]',
    'Reunião agendada com Marcio Peixoto Da Silva Junior',
    'Estudo Plano de Saúde: Marcio Peixoto Da Silva Junior',
    'https://meet.google.com/sbx-dbxx-ggi',
    'online',
    NULL,
    ('2026-07-13 15:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '2026-07-08T14:18:07.496+00'::timestamptz,
    now(),
    '2026-07-08T14:18:07.496+00'::timestamptz,
    NULL,
    NULL
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'M936194R';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-07-13 15:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/sbx-dbxx-ggi',
      'Estudo Plano de Saúde: Marcio Peixoto Da Silva Junior',
      'online',
      'Reunião agendada com Marcio Peixoto Da Silva Junior',
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt", "deletedAt", "deletedByProfileId"
  ) VALUES (
    '78df9d2b-6c35-4f17-ade9-1d99b2c7369f'::uuid,
    'S7021A',
    'Sheila Cristina Saturnino Da Silva',
    'sheila_sat@yahoo.com.br',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    v_sdr,
    v_closer,
    'Reunião agendada com Sheila Cristina Saturnino Da Silva
[restore:EmailLog+Resend 20260727]',
    'Reunião agendada com Sheila Cristina Saturnino Da Silva',
    'Estudo Plano de Saúde: Sheila Cristina Saturnino Da Silva',
    'https://meet.google.com/ehq-edac-zgu',
    'online',
    NULL,
    ('2026-07-13 10:30:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '2026-07-10T14:19:58.905+00'::timestamptz,
    now(),
    '2026-07-10T14:19:58.905+00'::timestamptz,
    NULL,
    NULL
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'S7021A';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-07-13 10:30:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/ehq-edac-zgu',
      'Estudo Plano de Saúde: Sheila Cristina Saturnino Da Silva',
      'online',
      'Reunião agendada com Sheila Cristina Saturnino Da Silva',
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt", "deletedAt", "deletedByProfileId"
  ) VALUES (
    'e5b91cba-76d9-4353-a4c0-a5bc42612953'::uuid,
    'C71388A',
    'Caio Slaviero Da Cunha',
    'caioslaviero@gmail.com',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    v_sdr,
    v_closer,
    'Reunião agendada com Caio Slaviero Da Cunha
[restore:EmailLog+Resend 20260727]',
    'Reunião agendada com Caio Slaviero Da Cunha',
    'Estudo Plano de Saúde: Caio Slaviero Da Cunha',
    'https://meet.google.com/skc-gvim-waw',
    'online',
    NULL,
    ('2026-07-13 17:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '2026-07-10T16:48:25.693+00'::timestamptz,
    now(),
    '2026-07-10T16:48:25.693+00'::timestamptz,
    NULL,
    NULL
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'C71388A';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-07-13 17:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/skc-gvim-waw',
      'Estudo Plano de Saúde: Caio Slaviero Da Cunha',
      'online',
      'Reunião agendada com Caio Slaviero Da Cunha',
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt", "deletedAt", "deletedByProfileId"
  ) VALUES (
    'e5aa979b-e24c-4274-9e11-fc154e730e17'::uuid,
    'M347913I',
    'Maria Aparecida Loia Ferrari',
    'cidinhaferrari@gmail.com',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    v_sdr,
    v_closer,
    'Reunião agendada com Maria Aparecida Loia Ferrari
[restore:EmailLog+Resend 20260727]',
    'Reunião agendada com Maria Aparecida Loia Ferrari',
    'Estudo Plano de Saúde: Maria Aparecida Loia Ferrari',
    'https://meet.google.com/gda-fibp-gas',
    'online',
    NULL,
    ('2026-07-14 10:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '2026-07-13T13:30:13.525+00'::timestamptz,
    now(),
    '2026-07-13T13:30:13.525+00'::timestamptz,
    NULL,
    NULL
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'M347913I';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-07-14 10:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/gda-fibp-gas',
      'Estudo Plano de Saúde: Maria Aparecida Loia Ferrari',
      'online',
      'Reunião agendada com Maria Aparecida Loia Ferrari',
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt", "deletedAt", "deletedByProfileId"
  ) VALUES (
    '1993369b-83e6-4691-87a7-e3cb160b0eaf'::uuid,
    'A41770I',
    'Anelisa De Souza Frateschi',
    'anelisafrateschi@hotmail.com',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    v_sdr,
    v_closer,
    'Horário final após reagendamento (original 14:00).
[restore:EmailLog+Resend 20260727]',
    'Reunião agendada com Anelisa De Souza Frateschi',
    'Estudo Plano de Saúde: Anelisa De Souza Frateschi',
    'https://meet.google.com/jtr-vsnu-hfg',
    'online',
    NULL,
    ('2026-07-14 15:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '2026-07-13T16:59:18.084+00'::timestamptz,
    now(),
    '2026-07-13T16:59:18.084+00'::timestamptz,
    NULL,
    NULL
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'A41770I';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-07-14 15:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/jtr-vsnu-hfg',
      'Estudo Plano de Saúde: Anelisa De Souza Frateschi',
      'online',
      'Reunião agendada com Anelisa De Souza Frateschi',
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt", "deletedAt", "deletedByProfileId"
  ) VALUES (
    '30820e71-528b-43b1-be46-534aa108cc15'::uuid,
    'A882288Z',
    'Anderson Dos Santos Cruz',
    'anderson@advogadoscruz.com.br',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    v_sdr,
    v_closer,
    'Horário final via reminder (reagendamento 20/07 teve EmailLog failed sem Resend). Original: 20/07 15:00.
[restore:EmailLog+Resend 20260727]',
    'Reunião agendada com Anderson Dos Santos Cruz',
    'Estudo Plano de Saúde: Anderson Dos Santos Cruz',
    'https://meet.google.com/mnc-xded-nwg',
    'online',
    NULL,
    ('2026-07-21 15:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '2026-07-17T13:03:32.725+00'::timestamptz,
    now(),
    '2026-07-17T13:03:32.725+00'::timestamptz,
    NULL,
    NULL
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'A882288Z';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-07-21 15:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/mnc-xded-nwg',
      'Estudo Plano de Saúde: Anderson Dos Santos Cruz',
      'online',
      'Reunião agendada com Anderson Dos Santos Cruz',
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt", "deletedAt", "deletedByProfileId"
  ) VALUES (
    'c6bfeb9f-77a8-4703-a8ea-cf2025ad12b8'::uuid,
    'F492022A',
    'Flavio Sergio De Paula',
    'flaviodepaulla@hotmail.com',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    v_sdr,
    v_closer,
    'Horário final via reminder (reagendamento EmailLog failed). Original Resend: 20/07 16:30.
[restore:EmailLog+Resend 20260727]',
    'Reunião agendada com Flavio Sergio De Paula',
    'Estudo Plano de Saúde: Flavio Sergio De Paula',
    'https://meet.google.com/aed-jwgf-xoa',
    'online',
    NULL,
    ('2026-07-20 15:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '2026-07-17T15:36:28.670+00'::timestamptz,
    now(),
    '2026-07-17T15:36:28.670+00'::timestamptz,
    NULL,
    NULL
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'F492022A';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-07-20 15:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/aed-jwgf-xoa',
      'Estudo Plano de Saúde: Flavio Sergio De Paula',
      'online',
      'Reunião agendada com Flavio Sergio De Paula',
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  RAISE NOTICE 'Restore Viva/Andrezza concluído (7 leads agendados)';
END $$;
