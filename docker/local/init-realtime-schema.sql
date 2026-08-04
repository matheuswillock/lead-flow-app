-- Executado automaticamente pela imagem supabase/postgres em
-- /docker-entrypoint-initdb.d (só roda quando o volume de dados está vazio).
--
-- O Realtime precisa do schema `_realtime` já existir antes de conectar
-- (usa `DB_AFTER_CONNECT_QUERY: SET search_path TO _realtime`) — sem isso
-- ele falha com "no schema has been selected to create in" ao tentar
-- criar sua própria tabela de controle de migrations.
--
-- Mesmo script usado pelo self-hosted oficial da Supabase:
-- https://github.com/supabase/supabase/blob/master/docker/volumes/db/realtime.sql
\set pguser `echo "$POSTGRES_USER"`

create schema if not exists _realtime;
alter schema _realtime owner to :pguser;
