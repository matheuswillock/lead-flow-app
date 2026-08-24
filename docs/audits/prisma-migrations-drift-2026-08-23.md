# Divergência `prisma/schema.prisma` ↔ `supabase/migrations/**`

**Data:** 2026-08-23
**Motivo:** `bun run db:migrate:from-prisma` gera ~242 KB de SQL para qualquer mudança de schema.
**Método:** `supabase db diff --db-url <local:55322> --schema public` capturado e classificado
statement a statement. Banco local com as 311 migrations registradas em
`supabase_migrations.schema_migrations`.

---

## 1. Composição real do diff

O diff bruto tem **187.318 bytes de SQL** (247.651 bytes com o envelope JSON que o CLI
emite quando stdout não é TTY). São **1.853 statements**:

| categoria | stmts | bytes | % | é drift real? |
|---|---:|---:|---:|---|
| `grant … to anon/authenticated/service_role` | 1.092 | 89.340 | 47,7% | **não** — ver §2 |
| `alter table … add constraint` | 115 | 26.967 | 14,4% | parcial — 88 são renome de caixa |
| `create index` | 113 | 17.714 | 9,5% | parcial — 103 são renome |
| `alter table … alter column … drop default` | 159 | 14.813 | 7,9% | **sim, e é o mais perigoso** — §3 |
| `alter table … drop constraint` | 117 | 13.631 | 7,3% | parcial |
| `alter table … validate constraint` | 110 | 13.252 | 7,1% | acompanha os `add constraint` |
| `drop index` | 133 | 10.645 | 5,7% | 103 renome, 28 perda real |
| `revoke … from service_role` | 7 | 665 | 0,4% | consequência do §4.1 |
| `alter table … add column` | 2 | 189 | 0,1% | **sim** — §4.2 |
| `drop table` | 1 | 62 | 0,0% | **sim** — §4.1 |
| `drop type` | 1 | 40 | 0,0% | **sim** — §4.3 |

**Correções à hipótese inicial:** o arquivo **não contém nenhum `drop policy`** (0 statements),
e tem apenas **7 `revoke`** — todos da mesma tabela (§4.1), não uma revogação em massa.
As RLS policies do banco não aparecem no diff.

---

## 2. Os grants (47,7% do arquivo) não vêm do `prisma db push`

`pg_default_acl` no banco local:

```
postgres|public|r|{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,
                   authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
```

Toda tabela criada em `public` herda `arwdDxtm` para `anon`, `authenticated` e `service_role` —
é o default da imagem `supabase/postgres` e do Supabase hospedado. O **shadow database** que o
`supabase db diff` levanta para replayar as migrations **não tem essas entradas**, então toda
tabela sem `GRANT` explícito no SQL aparece como "faltando grants".

Números que sustentam isso:

- 92 tabelas recebem `grant` no diff.
- 73 tabelas têm `grant` explícito em alguma migration.
- A interseção é de **apenas 3** — ou seja, **89 das 92** nunca receberam `GRANT` em migration
  nenhuma; o privilégio existe no banco só por causa do `pg_default_acl`.
- `prisma db push` não emite `GRANT`. Essas tabelas teriam o mesmo ACL mesmo sem o push.

**Consequência:** esses 47,7% apareceriam mesmo com o banco local em estado limpo de migrations.
A linha 103 do `scripts/db-migrate-from-prisma.ts` **não** explica essa metade do arquivo.

Os 1.043 `grant … to anon` que hoje existem dentro de `supabase/migrations/**` são, eles mesmos,
resíduo de execuções anteriores deste gerador — o ruído já foi commitado antes.

---

## 3. `drop default` — o item mais perigoso do arquivo

159 statements. Distribuição por coluna e o default que existe nas migrations:

| coluna | ocorrências | default nas migrations |
|---|---:|---|
| `updatedAt` | 77 | `CURRENT_TIMESTAMP` |
| `id` | 76 | `gen_random_uuid()` |
| `updated_at` | 2 | `now()` |
| `filters`, `allowedOrigins`, `rawPayload` | 3 | `'{}'` |
| `expiresAt` | 1 | `now() + …` |

