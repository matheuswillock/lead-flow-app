-- Executado automaticamente pela imagem supabase/postgres em
-- /docker-entrypoint-initdb.d (só roda quando o volume de dados está vazio).
--
-- Storage é remoto no stack híbrido (não subimos o container Storage API
-- localmente) — então o schema `storage` nunca é criado pela imagem base.
-- Algumas migrations em supabase/migrations/ fazem INSERT em
-- `storage.buckets` (registrar buckets) e CREATE POLICY em `storage.objects`
-- (regra de leitura pública). Sem esse schema, `db reset --db-url` local
-- falha com "relation storage.buckets does not exist".
--
-- Colunas seguem o schema oficial documentado em
-- https://supabase.com/docs/guides/storage/schema/design — cobre tanto o
-- INSERT das migrations locais (id/name/public/file_size_limit/
-- allowed_mime_types) quanto os dumps de dados restaurados por
-- scripts/clone-remote-to-local.ts (bun run db:clone:remote).
create schema if not exists storage;

create table if not exists storage.buckets (
  id text not null primary key,
  name text not null,
  owner_id text,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner_id text,
  metadata jsonb,
  path_tokens text[],
  version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

-- Este script roda como supabase_admin (bootstrap role da imagem
-- supabase/postgres), mas as migrations em supabase/migrations/ conectam
-- como "postgres" (LOCAL_DB_URL) — sem isso, CREATE POLICY ON storage.objects
-- falha com "must be owner of table objects".
alter schema storage owner to postgres;
alter table storage.buckets owner to postgres;
alter table storage.objects owner to postgres;
