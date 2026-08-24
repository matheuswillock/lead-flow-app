-- Tira de PUBLIC o EXECUTE das quatro funcoes auxiliares de RLS.
--
-- CONTEXTO
--
-- Os advisors do Supabase sinalizaram
-- `anon_security_definer_function_executable` para quatro funcoes: elas sao
-- `SECURITY DEFINER` e chamaveis por `anon` via `/rest/v1/rpc/<nome>`, sem
-- login. Medido no remoto: `pg_proc.proacl` e NULL nas quatro, que em Postgres
-- significa exatamente "PUBLIC tem EXECUTE".
--
-- Rodando com privilegio do dono, elas viram um oraculo: da para sondar
-- pertencimento a time e visibilidade de conversa sem estar autenticado. E a
-- mesma familia do problema que 20260824170731 corrigiu nas notificacoes —
-- permissao ampla herdada do baseline, com a policy segurando sozinha.
--
-- POR QUE REVOGAR DE PUBLIC **E** DE anon
--
-- Os dois sao necessarios, e isso foi descoberto por teste, nao por leitura.
--
-- `REVOKE ... FROM anon` sozinho nao basta quando o EXECUTE vem de PUBLIC:
-- `anon` continua herdando. Mas `REVOKE ... FROM PUBLIC` sozinho tambem nao
-- basta quando existe grant DIRETO para `anon`.
--
-- Medido no banco local, com a ACL impressa antes e depois:
--
--   ACL inicial      : =X/postgres | anon=X/postgres | authenticated=X/postgres
--   ACL apos revoke  :               anon=X/postgres | authenticated=X/postgres
--   anon apos revoke : true   <- CONTINUAVA COM ACESSO
--
-- O `=X/postgres` e o PUBLIC; o `anon=X/postgres` e um grant direto, herdado de
-- um `ALTER DEFAULT PRIVILEGES` que rodou em alguma migration. No remoto o
-- `proacl` das quatro e NULL (so PUBLIC), entao la o revoke de PUBLIC bastaria —
-- mas escrever so isso deixaria a migration como no-op silencioso em qualquer
-- base que tenha o grant direto, incluindo o replay local que a CI usa.
--
-- Por isso as duas revogacoes, e so entao os GRANTs do acesso legitimo.
--
-- QUEM PRECISA CONTINUAR EXECUTANDO
--
-- 83 policies dependem destas funcoes (medido em `pg_depend` filtrando
-- `refclassid='pg_proc'`), e TODAS sao `TO authenticated` ou `TO service_role`
-- — zero policy `TO anon` ou `TO public`. Por isso os dois grants abaixo bastam.
--
-- Uma policy que chama funcao exige EXECUTE do papel que roda a query, entao os
-- GRANTs sao obrigatorios: sem eles, 83 policies passariam a falhar.
--
-- VERIFICACAO FEITA ANTES (banco local, em transacao com ROLLBACK)
--
-- Com controle negativo, para garantir que o instrumento conseguia falhar:
--
--   CTRL-NEG  jwt errado    | 0      <- o teste sabe reprovar
--   ANTES     authenticated | 1
--   DEPOIS    authenticated | 1      <- revoke nao quebra o caminho legitimo
--   DEPOIS    anon          | ERROR: permission denied for function
--
-- Tambem medido: zero ocorrencias de `.rpc(` em `app/`, `components/`, `hooks/`,
-- `lib/`, `e2e/`, `scripts/` e `prisma/` — nenhum caminho da aplicacao chama
-- estas funcoes por PostgREST.
--
-- O QUE NAO ENTRA AQUI
--
-- O advisor tambem lista `function_search_path_mutable` para seis funcoes
-- (`hook_restrict_signup`, `increment_latest_schedule_no_show_count`,
-- `fix_pt_encoding`, `prevent_delete_default_email_contact_list`,
-- `normalize_whatsapp_phone`,
-- `sync_team_email_campaign_limit_grant_from_backoffice`). Ficaram de fora de
-- proposito, por duas razoes medidas:
--
--   1. As seis sao `SECURITY INVOKER` (`pg_proc.prosecdef = false`). Rodam com o
--      privilegio de quem chama, entao `search_path` mutavel nao escala
--      privilegio — o risco e materialmente menor que nas SECURITY DEFINER.
--   2. `ALTER FUNCTION ... SET search_path` NAO e duravel neste repo. Medido:
--      `CREATE OR REPLACE` sem `SET` apaga o `proconfig`
--      (`apos ALTER -> {search_path=...}`, `apos CREATE OR REPLACE -> null`), e
--      duas dessas funcoes ja sao recriadas por migrations posteriores
--      (`whatsapp_user_can_view_conversation` em 20260702111737 e 20260704005011;
--      `hook_restrict_signup` em 20260524200028 e 20260527192342). Corrigir por
--      `ALTER` daria falsa sensacao de resolvido ate a proxima redefinicao.
--
-- A correcao duravel e embutir `SET search_path` na propria definicao de cada
-- funcao, o que exige reescrever os corpos — mudanca maior, com risco proprio
-- (`hook_restrict_signup` e Auth Hook do GoTrue; quebra-lo quebra o cadastro).
-- Fica registrado como item separado.
--
-- As quatro funcoes desta migration JA tem `search_path=public` fixado
-- (verificado em `pg_proc.proconfig`), entao nao aparecem naquele lint.

REVOKE EXECUTE ON FUNCTION public.corretor_studio_is_team_manager(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.corretor_studio_is_team_manager(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.corretor_studio_is_team_member(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.corretor_studio_is_team_member(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_active_backoffice_user() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_active_backoffice_user() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.whatsapp_user_can_view_conversation(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.whatsapp_user_can_view_conversation(uuid) TO authenticated, service_role;