Causa: `@default(uuid())` e `@updatedAt` no Prisma são resolvidos **no client**, não no banco.
O `prisma db push` derruba o default físico da coluna. Qualquer `INSERT` que não passe pelo
Prisma Client (SQL raw, seed, Supabase JS, PostgREST, trigger) perde o valor.

Se um desses arquivos gerados for aplicado no remoto, 153 colunas `id`/`updatedAt` ficam sem
default no banco de produção.

---

## 4. Drift real de estrutura (4 itens)

### 4.1 `corretor_studio_radar_pixel_rate_limits` — só nas migrations

Criada em `20260803004716_radar-d8-pixel-ratelimit.sql`, ausente de `prisma/schema.prisma`.
Gera no diff: `drop table` + `drop index …_pkey` + os 7 `revoke … from service_role`.

**Única tabela** nessa condição. Varredura completa das 311 migrations não encontrou outra.

### 4.2 `corretor_studio_email_contacts` — só no schema.prisma

Duas colunas existem no schema e não em migration nenhuma:

```sql
add column "blockReason" text
add column "blockedAt" timestamp(6) with time zone
```

### 4.3 `subscription_cycle` — enum só nas migrations

`CREATE TYPE "public"."subscription_cycle" AS ENUM (…)` em
`20260804195207_subscription-change-log-and-cycle-enum.sql`. A string `subscription_cycle`
não aparece em `prisma/schema.prisma`.

Nenhum outro enum diverge: os 93 enums do schema existem todos nas migrations (os `radar_*`
via rename dinâmico em `20260718220125_radar-rename-physical-schema.sql`).

### 4.4 Três mudanças de tipo

```sql
alter column "code"      set data type text
alter column "createdAt" set data type timestamp(3) without time zone
alter column "updatedAt" set data type timestamp(3) without time zone
```

---

## 5. Índices: 103 renomes, 28 perdas reais

Dos 133 `drop index` do diff, cruzando cada nome com a definição real nas migrations
(tabela + colunas + unicidade):

- **103 são renome** — mesmo índice, nome diferente. Ex.:
  `backoffice_crm_lead_status_transition_gates_enabled_idx` → `…_isEnabled_idx`
  (migration usou o nome físico da coluna, Prisma usa o nome do campo).
- **2 não resolvidos** (nome truncado em 63 bytes sem match).
- **28 são perda real** — existem nas migrations e o `schema.prisma` não declara `@@index`:

```
backoffice_adhesions(sponsorMasterId)
backoffice_cnaes(code)
corretor_studio_lead_custom_field_values(definitionId, value)
corretor_studio_leads(referrerLeadId)
corretor_studio_radar_pixel_rate_limits(key) UNIQUE      ← consequência do §4.1
team_whatsapp_configs(createdByProfileId)
team_whatsapp_configs(updatedByProfileId)
team_whatsapp_configs(webhookSecret) UNIQUE
whatsapp_audit_events(actorProfileId)
whatsapp_auto_response_logs(ruleId)
whatsapp_contact_identities(contactId)
whatsapp_conversations(contactId)
whatsapp_message_action_commands(profileId)
whatsapp_message_favorites(profileId)
whatsapp_message_pins(pinnedByProfileId)
whatsapp_message_pins(teamId)
whatsapp_message_reactions(profileId)
whatsapp_message_visibility(profileId)
whatsapp_messages(autoResponseRuleId)
whatsapp_messages(configId)
whatsapp_messages(conversationId, providerTimestamp, createdAt)
whatsapp_messages(deletedByProfileId)
whatsapp_messages(leadId)
whatsapp_outbound_commands(conversationId)
whatsapp_outbound_commands(status, nextReconcileAt)
whatsapp_sync_jobs(configId)
whatsapp_webhook_events(status, createdAt)
whatsapp_webhook_events(teamId)
```

24 das 28 são do módulo WhatsApp — quase todas índice de FK. Aplicar o SQL gerado hoje
derruba esses índices em produção.

---

## 6. Constraints: 88 renomes de caixa + ~28 de truncamento

117 `drop constraint` / 115 `add constraint`.

