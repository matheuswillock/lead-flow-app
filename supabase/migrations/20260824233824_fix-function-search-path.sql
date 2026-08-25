-- Fixa `search_path` nas seis funcoes sinalizadas por
-- `function_search_path_mutable` nos advisors do Supabase.
--
-- POR QUE `CREATE OR REPLACE` E NAO `ALTER FUNCTION`
--
-- `ALTER FUNCTION ... SET search_path` funciona, mas NAO e duravel neste repo.
-- Medido: `CREATE OR REPLACE` sem `SET` apaga o `proconfig`
-- (`apos ALTER -> {search_path=...}`, `apos CREATE OR REPLACE -> null`). E este
-- repo ja redefine funcoes em migrations posteriores — `hook_restrict_signup`
-- foi criada em 20260524200028 e recriada em 20260527192342.
--
-- Embutir o `SET` na propria definicao faz a configuracao viajar junto com a
-- funcao: qualquer redefinicao futura que parta desta versao carrega o
-- `search_path` junto.
--
-- POR QUE `search_path = ''` E NAO `= public`
--
-- Vazio e o mais estrito: nenhum schema e pesquisado, entao toda referencia
-- precisa ser qualificada e nao ha como um schema malicioso na frente do path
-- sequestrar um nome. `pg_catalog` continua implicito, entao `now()`,
-- `regexp_replace()`, `length()`, `count()`, `lower()`, `jsonb_build_object()` e
-- `REPLACE()` seguem resolvendo.
--
-- `gen_random_uuid()` foi conferido de proposito: existe em `pg_catalog` E em
-- `extensions` neste projeto (PostgreSQL 17.6). Como `pg_catalog` e implicito e
-- vem primeiro, ela resolve mesmo com o path vazio.
--
-- O QUE MUDOU EM CADA CORPO
--
-- Cinco funcoes ficaram byte a byte iguais — as referencias de tabela ja eram
-- qualificadas ou nao existiam. Só `increment_latest_schedule_no_show_count`
-- teve mudanca de corpo: as duas referencias a `corretor_studio_leads_schedule`
-- eram NAO qualificadas e passaram a `public.corretor_studio_leads_schedule`
-- (nome fisico confirmado no `@@map` de prisma/schema.prisma:2243).
--
-- RISCO CONCENTRADO EM hook_restrict_signup
--
-- Ela e Auth Hook do GoTrue: se quebrar, o cadastro para. Por isso a unica
-- referencia de tabela dela (`public.corretor_studio_profiles`) ja vinha
-- qualificada na definicao em producao, e o corpo abaixo e identico ao que esta
-- la hoje — a unica diferenca e o `SET search_path`. Grants nao sao tocados.
--
-- RECONCILIA UM DRIFT
--
-- `fix_pt_encoding` existe no remoto mas NENHUMA migration a definia. Esta
-- migration passa a ser a fonte dela, alem de fixar o `search_path`.

-- 1. fix_pt_encoding — sem referencia de tabela, so REPLACE (pg_catalog) -------

CREATE OR REPLACE FUNCTION public.fix_pt_encoding(s text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path = ''
AS $function$
  SELECT
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    REPLACE(REPLACE(REPLACE(
      s,
      '├║', 'ú'),
      '├º', 'ç'),
      '├®', 'é'),
      '├¬', 'ê'),
      '├ú', 'ã'),
      '├│', 'ó'),
      '├╡', 'õ'),
      '├á', 'à'),
      '├í', 'á'),
      '├ó', 'â'),
      '├ñ', 'ä'),
      '├¡', 'í'),
      '├╣', 'ù'),
      '├╝', 'ü'),
      '├Ç', 'À'),
      '├â', 'Ã'),
      '├ç', 'Ç'),
      '├ë', 'É'),
      '├è', 'Ê'),
      '├ì', 'Í'),
      '├ô', 'Ó'),
      '├ò', 'Õ'),
      '├Ü', 'Ú'),
      '├»', 'û'),
      '├½', 'ý'),
      '├▒', 'ñ'),
      '├┤', 'ô'),
      '├ü', 'Á'),
      '┬┤', '´'),
      '├é', 'Ã'),
      '├Á', 'õ'),
      '┬║', 'º'),
      '┬¬', 'ª')
