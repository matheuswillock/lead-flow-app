-- O ledger contém dados de migração e PII; acesso somente por service role.
alter table public.corretor_studio_asaas_account_migrations enable row level security;

drop policy if exists asaas_account_migration_service_role_only on public.corretor_studio_asaas_account_migrations;

create policy asaas_account_migration_service_role_only
  on public.corretor_studio_asaas_account_migrations
  for all
  to service_role
  using (true)
  with check (true);