- **88 pares** têm o mesmo nome ignorando maiúsculas:
  `backoffice_contracts_clientid_fkey` → `backoffice_contracts_clientId_fkey`.
  A migration foi escrita com o identificador em minúsculas; o Prisma gera camelCase.
- **~28 pares** divergem por truncamento em 63 bytes a partir de raízes diferentes:
  `…_lead_document_requests_creator_fkey` → `…_lead_document_requests_createdByProfileId_fkey`.

Nenhum é perda de integridade — a FK continua existindo, só muda de nome. Mas cada
`db:migrate:from-prisma` reescreve os 117 e o próximo reescreve de volta.

---

## 7. O que foi corrigido nesta rodada

### 7.1 Filtro no gerador — `scripts/db-migrate-diff-filter.ts`

`db:migrate:from-prisma` agora descarta, antes de gravar o arquivo, as três
categorias que o Prisma nunca gerencia, e loga a contagem por categoria:

```
▶ Filtrados 1266 statement(s) que o Prisma não gerencia:
    1106  GRANT/REVOKE (pg_default_acl do shadow database)
     159  ALTER COLUMN … DROP DEFAULT (default físico da coluna)
       1  POLICY / ROW LEVEL SECURITY (RLS não vive no schema.prisma)
```

O splitter respeita literais, identificadores entre aspas, dollar-quoting
(`$$…$$`) e comentários — um `split(";")` ingênuo cortaria corpo de função ao
meio. Também desembrulha o envelope JSON que o CLI emite quando stdout não é TTY.
Coberto por `scripts/db-migrate-diff-filter.test.ts`, incluindo a lista de
statements que **devem** sobreviver ao filtro.

**O filtro de `DROP DEFAULT` é por coluna, não por categoria.** A primeira versão
descartava todo `ALTER COLUMN … DROP DEFAULT`, o que engoliria em silêncio a
remoção *intencional* de um default — tirar um `@default(...)` do schema viraria
"nenhuma diferença" e o banco ficaria com o default antigo. `readClientSideDefaults()`
lê o `prisma/schema.prisma`, resolve `@@map`/`@map` para nomes físicos e monta o
conjunto de colunas com default resolvido no client (`@default(uuid()/cuid()/
ulid()/nanoid())` e `@updatedAt`). Só essas são filtradas: 155 das 159. As outras
4 tinham default físico que o schema não declarava, e foram declaradas (§7.6).

### 7.2 Drift real fechado no `prisma/schema.prisma`

- `model RadarPixelRateLimit` com `@@map("corretor_studio_radar_pixel_rate_limits")` (§4.1)
- `enum SubscriptionCycle` com `@@map("subscription_cycle")`, ainda não ligado a coluna (§4.3)
- `BackofficeCnae`: `code` → `@db.VarChar(10)`, timestamps → `@db.Timestamptz(6)` (§4.4)
- 27 `@@index`/`@unique` que existiam só nas migrations (§5), com `map:` onde o
  nome gerado pelo Prisma não bate com o da migration:
  `backoffice_adhesions_sponsor_master_id_idx`,
  `corretor_studio_leads_referrer_lead_idx`,
  `lead_custom_field_values_definition_value_idx`,
  `whatsapp_outbound_commands_reconcile_idx`,
  `whatsapp_webhook_events_status_created_at_idx`.
  `team_whatsapp_configs.webhookSecret` virou `@unique` (a migration criou
  `CREATE UNIQUE INDEX`, o schema declarava `@@index` comum).

### 7.3 Resultado medido

| | antes | filtro + schema | + rename §7.4 | + FK §7.5 | + §7.6 |
|---|---:|---:|---:|---:|---:|
| statements | 1.853 | 563 | 302 | 10 | **0** |
| bytes de SQL | 189.709 | 81.687 | 47.071 | 1.440 | **0** |
| `drop table` | 1 | 0 | 0 | 0 | 0 |
| `drop type` | 1 | 0 | 0 | 0 | 0 |
| `drop index` | 133 | 107 | 1 | 1 | 0 |
| `create index` | 113 | 113 | 7 | 7 | 0 |
| `drop`/`add constraint` | 232 | 231 | 195 | 0 | 0 |
| `alter column` | 162 | 2 | 2 | 2 | 0 |
| `grant`/`revoke` | 1.099 | 0 | 0 | 0 | 0 |

