-- S4 parcial (DA2, C3) — 30 — Migração de Conta (execução) E3. O ledger
-- corretor_studio_asaas_account_migrations é mutável por design (máquina de
-- estados com retry failed -> pending, attempt_count, last_error) — REVOKE
-- total de UPDATE/DELETE inviabilizaria esse retry (é a mesma lacuna que a
-- 01 §10 chamou de S4 no plano de 19/08, que não previa proteção nenhuma).
-- A proteção real é: DELETE sempre bloqueado; UPDATE bloqueado só nas
-- colunas de snapshot do legado, e só depois de preenchidas — permitindo o
-- populate inicial (M5.3) gravar o snapshot em duas etapas
-- (legacy_customer_id na criação da linha, o resto do GET de detalhe logo
-- em seguida) sem travar a própria escrita que preenche a coluna pela
-- primeira vez. Colunas operacionais (status, attempt_count, last_error,
-- primary_*, migrated_at, notifications_disabled, anomaly_notes,
-- updated_at) seguem livres — a máquina de estados as reescreve o tempo
-- todo.
--
-- Mesmo motivo do REVOKE não bastar sozinho, documentado em
-- 20260910154448_add-subscription-state-snapshot.sql: o role "postgres" do
-- pooler/local tem privilégio efetivo de dono, que ignora GRANT/REVOKE — só
-- RLS e trigger continuam valendo.
create or replace function public.protect_asaas_account_migration_snapshot()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'corretor_studio_asaas_account_migrations is append-only — DELETE is not allowed (S4, 30 — Migração de Conta (execução) E3)';
  end if;

  -- TG_OP = 'UPDATE' a partir daqui — NEW/OLD sempre disponíveis.
  if NEW.legacy_customer_id is distinct from OLD.legacy_customer_id then
    raise exception 'corretor_studio_asaas_account_migrations.legacy_customer_id is immutable (S4, 30 — Migração de Conta (execução) E3)';
  end if;

  if OLD.legacy_subscription_id is not null
     and NEW.legacy_subscription_id is distinct from OLD.legacy_subscription_id then
    raise exception 'corretor_studio_asaas_account_migrations.legacy_subscription_id is immutable once set (S4, 30 — Migração de Conta (execução) E3)';
  end if;

  if OLD.billing_type is not null
     and NEW.billing_type is distinct from OLD.billing_type then
    raise exception 'corretor_studio_asaas_account_migrations.billing_type is immutable once set (S4, 30 — Migração de Conta (execução) E3)';
  end if;

  if OLD.cycle is not null
     and NEW.cycle is distinct from OLD.cycle then
    raise exception 'corretor_studio_asaas_account_migrations.cycle is immutable once set (S4, 30 — Migração de Conta (execução) E3)';
  end if;

  if OLD.value is not null
     and NEW.value is distinct from OLD.value then
    raise exception 'corretor_studio_asaas_account_migrations.value is immutable once set (S4, 30 — Migração de Conta (execução) E3)';
  end if;

  if OLD.next_due_date is not null
     and NEW.next_due_date is distinct from OLD.next_due_date then
    raise exception 'corretor_studio_asaas_account_migrations.next_due_date is immutable once set (S4, 30 — Migração de Conta (execução) E3)';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_protect_asaas_account_migration_snapshot
  on "public"."corretor_studio_asaas_account_migrations";

create trigger trg_protect_asaas_account_migration_snapshot
  before update or delete on "public"."corretor_studio_asaas_account_migrations"
  for each row execute function public.protect_asaas_account_migration_snapshot();
