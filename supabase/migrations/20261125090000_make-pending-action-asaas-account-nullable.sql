-- Ação pendente de provedor de pagamento não tem conta Asaas: a coluna deixa de ser obrigatória.
-- O default 'primary' é mantido para o fluxo legado (a conta só vale quando o paymentId é gravado).
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'corretor_studio_pending_actions'
      and column_name = 'asaasAccount'
      and is_nullable = 'NO'
  ) then
    alter table "public"."corretor_studio_pending_actions"
      alter column "asaasAccount" drop not null;
  end if;
end $$;