### 7.4 Migration de rename — `20260824010431_align-constraint-and-index-names.sql`

Adota os nomes do Prisma como canônicos: **18 constraints + 101 índices**,
via `ALTER TABLE … RENAME CONSTRAINT` e `ALTER INDEX … RENAME TO`. RENAME é
operação de catálogo — não relê tabela, não reconstrói índice, não revalida FK.
O `supabase db diff` propunha recriar todos eles.

Os pares foram levantados comparando o **catálogo** de um replay limpo das 311
migrations (banco descartável) com o catálogo do `schema.prisma` aplicado, e
pareados por **definição idêntica** (`pg_get_constraintdef` / `pg_get_indexdef`
sem o nome) — nunca por semelhança de nome. Par cuja definição diverge ficou de
fora, porque rename não resolveria (§7.5).

Verificação no replay limpo:

| | |
|---|---|
| aplica sem erro | sim |
| idempotente (2ª execução) | sim, no-op |
| contagem de constraints | 601 → 601 |
| contagem de índices | 517 → 517 |
| definições preservadas | sim, multiset idêntico |
| renames pendentes | 119 → **0** |

Uma armadilha que quase passou: `to_regclass('public.nome_com_maiúscula')`
rebaixa o identificador não-aspado para minúsculas e devolve NULL, então o guard
de idempotência nunca dispararia para os 23 índices camelCase. As aspas internas
(`to_regclass('public."nome"')`) são obrigatórias.

### 7.5 `ON UPDATE CASCADE` — `20260824011707_align-foreign-key-referential-actions.sql`

Depois do rename o diff cai para **47.071 bytes**, e o que resta **não** é
diferença de nome — é diferença de **definição**:

```
 98  drop constraint
 97  add constraint     ← 97/97 são FOREIGN KEY … ON UPDATE CASCADE
 97  validate constraint
  7  create index
  2  alter column
  1  drop index
```

O Prisma emite `ON UPDATE CASCADE` por padrão em relação obrigatória; as
migrations históricas escreveram as FKs sem cláusula `ON UPDATE` (= `NO ACTION`):

```
shadow: FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON DELETE CASCADE
local : FOREIGN KEY ("teamId") REFERENCES corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE
```

Na prática as duas se comportam igual — as FKs apontam para PK `uuid`, que nunca
é atualizada, então `ON UPDATE` nunca dispara. Mas enquanto os lados discordarem,
o diff reescreve as FKs em toda execução.

**Decisão: banco → Prisma.** A migration usa `DROP CONSTRAINT` +
`ADD CONSTRAINT … NOT VALID` + `VALIDATE CONSTRAINT` em **98 FKs**. O `NOT VALID`
só toca catálogo (lock curto); o `VALIDATE` pega `SHARE UPDATE EXCLUSIVE` e não
bloqueia leitura nem escrita. Nenhum dado é reescrito.

14 dessas 98 divergiam em nome **e** definição ao mesmo tempo — a migration de
rename (§7.4) não podia tocá-las, porque ela só pareia definição idêntica. Aqui o
DROP/ADD resolve os dois de uma vez.

Duas vão além do `ON UPDATE` e merecem atenção na revisão:

```
team_whatsapp_configs_createdByProfileId_fkey
team_whatsapp_configs_updatedByProfileId_fkey
  de  : FOREIGN KEY (…) REFERENCES corretor_studio_profiles(id)
  para: FOREIGN KEY (…) REFERENCES corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT
```

A migration original não declarou `ON DELETE` (= `NO ACTION`); o `schema.prisma`
declara relação obrigatória, e o Prisma emite `ON DELETE RESTRICT`. As duas
impedem a exclusão do `Profile` referenciado; diferem só em quando a checagem
acontece (`NO ACTION` é adiável, `RESTRICT` não).