$function$;

-- 2. normalize_whatsapp_phone — so regexp_replace/length (pg_catalog) ---------

CREATE OR REPLACE FUNCTION public.normalize_whatsapp_phone(p_phone text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path = ''
AS $function$
DECLARE
  v_digits text;
BEGIN
  IF p_phone IS NULL OR p_phone = '' THEN
    RETURN '';
  END IF;

  v_digits := regexp_replace(p_phone, '\D', '', 'g');

  IF v_digits LIKE '55%' AND length(v_digits) >= 12 THEN
    RETURN v_digits;
  END IF;

  IF length(v_digits) IN (10, 11) THEN
    RETURN '55' || v_digits;
  END IF;

  RETURN v_digits;
END;
$function$;

-- 3. prevent_delete_default_email_contact_list — so OLD e RAISE ---------------

CREATE OR REPLACE FUNCTION public.prevent_delete_default_email_contact_list()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
BEGIN
  IF OLD."isSystemDefault" THEN
    RAISE EXCEPTION 'Default contact list cannot be deleted';
  END IF;
  RETURN OLD;
END;
$function$;

-- 4. increment_latest_schedule_no_show_count — UNICA com mudanca de corpo -----
-- As duas referencias a `corretor_studio_leads_schedule` eram nao qualificadas.

CREATE OR REPLACE FUNCTION public.increment_latest_schedule_no_show_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
BEGIN
  IF NEW."status"::text = 'no_show'
     AND OLD."status"::text IS DISTINCT FROM 'no_show' THEN
    UPDATE public.corretor_studio_leads_schedule ls
    SET "noShowCount" = COALESCE(ls."noShowCount", 0) + 1,
        "updatedAt" = NOW()
    WHERE ls.id = (
      SELECT s.id
      FROM public.corretor_studio_leads_schedule s
      WHERE s."leadId" = NEW.id
      ORDER BY s.date DESC, s."createdAt" DESC
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. sync_team_email_campaign_limit_grant_from_backoffice ---------------------
-- Referencia de tabela ja era qualificada. `gen_random_uuid()` resolve por
-- pg_catalog, conferido acima.

CREATE OR REPLACE FUNCTION public.sync_team_email_campaign_limit_grant_from_backoffice()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
BEGIN
  INSERT INTO "public"."corretor_studio_team_email_campaign_limit_grants"
    ("id", "teamId", "maxEmailsPerDay", "isActive", "createdAt", "updatedAt")
  VALUES
    (gen_random_uuid(), NEW."teamId", NEW."maxEmailsPerDay", NEW."isActive", now(), now())
  ON CONFLICT ("teamId") DO UPDATE
  SET
    "maxEmailsPerDay" = EXCLUDED."maxEmailsPerDay",
    "isActive" = EXCLUDED."isActive",
    "updatedAt" = now();

  RETURN NEW;
END;
$function$;

-- 6. hook_restrict_signup — Auth Hook do GoTrue -------------------------------
-- Corpo IDENTICO ao que esta em producao; a unica diferenca e o SET search_path.
-- A referencia de tabela ja vinha qualificada.

CREATE OR REPLACE FUNCTION public.hook_restrict_signup(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
declare
  usr_email    text;
  is_invited   boolean;
  found_count  int;
begin
  -- Convites disparados pelo admin (fluxo de adesão paga) têm invited=true
  -- em user_metadata. Nesses casos, libera sem verificar o profile.
  is_invited := (event->'user'->'user_metadata'->>'invited')::boolean;
  if is_invited is true then
    return '{}'::jsonb;
  end if;

  usr_email := event->'user'->>'email';
  select count(*) into found_count
  from public.corretor_studio_profiles
  where lower(email) = lower(usr_email);

  if found_count > 0 then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Conta nao encontrada. Crie conta com email e senha ou fale com o suporte.'
    )
  );
end;
$function$;
