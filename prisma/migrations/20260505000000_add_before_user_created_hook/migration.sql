-- Hook: bloqueia criação de auth.users via Google se não existe profiles com o email
-- Ativado em: Authentication → Hooks → Before User Created → hook_restrict_google_signup
create or replace function public.hook_restrict_google_signup(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  provider    text;
  usr_email   text;
  found_count int;
begin
  provider := event->'user'->'app_metadata'->>'provider';

  -- Permitir qualquer provider que não seja Google (email/senha, etc.)
  if provider <> 'google' then
    return '{}'::jsonb;
  end if;

  usr_email := event->'user'->>'email';

  select count(*)
  into found_count
  from public.profiles
  where lower(email) = lower(usr_email);

  if found_count > 0 then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message',   'Conta nao encontrada. Crie conta com email e senha ou fale com o suporte.'
    )
  );
end;
$$;

-- Permissões: apenas supabase_auth_admin pode executar
grant usage   on schema public                                to supabase_auth_admin;
grant execute on function public.hook_restrict_google_signup to supabase_auth_admin;
grant select  on table  public.profiles                      to supabase_auth_admin;

revoke execute on function public.hook_restrict_google_signup
  from authenticated, anon, public;