Verificação no replay limpo: aplica com exit 0, idempotente, 601 → 601
constraints, delta de definição contra o `schema.prisma` de 98 → **0**, e
**0** constraints deixadas `NOT VALID`.

### 7.6 Últimos 10 itens — `20260824011945_sync-remaining-schema-drift.sql`

- 7 `@@index`/`@unique` declarados no `schema.prisma` que nenhuma migration criou
- 1 `DROP INDEX` de `team_whatsapp_configs_webhookSecret_idx`, duplicata do índice
  único que a migration `20260618223151_whatsapp-module.sql` já criava
- 2 `ALTER COLUMN` de precisão em `corretor_studio_radar_pixel_rate_limits`
  (`TIMESTAMPTZ` typmod −1 → `timestamptz(6)`)
- 1 `SET DEFAULT ARRAY[]::text[]` em
  `corretor_studio_team_radar_pixel_configs.allowedOrigins`: a migration escreveu
  `'{}'::text[]` e o Prisma emite `ARRAY[]::text[]` para `@default([])`. Mesmo
  valor, texto diferente em `pg_attrdef` — normalizar é no-op de comportamento

Quatro colunas tinham default físico que o `schema.prisma` não declarava, o que
fazia o `db push` derrubá-las. Declaradas agora, para que o filtro de §7.1 possa
ser restrito a defaults client-side sem perder essas:

| coluna | default no banco | declaração |
|---|---|---|
| `backoffice_lead_extractions.filters` | `'{}'::jsonb` | `@default("{}")` |
| `whatsapp_messages.rawPayload` | `'{}'::jsonb` | `@default("{}")` |
| `corretor_studio_team_radar_pixel_configs.allowedOrigins` | `'{}'::text[]` | `@default([])` |
| `corretor_studio_lead_document_requests.expiresAt` | `now() + '30 days'` | `@default(dbgenerated(…))` |

Além disso, `backoffice_adhesions_discount_approved_by_fkey` foi trazida para o
`schema.prisma` como `@relation("BackofficeAdhesionDiscountApprover", …, map: …)` —
a coluna estava declarada, mas sem relação, então o Prisma não gerava a FK e o
diff pedia para dropá-la.

Duas armadilhas nesta etapa:

- `information_schema.columns.datetime_precision` devolve `6` tanto para
  `timestamptz` quanto para `timestamptz(6)`. Um guard de idempotência baseado
  nela nunca dispara — é preciso ler `pg_attribute.atttypmod` (`-1` vs `6`).
- Declarar a `@relation` transforma `discountApprovedByProfileId` em FK de
  relação, e ela deixa de existir em `BackofficeAdhesionUpdateInput` (só na
  variante `Unchecked`). `BillingEngineRepository.updateAdhesionDiscount` passou
  a aceitar as duas formas, como o próprio `prisma.update`.

### 7.7 Estado final

Replay limpo das 314 migrations + `schema.prisma` aplicado:

```
▶ Filtrados 1266 statement(s) que o Prisma não gerencia:
    1106  GRANT/REVOKE (pg_default_acl do shadow database)
     159  ALTER COLUMN … DROP DEFAULT (default físico da coluna)
       1  POLICY / ROW LEVEL SECURITY (RLS não vive no schema.prisma)

✅ Só havia ruído de ACL/default/policy. Nenhuma mudança de schema real.
```

**189.709 → 0 bytes.**

### 7.8 Estado no remoto

CLI linkado ao projeto `wcnxwdcoambpfwxwubka` (`corretor-studio`). `config.toml`
não foi alterado pelo link. `bun run db:migrate:push:dry-run`:

```
Would push these migrations:
 • 20260824010431_align-constraint-and-index-names.sql
 • 20260824011707_align-foreign-key-referential-actions.sql
 • 20260824011945_sync-remaining-schema-drift.sql
```

Só as três novas estão pendentes — as 311 anteriores já constam em
`supabase_migrations.schema_migrations` no remoto. **Nenhuma foi aplicada.**

### 7.9 Conferência do catálogo de produção (24/08/2026)

