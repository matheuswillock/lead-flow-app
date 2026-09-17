-- SPEC 30 — E2/D5: indices para a ancora de evento.
--
-- O analytics deixou de contar tudo por `sentAt` e passou a fazer range no
-- timestamp de CADA fato (`deliveredAt`, `openedAt`, `clickedAt`, `bouncedAt`,
-- `complainedAt`) e no `occurredAt` do proprio `EmailEvent`. Antes desta
-- migration so `sentAt` era indexado: cada requisicao de analytics varria o
-- historico inteiro do time cinco vezes — e o dobro disso quando os deltas
-- carregam o periodo anterior. Achado da revisao do PR #1065.
--
-- Composto por `teamId` porque toda consulta do analytics e escopada por time;
-- o timestamp vem em segundo para o range aproveitar o indice.
--
-- Escrita a mao (`db:migrate:new`) e nao via `db:migrate:from-prisma`: o diff
-- gerado pelo caminho automatico vinha derrubando triggers e check constraints
-- que vivem em SQL manual e o schema do Prisma nao conhece. Para adicao de
-- indice, SQL explicito e menor e revisavel.
--
-- Sem CONCURRENTLY de proposito: migration do Supabase roda em transacao, e
-- `CREATE INDEX CONCURRENTLY` e proibido dentro de uma. Em tabela grande isto
-- segura escrita pelo tempo da criacao.

CREATE INDEX IF NOT EXISTS "corretor_studio_email_logs_team_delivered_idx"
  ON "public"."corretor_studio_email_logs" ("teamId", "deliveredAt");

CREATE INDEX IF NOT EXISTS "corretor_studio_email_logs_team_opened_idx"
  ON "public"."corretor_studio_email_logs" ("teamId", "openedAt");

CREATE INDEX IF NOT EXISTS "corretor_studio_email_logs_team_clicked_idx"
  ON "public"."corretor_studio_email_logs" ("teamId", "clickedAt");

CREATE INDEX IF NOT EXISTS "corretor_studio_email_logs_team_bounced_idx"
  ON "public"."corretor_studio_email_logs" ("teamId", "bouncedAt");

CREATE INDEX IF NOT EXISTS "corretor_studio_email_logs_team_complained_idx"
  ON "public"."corretor_studio_email_logs" ("teamId", "complainedAt");

-- `delivery_delayed` e `unsubscribed` sao contados pelo `occurredAt` do evento.
-- O indice existente comeca por `logId`, que a consulta nao conhece: ela filtra
-- por tipo + janela.
CREATE INDEX IF NOT EXISTS "corretor_studio_email_events_type_occurred_idx"
  ON "public"."corretor_studio_email_events" ("type", "occurredAt");
