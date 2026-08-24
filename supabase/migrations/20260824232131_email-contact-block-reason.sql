-- Gerado por `bun run db:migrate:from-prisma -- email-contact-block-reason`.
--
-- O diff veio com exatamente estas duas linhas. Vale registrar: na primeira
-- tentativa, em 23/08, o mesmo comando produziu 3707 linhas — 134 drops de
-- tabela/índice, 117 `drop constraint` e 7 `revoke ... from service_role` —
-- por causa da divergência entre `prisma/schema.prisma` e
-- `supabase/migrations/**`. A migration foi adiada até o drift ser reconciliado
-- (commit 8437fcab). Este arquivo é a prova de que fechou.
--
-- Nome físico conferido em prisma/schema.prisma: model EmailContact
-- ⇒ @@map("corretor_studio_email_contacts").

alter table "public"."corretor_studio_email_contacts"
  add column if not exists "blockReason" text;

alter table "public"."corretor_studio_email_contacts"
  add column if not exists "blockedAt" timestamp(6) with time zone;

-- ---------------------------------------------------------------------------
-- Backfill dos bloqueios já existentes.
--
-- Só linhas que vivem na lista de bloqueados do time: a blocklist é uma lista,
-- e a linha do contato nela é o registro de supressão. Precedência
-- descadastro > bounce > manual. Os textos batem com as constantes
-- BLOCK_REASON_* de lib/email/email-contact-blocklist.ts — se um lado mudar, o
-- outro precisa mudar junto.
--
-- `blockedAt` recebe `createdAt` da própria linha, que é quando o endereço
-- entrou na blocklist. Usar `now()` apagaria a idade real do bloqueio e faria
-- toda a base parecer bloqueada na data do deploy.
--
-- Nomes físicos conferidos: EmailContactList ⇒ corretor_studio_email_contact_lists,
-- EmailEvent ⇒ corretor_studio_email_events, EmailLog ⇒ corretor_studio_email_logs.
-- ---------------------------------------------------------------------------

update "public"."corretor_studio_email_contacts" as c
set
  "blockReason" = case
    when exists (
      select 1
        from "public"."corretor_studio_email_events" ev
        join "public"."corretor_studio_email_logs" lg on lg."id" = ev."logId"
       where ev."type" = 'unsubscribed'
         and lg."teamId" = l."teamId"
         and lower(btrim(lg."recipientEmail")) = lower(btrim(c."email"))
    ) then 'Descadastro pelo destinatário'
    when c."isUnsubscribed" then 'Descadastro pelo destinatário'
    when c."isBounced" then 'Bounce reportado pelo provedor'
    else 'Bloqueio manual'
  end,
  "blockedAt" = c."createdAt"
from "public"."corretor_studio_email_contact_lists" as l
where l."id" = c."listId"
  and l."isBlocklist" = true
  and c."blockReason" is null;
