-- Atualiza hook_restrict_signup para permitir convites disparados pelo admin
-- (fluxo de adesão paga: ensureAccountForPaidAdhesion usa generateLink com invited=true)
--
-- Problema: generateLink({ type: "invite" }) cria o usuário no Supabase Auth,
-- o que dispara o hook before_signup. Nesse momento o corretor_studio_profiles
-- ainda não existe para o email do convidado (é criado depois, na mesma transação).
-- O hook bloqueava o invite com "Conta nao encontrada".
--
-- Solução: se o campo user_metadata.invited = true está presente no evento
-- (setado explicitamente pelo generateLink da adesão), o hook libera sem verificar
-- o profile. Isso é seguro pois generateLink só é chamado por código servidor
-- com SUPABASE_SERVICE_ROLE_KEY.
CREATE OR REPLACE FUNCTION public.hook_restrict_signup(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.hook_restrict_signup(jsonb) TO supabase_auth_admin;
