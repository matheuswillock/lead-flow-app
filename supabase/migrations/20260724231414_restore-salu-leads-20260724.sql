-- Restore 36 leads Salu Seguros (incidente hard-delete).
-- Fontes: dump_20260618 + EmailLog/Resend + resend_export (tmp/recovery/salu-leads-agendados-recuperados-20260724.csv)
-- teamId=a94fc469-4603-487f-ab7f-e2712197d510; closer=Giovanna (3870aadb-8625-4184-ac60-c6e20be4cdc5); assignedTo=NULL (Bruna Molina removida).
-- Idempotente: ON CONFLICT (leadCode) DO NOTHING; schedule por leadId único.

DO $$
DECLARE
  v_team uuid := 'a94fc469-4603-487f-ab7f-e2712197d510';
  v_closer uuid := '3870aadb-8625-4184-ac60-c6e20be4cdc5';
  v_manager uuid;
  v_lead_id uuid;
BEGIN
  SELECT "masterId" INTO v_manager FROM "public"."corretor_studio_teams" WHERE id = v_team;
  IF v_manager IS NULL THEN
    RAISE NOTICE 'Team Salu não encontrado — skip restore';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_profiles" WHERE id = v_closer AND "deletedAt" IS NULL) THEN
    v_closer := NULL;
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    'ddb87811-0b85-4318-83f8-65938f191187'::uuid,
    'T6466O',
    'Thiago',
    'redebrasil2025@gmail.com',
    '21987644525',
    '49948103000177',
    'no_show'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'Disse que trabalha no hortifruti de manhã, e em uma imobiliária à tarde. ele é bem ocupado, disse que se tivesse cliente reagendaria a reunião. 