As três migrations são guardadas por nome e definição exatos
(`WHERE conname = … AND pg_get_constraintdef(oid) = …`). É isso que as torna
idempotentes, mas também significa que um catálogo de produção divergente faz o
guard não casar, o bloco ser pulado **em silêncio** e a migration ser marcada
como aplicada sem ter feito nada. O dry-run não detecta: ele compara a tabela de
histórico, não o catálogo.

Conferido via `pg_constraint`/`pg_index` do remoto (somente leitura). Produção
**não** é idêntica ao replay das migrations:

| | constraints | índices |
|---|---:|---:|
| replay das 311 migrations | 601 | 517 |
| produção | 601 | 521 |

**Renames (119):** 15 constraints + 81 índices vão renomear; 3 + 18 já estão
renomeados em produção (no-op correto); 0 sumiram.

**FKs (98 blocos):** só 50 guards casam. À primeira vista parecia metade da
migration virando no-op silencioso — mas os números fecham:

| | total FKs | com `ON UPDATE CASCADE` | sem |
|---|---:|---:|---:|
| replay das migrations | 343 | 238 | 105 |
| produção | 343 | 286 | 57 |
| alvo (`schema.prisma`) | 343 | 336 | 7 |

Produção precisa de exatamente **50** mudanças, e são exatamente os **50** guards
que casam. Os 43 "definição diferente" já estão no alvo e os 5 "ausentes" já
foram renomeados lá. Os 48 blocos pulados são no-ops corretos.

As 7 FKs que ficam sem `ON UPDATE` nos três cenários são as que o Prisma não
gerencia (`profile_subscriptions_*`, `profile_user_type_assignments_*`,
`backoffice_product_payment_rules_productid_fkey`,
`profile_subscription_capacities_subscription_id_fkey`).

**Índices ÚNICOS novos:** 0 duplicatas reais. `team_whatsapp_contacts` tinha 3
grupos com 4.170 linhas, mas todos com `phoneE164 IS NULL` — e índice único no
Postgres é `NULLS DISTINCT` por padrão, então não colidem.

#### Três problemas que a conferência pegou

1. **`team_whatsapp_configs_webhookSecret_key` não existe em produção** — só o
   `_idx` comum. A versão original de §7.6 dropava o `_idx`, o que deixaria a
   coluna **sem índice algum e sem a unicidade** que o schema declara. Corrigido:
   cria o `_key` antes de dropar o `_idx` (0 duplicatas no remoto, seguro).
2. **`corretor_studio_leads_referrer_lead_idx` não existe em produção**, e
   `referrerLeadId` está sem índice nenhum — apesar de
   `20260531173050_add-referral-fields-to-lead.sql` constar como aplicada.
   Nenhuma das migrations o recriava. Adicionado `CREATE INDEX IF NOT EXISTS`.
3. **Dois índices coexistindo em produção**, que fariam o RENAME ser pulado e o
   nome antigo ficar para sempre:
   - `whatsapp_auto_response_logs_…_createdAt_i` e `…_created_idx`, definições
     idênticas → dropa o antigo.
   - `corretor_studio_radar_profiles_team_last_seen_idx` (`DESC NULLS LAST`, que é
     o que o schema declara) e `…_teamId_lastSeenAt_idx` (`DESC`, criado fora das
     migrations) → dropa o que não bate com o schema e promove o correto ao nome
     canônico.

Todos os três blocos são no-op onde o estado já está certo, e foram validados no
replay limpo (aplicação dupla, exit 0, estado final com exatamente um índice de
cada).

---

## 8. Resumo executivo

Do arquivo de 187 KB:

- **~48%** é ruído de ACL do shadow database, independente do `prisma db push` (§2).
- **~30%** é churn de nome de índice/constraint, sem mudança semântica (§5, §6).
- **~8%** é remoção de default físico de coluna — destrutivo e silencioso (§3).
- **~15%** é o resto (`validate constraint`, etc.).
- **4 itens** são drift real de estrutura (§4), somando menos de 400 bytes.

O gerador só volta a produzir diff limpo se as três primeiras categorias forem tratadas.
As duas primeiras o Prisma nunca vai gerenciar — pertencem a um filtro no script.
A terceira depende de decisão sobre `@default(dbgenerated(...))` no schema.