[restore:dump_20260618]',
    'Reunião agendada com Thiago ',
    'Estudo Plano de Saúde: Thiago',
    'https://meet.google.com/qki-ancj-uch',
    NULL,
    NULL,
    ('2026-06-01 17:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    'Unimed',
    800,
    'p.a da unimed- Barra da tijuca',
    'Não perguntei',
    '9:2,41:1',
    '2026-05-29T16:54:11.336+00'::timestamptz,
    '2026-06-02T19:29:40.123+00'::timestamptz,
    '2026-05-29T16:54:11.336+00'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'T6466O';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-06-01 17:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/qki-ancj-uch',
      'Estudo Plano de Saúde: Thiago',
      NULL,
      'Reunião agendada com Thiago ',
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    'f900987f-8286-45f7-924f-f1d68a4c8e99'::uuid,
    'J25197Z',
    'Janderson rodrigues ferraz',
    'jandersonferraz10@gmail.com',
    '21999226247',
    '23869602000185',
    'opportunityLost'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'Disse que fez alguma mudança interna tem 6 meses, falou sobre carência. parecia comprometido em entrar na reunião. 
[restore:dump_20260618]',
    'Reunião agendada com Janderson rodrigues ferraz ',
    'Estudo Plano de Saúde: Janderson',
    'https://meet.google.com/ofh-gpzr-qqm',
    'online',
    NULL,
    ('2026-06-02 18:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    'Paciente oncológico',
    NULL,
    'Bradesco',
    4000,
    'não inf',
    'não perg',
    '9:1,21:1,46:1,56:1',
    '2026-05-29T17:08:28.567+00'::timestamptz,
    '2026-06-12T17:50:31.74+00'::timestamptz,
    '2026-05-29T17:08:28.567+00'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'J25197Z';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-06-02 18:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/ofh-gpzr-qqm',
      'Estudo Plano de Saúde: Janderson',
      'online',
      'Reunião agendada com Janderson rodrigues ferraz ',
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    '2ecc36c8-f89d-4ea5-85a6-029c4a8cbffe'::uuid,
    'A399689O',
    'Andre Pereira Do Nascimento',
    'nascimentobistrobarra@gmail.com',
    '21964298381',
    '48693091000114',
    'new_opportunity'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'Mandei mensagem no Whatsapp pois a ligação caiu, ele informou que o cnpj usado no plano é o 13330434000100\na ligação caiu quando estávamos para agendar. 
[restore:dump_20260618]',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'Amil',
    1700,
    'barra D''or',
    'não perg',
    '9:1,46:1',
    '2026-05-29T17:34:59.098+00'::timestamptz,
    '2026-05-29T17:34:59.098+00'::timestamptz,
    '2026-05-29T17:34:59.098+00'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    '03603595-8de5-49ef-a73b-8ea93a261048'::uuid,
    'T1165A',
    'Thais lima',
    'thais_lima83@hotmail.com',
    '21994837302',
    '33676639000140',
    'no_show'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'SUL AMERICA, BRADESCO, AMIL 9:30 
[restore:dump_20260618]',
    NULL,
    'Estudo Plano de Saúde: Thais Lima',
    'https://meet.google.com/xhz-vokv-xob',
    NULL,
    NULL,
    ('2026-06-01 09:30:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    'Amil',
    2700,
    'nao tem ',
    'nao possui ',
    '9:2,41:1,46:1',
    '2026-05-29T20:02:13.554+00'::timestamptz,
    '2026-06-01T13:19:09.86+00'::timestamptz,
    '2026-05-29T20:02:13.554+00'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'T1165A';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-06-01 09:30:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/xhz-vokv-xob',
      'Estudo Plano de Saúde: Thais Lima',
      NULL,
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    'b62f0e7f-1708-4ec6-8d5d-752309b3eb26'::uuid,
    'A81595S',
    'Aline Mota Tostes',
    'alinetostes@hotmail.com',
    '21982117164',
    '34700074000152',
    'dps_agreement'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'LEAD DA SDR BRUNA
[restore:dump_20260618]',
    'Reunião agendada com Aline Mota Tostes',
    'Estudo Plano de Saúde: Aline Mota Tostes',
    'https://meet.google.com/ohw-kiyo-vtx',
    'online',
    'yes'::"MeetingHeald",
    ('2026-06-01 13:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    880,
    'Amil',
    NULL,
    '2026-06-25 03:00:00+00'::timestamptz,
    'Amil',
    1400,
    NULL,
    '-',
    NULL,
    '2026-06-01T13:15:46.034+00'::timestamptz,
    '2026-06-12T17:56:58.413+00'::timestamptz,
    '2026-06-01T13:15:46.034+00'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'A81595S';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-06-01 13:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/ohw-kiyo-vtx',
      'Estudo Plano de Saúde: Aline Mota Tostes',
      'online',
      'Reunião agendada com Aline Mota Tostes',
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    '4fd041b5-31b2-44f4-81ea-cad1b7ceb6a0'::uuid,
    'E6933O',
    'Enrico Mannocci Agovino',
    'enricomannocci@hotmail.com',
    '21997435299',
    '35171804000138',
    'opportunityLost'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'Cliente disse que está pagando caro\nSDR BRUNA
[restore:dump_20260618]',
    'Reunião agendada com Enrico Mannocci Agovino',
    'Estudo Plano de Saúde: Enrico Mannocci Agovino',
    'https://meet.google.com/iui-seox-dky',
    'online',
    NULL,
    ('2026-06-02 11:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    'Sem interesse no produto',
    NULL,
    'Amil',
    2500,
    'Vitória, Barra D''or',
    'Não',
    '9:2,31:1,41:1',
    '2026-06-01T15:27:07.983+00'::timestamptz,
    '2026-06-15T14:38:41.341+00'::timestamptz,
    '2026-06-01T15:27:07.983+00'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'E6933O';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-06-02 11:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/iui-seox-dky',
      'Estudo Plano de Saúde: Enrico Mannocci Agovino',
      'online',
      'Reunião agendada com Enrico Mannocci Agovino',
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    'd1050f31-e8c9-4338-bfc2-587541372b37'::uuid,
    'D1820O',
    'Diego cardoso',
    'diegocardoso.bmn@gmail.com',
    '21981830974',
    '39528134000115',
    'opportunityLost'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'Reunião agendada com Diego cardoso
[restore:EmailLog+Resend+dump_20260618]',
    'Reunião agendada com Diego cardoso',
    'Estudo Plano de Saúde: Diego cardoso',
    'https://meet.google.com/vpm-johj-auk',
    'online',
    NULL,
    ('2026-07-24 08:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    'sem interesse no produto',
    NULL,
    'Amil',
    1800,
    '-',
    '-',
    '11:1,14:1,36:1,47:1',
    '2026-06-04T13:29:04.723+00'::timestamptz,
    '2026-06-15T14:49:18.227+00'::timestamptz,
    '2026-06-04T13:29:04.723+00'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'D1820O';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-07-24 08:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/vpm-johj-auk',
      'Estudo Plano de Saúde: Diego cardoso',
      'online',
      'Reunião agendada com Diego cardoso',
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    '9594da77-a15b-4c72-8354-fd39ad0d6eec'::uuid,
    'R886672N',
    'Raimundo roldan',
    'raimundo.roldan@4allconsult.com.br',
    '21973519402',
    '33736804000102',
    'no_show'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'AGENDAMENTO FEIO PELA BRUNA 
[restore:dump_20260618]',
    'Reunião agendada com Raimundo roldan',
    'Estudo Plano de Saúde: Raimundo roldan',
    'https://meet.google.com/qyt-rkbq-dbs',
    'online',
    NULL,
    ('2026-06-08 16:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    'Amil',
    3000,
    '-',
    '-',
    '29:1,54:1,56:1',
    '2026-06-04T13:33:49.351+00'::timestamptz,
    '2026-06-15T14:39:58.996+00'::timestamptz,
    '2026-06-04T13:33:49.351+00'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'R886672N';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-06-08 16:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/qyt-rkbq-dbs',
      'Estudo Plano de Saúde: Raimundo roldan',
      'online',
      'Reunião agendada com Raimundo roldan',
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    'd7dcf9f9-2e8c-4112-8fd4-ef6ce981be72'::uuid,
    'A43898S',
    'Ana Paula De Sousa Teles',
    'diretoriabiotechnology@gmail.com',
    '21994271857',
    NULL,
    'no_show'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'EMPRESA BIOTECHNOLOGY COMERCIO DE PRODUTOS HOSPITALARES LTDA \ntelefone que atendeu: 2290-1280
[restore:dump_20260618]',
    NULL,
    'Estudo Plano de Saúde: Ana Paula De Sousa Teles',
    'https://meet.google.com/hfa-wguf-bnn',
    'online',
    NULL,
    ('2026-06-10 10:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    'Bradesco',
    5000,
    'Rede D''or',
    'Não',
    '30:2,55:1,58:1',
    '2026-06-09T21:25:22.805+00'::timestamptz,
    '2026-06-15T14:39:19.549+00'::timestamptz,
    '2026-06-09T21:25:22.805+00'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'A43898S';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-06-10 10:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/hfa-wguf-bnn',
      'Estudo Plano de Saúde: Ana Paula De Sousa Teles',
      'online',
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    'eba12a68-2e1c-47ae-8c43-991a89761392'::uuid,
    'F6664E',
    'Flavio Nobre',
    'contato@arcadialardeidosos.com.br',
    '21970243811',
    '28625064000105',
    'offerNegotiation'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'PLANO: \nFLÁVIA (FILHA)- EIRELLE \nFLÁVIO (MEI)\nIRLANDA (ESPOSA FLÁVIO) \nFABRÍCIO FILHO (VAI SER INCLUIDO NO PLANO DA ESPOSA EM UM SULAMÉRICA)\n------------------------------------\nAMIL- CNPJ DO FELIPE \nCOPART OU SEM COPART \nFELIPE (GENRO FLÁVIO)\nBENJAMIN \n------------------------------\nNOVA VISÃO:\nFLÁVIA- FELIPE- BENJAMIN EM UM PLANO : EIRELE -> \n\nFLÁVIO- IRLANDA: CNPJ- CLT \n---------------------------\ntotal do plano R$ 11.000,00 (COM FABRÍCIO) \n\nBRADESCO+ AMIL \n\nNACIONAL FLEX\n\nELE QUER DIVIDIR EM DUAS APÓLICES \nFLÁVIO- MORA NO ENG DE DENTRO\nFLÁVIA- FLAMENGO 
[restore:dump_20260618]',
    'Cliente quer um plano que não seja NACIONAL  e sim REGIONAL. Paciente gosta da rede Dor (não sei como escreve) ',
    'Estudo Plano de Saúde: Fl',
    'https://meet.google.com/ooc-wvmo-aoo',
    'online',
    'yes'::"MeetingHeald",
    ('2026-06-12 14:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    'Bradesco',
    11000,
    'rede Dor ',
    'Oncologia ',
    '3:1,32:1,39:2,64:1,73:1',
    '2026-06-11T14:53:13.262+00'::timestamptz,
    '2026-06-15T20:27:46.391+00'::timestamptz,
    '2026-06-11T14:53:13.262+00'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'F6664E';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-06-12 14:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/ooc-wvmo-aoo',
      'Estudo Plano de Saúde: Fl',
      'online',
      'Cliente quer um plano que não seja NACIONAL  e sim REGIONAL. Paciente gosta da rede Dor (não sei como escreve) ',
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    '61f9cafb-2983-47c2-9df1-a1fdecaeda4e'::uuid,
    'P599764A',
    'Patricia',
    'adm3dtrradiologia@gmail.com',
    '24988078324',
    '18674506000141',
    'offerNegotiation'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'Ela tem interesse em adquirir outro plano. 
[restore:dump_20260618]',
    'Pretende migrar de plano ',
    'Estudo Plano de Saúde: Patricia',
    'https://meet.google.com/inr-xhbx-hse',
    'online',
    'yes'::"MeetingHeald",
    ('2026-06-15 16:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    'Unimed',
    1671,
    'verificar ',
    'nao possui ',
    '30:2,40:2',
    '2026-06-15T15:15:39.006+00'::timestamptz,
    '2026-06-15T20:34:22.727+00'::timestamptz,
    '2026-06-15T15:15:39.006+00'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'P599764A';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-06-15 16:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/inr-xhbx-hse',
      'Estudo Plano de Saúde: Patricia',
      'online',
      'Pretende migrar de plano ',
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    'fe9b0807-fd4c-4354-8eec-5bc50cf4be74'::uuid,
    'C401035A',
    'CAROLINA',
    'carolinacastellobrancoribeiro@gmail.com',
    '21999190745',
    '47388138000173',
    'offerNegotiation'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'Cliente quer ADQUIRIR um plano acessível somente para ela. 
[restore:dump_20260618]',
    NULL,
    'Estudo Plano de Saúde: CA',
    'https://meet.google.com/aqp-bcit-xxg',
    'online',
    'yes'::"MeetingHeald",
    ('2026-06-15 15:30:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    'Bradesco',
    1500,
    'Rede D''or',
    'nao possui ',
    NULL,
    '2026-06-15T18:21:08.958+00'::timestamptz,
    '2026-06-15T20:32:04.362+00'::timestamptz,
    '2026-06-15T18:21:08.958+00'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'C401035A';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-06-15 15:30:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/aqp-bcit-xxg',
      'Estudo Plano de Saúde: CA',
      'online',
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    'c9f80c93-84fa-4ee9-b4d8-cdca2e0a9509'::uuid,
    'T595732O',
    'Tatyana Ambrosio Cantarino',
    'tatyanaambrosio@gmail.com',
    '21964255345',
    '46455107000125',
    'disqualified'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'VERIFICAR AS IDADES E A OPERADORA DO PLANO, A CLIENTE NÃO QUIS PASSAR NA LIGAÇÃO. 
[restore:dump_20260618]',
    NULL,
    'Estudo Plano de Saúde: Tatyana Ambrosio Cantarino',
    'https://meet.google.com/hzh-vzpk-dsx',
    'online',
    'yes'::"MeetingHeald",
    ('2026-06-18 15:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    'Outros',
    1400,
    'verificar ',
    NULL,
    '30:1,35:1,40:1',
    '2026-06-16T16:37:46.37+00'::timestamptz,
    '2026-06-18T18:16:54.532+00'::timestamptz,
    '2026-06-16T16:37:46.37+00'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'T595732O';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-06-18 15:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/hzh-vzpk-dsx',
      'Estudo Plano de Saúde: Tatyana Ambrosio Cantarino',
      'online',
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    '00527cf9-1fa2-4fe7-b075-09a5f97ae83e'::uuid,
    'F19437A',
    'Fernanda Franca Da Silva',
    'ffranca.advogados@gmail.com',
    '21968989808',
    '41105424000106',
    'no_show'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'Plano Silvestre Saúde (regional) 
[restore:dump_20260618]',
    'cliente não deseja trocar de plano',
    'Estudo Plano de Saúde: Fernanda Franca Da Silva',
    'https://meet.google.com/qyp-aybk-rss',
    'online',
    NULL,
    ('2026-06-17 15:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    'Outros',
    788,
    NULL,
    'nao possui ',
    '42:1',
    '2026-06-17T12:56:50.218+00'::timestamptz,
    '2026-06-18T19:45:24.495+00'::timestamptz,
    '2026-06-17T12:56:50.218+00'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'F19437A';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-06-17 15:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/qyp-aybk-rss',
      'Estudo Plano de Saúde: Fernanda Franca Da Silva',
      'online',
      'cliente não deseja trocar de plano',
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    gen_random_uuid(),
    'J695291O',
    'Juan Ricardo',
    'juandesouza.adv@gmail.com.br',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'Reunião agendada com Juan Ricardo
[restore:resend_export_emails_sent]',
    NULL,
    'Estudo Plano de Saúde: Juan Ricardo',
    'https://meet.google.com/nvs-bgbe-exx',
    NULL,
    NULL,
    ('2026-07-03 12:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '2026-06-25T13:28:01.680Z'::timestamptz,
    now(),
    '2026-06-25T13:28:01.680Z'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'J695291O';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-07-03 12:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/nvs-bgbe-exx',
      'Estudo Plano de Saúde: Juan Ricardo',
      NULL,
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    gen_random_uuid(),
    'S1870R',
    'Samyra Haidar',
    'brumolina0107@gmail.com',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'Participantes: lead=brumolina0107@gmail.com (mesmo e-mail do convite pendente Bruna)
[restore:resend_export_emails_sent]',
    NULL,
    'Estudo Plano de Saúde: Samyra Haidar',
    'https://meet.google.com/qgy-qqcp-nsh',
    NULL,
    NULL,
    ('2026-06-25 15:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '2026-06-25T14:28:47.527Z'::timestamptz,
    now(),
    '2026-06-25T14:28:47.527Z'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'S1870R';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-06-25 15:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/qgy-qqcp-nsh',
      'Estudo Plano de Saúde: Samyra Haidar',
      NULL,
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    gen_random_uuid(),
    'R559663S',
    'Ramon Dos Santos',
    'brunaleto2612@gmail.com',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'Reunião agendada com Ramon Dos Santos
[restore:resend_export_emails_sent]',
    NULL,
    'Estudo Plano de Saúde: Ramon Dos Santos',
    'https://meet.google.com/yzn-mbjg-upb',
    NULL,
    NULL,
    ('2026-07-03 15:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '2026-06-25T16:56:02.054Z'::timestamptz,
    now(),
    '2026-06-25T16:56:02.054Z'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'R559663S';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-07-03 15:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/yzn-mbjg-upb',
      'Estudo Plano de Saúde: Ramon Dos Santos',
      NULL,
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    gen_random_uuid(),
    'C81894A',
    'Carolina Pereira',
    'advcarolinapporto@gmail.com',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'Reunião agendada com Carolina Pereira
[restore:resend_export_emails_sent]',
    NULL,
    'Estudo Plano de Saúde: Carolina Pereira',
    'https://meet.google.com/bod-qwum-iwq',
    NULL,
    NULL,
    ('2026-06-30 10:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '2026-06-26T12:42:58.187Z'::timestamptz,
    now(),
    '2026-06-26T12:42:58.187Z'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'C81894A';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-06-30 10:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/bod-qwum-iwq',
      'Estudo Plano de Saúde: Carolina Pereira',
      NULL,
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    gen_random_uuid(),
    'S62343S',
    'Simone Campos Pereira Neves',
    'advssimone@gmail.com',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'Reunião agendada com Simone Campos Pereira Neves
[restore:resend_export_emails_sent]',
    NULL,
    'Estudo Plano de Saúde: Simone Campos Pereira Neves',
    'https://meet.google.com/yoy-xuyj-ssk',
    NULL,
    NULL,
    ('2026-06-26 13:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '2026-06-26T14:39:42.305Z'::timestamptz,
    now(),
    '2026-06-26T14:39:42.305Z'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'S62343S';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-06-26 13:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/yoy-xuyj-ssk',
      'Estudo Plano de Saúde: Simone Campos Pereira Neves',
      NULL,
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    gen_random_uuid(),
    'A9078S',
    'Andreia De Freitas',
    'andreiatarga.adv@gmail.com',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    '[restore:resend_export_emails_sent]',
    NULL,
    'Estudo Plano de Saúde: Andreia De Freitas',
    'https://meet.google.com/hmw-dwsr-fbu',
    NULL,
    NULL,
    ('2026-06-29 11:30:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '2026-06-26T16:14:02.477Z'::timestamptz,
    now(),
    '2026-06-26T16:14:02.477Z'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'A9078S';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-06-29 11:30:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/hmw-dwsr-fbu',
      'Estudo Plano de Saúde: Andreia De Freitas',
      NULL,
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    gen_random_uuid(),
    'P8274O',
    'Paulo Roberto',
    'joelmiranda.juridico@gmail.com',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'Reunião agendada com Paulo Roberto
[restore:resend_export_emails_sent]',
    NULL,
    'Estudo Plano de Saúde: Paulo Roberto',
    'https://meet.google.com/zdv-cfpu-fzg',
    NULL,
    NULL,
    ('2026-06-29 12:30:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '2026-06-27T13:39:23.235Z'::timestamptz,
    now(),
    '2026-06-27T13:39:23.235Z'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'P8274O';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-06-29 12:30:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/zdv-cfpu-fzg',
      'Estudo Plano de Saúde: Paulo Roberto',
      NULL,
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    gen_random_uuid(),
    'E308369E',
    'Elisangela Carderone',
    'carderonecorrea.adv@gmail.com',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'Nova adesão. Sem preferência rede hospitalar.
[restore:resend_export_emails_sent]',
    NULL,
    'Estudo Plano de Saúde: Elisangela Carderone',
    'https://meet.google.com/zqd-evsa-xvz',
    NULL,
    NULL,
    ('2026-07-06 10:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '2026-06-29T15:30:41.006Z'::timestamptz,
    now(),
    '2026-06-29T15:30:41.006Z'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'E308369E';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-07-06 10:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/zqd-evsa-xvz',
      'Estudo Plano de Saúde: Elisangela Carderone',
      NULL,
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    gen_random_uuid(),
    'R6504A',
    'Rita De Cassia',
    'luuh.marbar@gmail.com',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    '[restore:resend_export_emails_sent]',
    NULL,
    'Estudo Plano de Saúde: Rita De Cassia',
    'https://meet.google.com/pnb-khoo-kkg',
    NULL,
    NULL,
    ('2026-07-02 16:30:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '2026-07-02T13:26:25.456Z'::timestamptz,
    now(),
    '2026-07-02T13:26:25.456Z'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'R6504A';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-07-02 16:30:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/pnb-khoo-kkg',
      'Estudo Plano de Saúde: Rita De Cassia',
      NULL,
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    gen_random_uuid(),
    'A0827S',
    'Alan dos Santos',
    'alancorreia.adv@gmail.com',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'Reunião agendada com Alan dos Santos
[restore:resend_export_emails_sent]',
    NULL,
    'Estudo Plano de Saúde: Alan dos Santos',
    'https://meet.google.com/nky-izum-kvm',
    NULL,
    NULL,
    ('2026-07-08 15:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '2026-07-02T21:55:11.707Z'::timestamptz,
    now(),
    '2026-07-02T21:55:11.707Z'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'A0827S';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-07-08 15:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/nky-izum-kvm',
      'Estudo Plano de Saúde: Alan dos Santos',
      NULL,
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    gen_random_uuid(),
    'T493994A',
    'Thiago Mendonca',
    'contato@mso.adv.br',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    '[restore:resend_export_emails_sent]',
    NULL,
    'Estudo Plano de Saúde: Thiago Mendonca',
    'https://meet.google.com/npp-zsbc-wnf',
    NULL,
    NULL,
    ('2026-07-03 16:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '2026-07-03T13:47:49.763Z'::timestamptz,
    now(),
    '2026-07-03T13:47:49.763Z'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'T493994A';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-07-03 16:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/npp-zsbc-wnf',
      'Estudo Plano de Saúde: Thiago Mendonca',
      NULL,
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    gen_random_uuid(),
    'P280265E',
    'Priscilla Nobre',
    'priscillanobres.adv@gmail.com',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    '[restore:resend_export_emails_sent]',
    NULL,
    'Estudo Plano de Saúde: Priscilla Nobre',
    'https://meet.google.com/gkp-dsej-fqi',
    NULL,
    NULL,
    ('2026-07-06 15:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '2026-07-04T13:45:33.612Z'::timestamptz,
    now(),
    '2026-07-04T13:45:33.612Z'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'P280265E';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-07-06 15:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/gkp-dsej-fqi',
      'Estudo Plano de Saúde: Priscilla Nobre',
      NULL,
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    gen_random_uuid(),
    'C2906S',
    'Cosme Luis',
    'walescapadm@gmail.com',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    '[restore:EmailLog+Resend]',
    NULL,
    NULL,
    'https://meet.google.com/uim-yfxr-kit',
    NULL,
    NULL,
    ('2026-07-07 16:30:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    now(),
    now(),
    now()
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'C2906S';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-07-07 16:30:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/uim-yfxr-kit',
      'Reunião: Cosme Luis',
      NULL,
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    gen_random_uuid(),
    'S19190A',
    'Sabrina',
    'comercial@comercial.orthofull.com.br',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    '[restore:EmailLog+Resend]',
    NULL,
    NULL,
    'https://meet.google.com/bmo-vbdc-pjk',
    NULL,
    NULL,
    ('2026-07-07 17:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    now(),
    now(),
    now()
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'S19190A';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-07-07 17:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/bmo-vbdc-pjk',
      'Reunião: Sabrina',
      NULL,
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    gen_random_uuid(),
    'A69778A',
    'Anderson Lima',
    'andlima.advogado@gmail.com',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    '[restore:EmailLog+Resend]',
    NULL,
    NULL,
    'https://meet.google.com/rbc-kpdt-gup',
    NULL,
    NULL,
    ('2026-07-14 11:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    now(),
    now(),
    now()
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'A69778A';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-07-14 11:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/rbc-kpdt-gup',
      'Reunião: Anderson Lima',
      NULL,
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    gen_random_uuid(),
    'G42773O',
    'Glaucio Nascimento',
    'glaucioalvares@adv.oabrj.org.br',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'Reunião agendada com Glaucio Nascimento
[restore:EmailLog+Resend]',
    NULL,
    NULL,
    'https://meet.google.com/rkn-rgzw-fig',
    NULL,
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
    now(),
    now(),
    now()
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'G42773O';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-07-14 10:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/rkn-rgzw-fig',
      'Reunião: Glaucio Nascimento',
      NULL,
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    gen_random_uuid(),
    'M2298I',
    'Marco Ferrari',
    'sottomayor@openlink.com.br',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    '[restore:EmailLog+Resend]',
    NULL,
    NULL,
    'https://meet.google.com/vjc-wdhw-aqn',
    NULL,
    NULL,
    ('2026-07-16 12:30:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    now(),
    now(),
    now()
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'M2298I';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-07-16 12:30:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/vjc-wdhw-aqn',
      'Reunião: Marco Ferrari',
      NULL,
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    gen_random_uuid(),
    'I59819O',
    'Irene ou Thiago',
    'thiagomcfrias@gmail.com',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'Assunto usa Irene Ramalho; corpo do e-mail usa Irene ou Thiago
[restore:EmailLog+Resend]',
    NULL,
    NULL,
    'https://meet.google.com/epu-twke-foy',
    NULL,
    NULL,
    ('2026-07-22 10:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    now(),
    now(),
    now()
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'I59819O';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-07-22 10:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/epu-twke-foy',
      'Reunião: Irene ou Thiago',
      NULL,
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    gen_random_uuid(),
    'D8831O',
    'Daniele Pinto',
    'contato@danielepintoengenharia.com.br',
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    '[restore:EmailLog+Resend]',
    NULL,
    NULL,
    'https://meet.google.com/tot-nhbg-wfm',
    NULL,
    NULL,
    ('2026-07-23 09:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    now(),
    now(),
    now()
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'D8831O';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-07-23 09:00:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/tot-nhbg-wfm',
      'Reunião: Daniele Pinto',
      NULL,
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    gen_random_uuid(),
    'M8583O',
    'Mauricio Coelho',
    NULL,
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'Attendees só SDR+closer — e-mail do lead ausente no corpo
[restore:resend_export_emails_sent]
[parcial — dados incompletos na recuperação]',
    NULL,
    'Estudo Plano de Saúde: Mauricio Coelho',
    'https://meet.google.com/jea-shja-ggn',
    NULL,
    NULL,
    ('2026-06-25 15:30:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    '2026-06-25T16:40:10.994Z'::timestamptz,
    now(),
    '2026-06-25T16:40:10.994Z'::timestamptz
  ) ON CONFLICT ("leadCode") DO NOTHING;

  SELECT id INTO v_lead_id FROM "public"."corretor_studio_leads" WHERE "leadCode" = 'M8583O';
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO "public"."corretor_studio_leads_schedule" (
      "id", "leadId", "date", "meetingLink", "meetingTitle", "meetingType", "notes", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      v_lead_id,
      ('2026-06-25 15:30:00'::timestamp AT TIME ZONE 'America/Sao_Paulo'),
      'https://meet.google.com/jea-shja-ggn',
      'Estudo Plano de Saúde: Mauricio Coelho',
      NULL,
      NULL,
      now(),
      now()
    WHERE NOT EXISTS (SELECT 1 FROM "public"."corretor_studio_leads_schedule" s WHERE s."leadId" = v_lead_id);
  END IF;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    gen_random_uuid(),
    'R0932A',
    'Rodrigo Costa',
    NULL,
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'EmailLog status=failed; sem resendEmailId — sem corpo no Resend
[restore:EmailLog(assunto)]
[parcial — dados incompletos na recuperação]',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    now(),
    now(),
    now()
  ) ON CONFLICT ("leadCode") DO NOTHING;

  INSERT INTO "public"."corretor_studio_leads" (
    "id", "leadCode", "name", "email", "phone", "cnpj", "status", "teamId", "managerId",
    "assignedTo", "closerId", "notes", "meetingNotes", "meetingTitle", "meetingLink", "meetingType",
    "meetingHeald", "meetingDate", "ticket", "soldPlan", "lossReason", "contractDueDate",
    "currentHealthPlan", "currentValue", "referenceHospital", "currentTreatment", "age",
    "createdAt", "updatedAt", "statusEnteredAt"
  ) VALUES (
    gen_random_uuid(),
    'I096003S',
    'Isabelle Rios',
    NULL,
    NULL,
    NULL,
    'scheduled'::"LeadStatus",
    v_team,
    v_manager,
    NULL,
    v_closer,
    'EmailLog status=failed; sem resendEmailId — sem corpo no Resend
[restore:EmailLog(assunto)]
[parcial — dados incompletos na recuperação]',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    now(),
    now(),
    now()
  ) ON CONFLICT ("leadCode") DO NOTHING;

END $$;
