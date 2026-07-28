# Meta / Instagram Audiência → Radar — Design

**Date:** 2026-07-27  
**Status:** Draft for review  
**Approach:** B — conversion-first, módulo completo, entrega faseada  
**UI:** shadcn/ui + Impeccable product register + `DESIGN.md`  
**Mockups:** ASCII (P1–P7)

---

## 1. Problem / Goal

Corretores precisam projetar o público ideal a partir do Instagram Business e alimentar o Radar com contatos acionáveis.

**Goal:** Conectar Meta (Facebook Page + Instagram Business), capturar leads com opt-in (Lead Ads), mapear audiência (insights + engajadores), enriquecer pela base própria do master e sincronizar no Radar — sem enriquecimento estilo MailerFind externo.

---

## 2. Locked decisions

| Topic | Decision |
|---|---|
| Primary v1 outcome | Audiência + contatos (módulo completo, faseado) |
| Contato acionável | Híbrido: identidade social entra sem telefone; telefone/e-mail quando opt-in ou match interno |
| Matéria-prima IG | Seguidores + engajadores (score maior para quem interage), no limite da Graph API |
| Público ideal | Insights agregados + segmentos acionáveis no Radar |
| Fonte de dados | **Somente APIs oficiais da Meta** |
| Enriquecimento PII | Lead Ads / forms (Meta ou Corretor Studio) + MatchEngine na base própria + bio regex como **hint** |
| MailerFind-like externo | **Fora de escopo** |
| Quem só curtiu/comentou | Perfil/hint de engajamento — sem inventar telefone |
| Seguidor frio | PII no Radar só após opt-in |
| Base própria (match) | Toda a base Corretor Studio **dentro do mesmo `Team.masterId`** |
| Bloqueio cross-master | Se lead está na **carteira** ou **em processo de venda** de outro master → não copia PII |
| Exceção bloqueio | Carteira com **contrato vencido há > 90 dias** → PII pode ser usada |
| Conexão Meta | Master por padrão; manager/backoffice com **delegação** em Gerenciar Times |
| Google | Apenas login/calendário (como hoje) — não é fonte de Instagram |

---

## 3. Architecture (conversion-first)

```
Meta (OAuth Page + IG Business)
        │
        ├─ Lead Ads / webhooks ──► Lead (CRM) + RadarProfile + consentimento
        │
        ├─ IG Insights / engajadores ──► SocialIdentity (hints)
        │                                      │
        │                                      ▼
        └─ Bio regex (hint) ──────► MatchEngine (base do master)
                                           │
                                           ├─ hit + permitido ──► enriquece telefone/e-mail
                                           └─ bloqueado (outro master) ──► não copia PII
```

### Phases

| Phase | Delivery | Value |
|---|---|---|
| **1** | OAuth Meta (master + delegação), Lead Ads → webhook → CRM/Radar, Conexões | Lead com telefone + opt-in |
| **2** | Sync engajadores/insights + bio regex + MatchEngine + reprocess on update | Audiência + enriquecimento interno |
| **3** | ICP/público ideal + segmentos Radar + score + polish delegação | Produto completo |

### Explicit non-goals

- Scraping / brokers externos de telefone/e-mail a partir do handle
- Telefone de quem só curtiu sem Lead Ad / DM / form / match
- Google como fonte de dados Instagram

---

## 4. UI / UX

### Design contract

- **Register:** product (Impeccable) — Restrained, task-first
- **Tokens:** `DESIGN.md` / semantic CSS variables — no hardcoded hex for themable UI
- **Components:** shadcn/ui only (`Button`, `Card`, `Tabs`, `Table`, `Badge`, `Sheet`, `Dialog`, `AlertDialog`, `Skeleton`, `Field`/`FieldGroup`, `Separator`, `Switch`, `Alert`, `Tooltip`, `sonner`)
- **Patterns:** `gap-*`, request lock on mutation buttons, Sheet/Dialog `max-h-[90vh]` + scroll body + fixed footer
- **Anti-goals:** hero-metric card grids, decorative glass, inventing non-shadcn controls

### Surface map

| ID | Route / surface | Phase | Job |
|---|---|---|---|
| P1 | `/{id}/account` → tab Conexões | 1 | Conectar Meta |
| P2 | `/{id}/teams` → delegação Meta | 1/3 | Master libera manager/backoffice |
| P3 | `/{id}/meta/leads` (nova) | 1 | Forms Lead Ads, webhook, leads |
| P4 | `/{id}/radar` → tab Audiência | 2–3 | Insights + engajadores + hints |
| P5 | Radar Profile Sheet | 2 | Identidades sociais + match |
| P6 | Radar Segment Builder | 3 | Segmentos ICP / engajamento |
| P7 | Empty / onboarding Meta | 1 | Primeiro uso |

### ASCII mockups

#### P1 — Minha Conta · Conexões

```
┌──────────────────────────────────────────────────────────────┐
│  Minha Conta                                                 │
│  Gerencie seu perfil e configuracoes de seguranca.           │
├──────────────────────────────────────────────────────────────┤
│  [ Perfil ]  [ Seguranca ]  [ Conexoes * ]                   │
├──────────────────────────────────────────────────────────────┤
│  ┌─ Google ──────────────────────────────────────────────┐   │
│  │  Status: Conectado   calendar@empresa.com             │   │
│  │                              [ Desconectar ]          │   │
│  └───────────────────────────────────────────────────────┘   │
│  ┌─ Meta / Instagram Business ───────────────────────────┐   │
│  │  Status: Desconectado                                 │   │
│  │  Conecte a Facebook Page + Instagram Business         │   │
│  │  para Lead Ads e audiencia no Radar.                  │   │
│  │  [ Conectar Meta ]          [ Como conectar ]         │   │
│  └───────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

#### P2 — Gerenciar Times · Delegação Meta

```
┌──────────────────────────────────────────────────────────────┐
│  Gerenciar Times                                             │
│  Permissoes de integracao · Meta                             │
├──────────────────────────────────────────────────────────────┤
│  Membro              Papel         Pode conectar Meta        │
│  ─────────────────────────────────────────────────────────   │
│  Ana Silva           Manager       [====ON====]              │
│  Bruno Costa         Operator      [   OFF    ]              │
│  Backoffice user     Delegado      [====ON====]              │
│  Nota: apenas o master altera a delegacao.                   │
└──────────────────────────────────────────────────────────────┘
```

#### P3 — Meta Lead Ads

```
┌──────────────────────────────────────────────────────────────┐
│  Meta Lead Ads                    [ Sincronizar formularios ]│
├──────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────┐              │
│  │ Webhook    │  │ Ultimo lead│  │ Forms      │              │
│  │ Saudavel   │  │ hoje 11:42 │  │ ativos: 3  │              │
│  └────────────┘  └────────────┘  └────────────┘              │
├──────────────────────────────────────────────────────────────┤
│  [ Formularios * ]  [ Leads recentes ]  [ Logs ]             │
├──────────────────────────────────────────────────────────────┤
│  Formulario          Page / IG           Status    Leads     │
│  Cotacao PME         @corretor.ana       Ativo     128   >   │
│  Campanha Jul        Page Clinica X      Pausado    41   >   │
└──────────────────────────────────────────────────────────────┘
```

#### P3b — Sheet do lead

```
                    ┌────────────────────────────────────┐
                    │  Lead · Maria Souza            [x] │
                    ├────────────────────────────────────┤
                    │  Telefone / Email                  │
                    │  Origem: Meta Lead Ad              │
                    │  Consentimento OK · Radar criado   │
                    │  Instagram: sem vinculo ainda      │
                    │  [ Abrir no CRM ]  [ Ver no Radar ]│
                    └────────────────────────────────────┘
```

#### P4 — Radar · Audiência

```
┌──────┬───────────────────────────────────────────────────────┐
│ Side │  Radar · [ Perfis ] [ Segmentos ] [ Audiencia * ]     │
│ bar  ├────────────────────────┬──────────────────────────────┤
│      │  PUBLICO DO @seu.ig    │  ENGAJADORES + HINTS         │
│      │  Idade / Genero /      │  Filtros + tabela           │
│      │  Cidades (agregado)    │  handle | score | sinal |    │
│      │  sem PII individual    │  matched / hint / bloqueado  │
└──────┴────────────────────────┴──────────────────────────────┘
```

#### P5 — Sheet perfil Radar

```
                    ┌────────────────────────────────────┐
                    │  Perfil Radar · Joao Silva     [x] │
                    │  Tel / Email / Badge CRM           │
                    │  IDENTIDADES: IG + Match + Bio hint│
                    │  TIMELINE: engajou · Lead Ad · match│
                    │  [ Sync perfil ]   [ Abrir Lead ]  │
                    └────────────────────────────────────┘
```

#### P6 — Dialog segmento ICP

```
              ┌──────────────────────────────────────────┐
              │  Novo segmento · Instagram           [x] │
              │  Nome + regras (engaged, phone, origin)  │
              │  Preview ~ N perfis                      │
              │  [ Cancelar ]  [ Salvar segmento ]       │
              └──────────────────────────────────────────┘
```

#### P7 — Empty state

```
┌──────────────────────────────────────────────────────────────┐
│  Radar · Audiencia                                           │
│                                                              │
│         Conecte o Instagram Business                         │
│         Lead Ads captura telefone com consentimento.         │
│         Engajadores entram como hints no Radar.              │
│         [ Ir para Conexoes ]                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Data model

### Reuse

- Product Meta Lead path (`MetaLeadUseCase`, `/api/webhooks/meta`, `originChannel = meta_webhook`)
- Radar profiles / identities / events / consents / segments
- `Team.masterId`, `LeadPortfolio`, Google OAuth (unchanged)

### Add / extend

| Entity | Change |
|---|---|
| `MetaOAuthConnection` (new) | Tokens Page/IG, `masterId`, status, `connectedByProfileId` |
| Team permission | `canConnectMeta` (member flag or permission row) |
| `RadarIdentityType` | `instagram_igsid`, `instagram_username` |
| `RadarSourceType` | `meta_lead_ad`, `instagram_engagement`, `instagram_bio_hint`, `internal_match` |
| `RadarProfile` | Allow social-only: `normalizedPhone` nullable; unique strategy when phone absent |
| `SocialAudienceSnapshot` (optional P2) | Aggregated insights per connected IG |
| `MatchAttempt` / Radar events | `matched` \| `hint_only` \| `blocked_other_master` \| `no_hit` + reason |

### Social-only profile rule

- Primary social identity = `instagram_igsid` (unique per `teamId`)
- When Lead Ad / Match fills phone → merge into phone-bearing profile using existing Radar dedupe rules

---

## 6. MatchEngine

### Search scope

All teams sharing the requester’s `Team.masterId`.

### Match keys (order)

1. Normalized Instagram username
2. Bio regex phone/email × Radar/CRM identities of the master
3. Normalized name = weak suggestion only (never auto-merge alone)

### Cross-master block

```
BLOCK copying PII if, under another master:
  (lead in LeadPortfolio) OR (lead in active sales process)
EXCEPT portfolio with contract expired > 90 days
  → PII may be used for the requesting master
```

**Active sales process (proposed):** CRM statuses that are not terminal  
(`disqualified`, `opportunityLost`, `operator_denied` = not blocking as “in sale”; refine in implementation against live funnel).

**Contract expired > 90d:** use `Lead.contractDueDate` (or portfolio vigência) `< now() - 90 days` while still on portfolio — confirm in schema mapping during implementation.

### Reprocess

On Lead / Portfolio / Meta Lead / Radar sync create-update → enqueue `MatchEngine.recheck(identityKeys)`.

---

## 7. RLS

Pattern: Prisma `service_role` bypasses RLS; policies protect `authenticated` (Data API / Realtime / future client). Base predicate mirrors `corretor_studio_radar_segments`:

```sql
EXISTS (
  SELECT 1
  FROM corretor_studio_team_members tm
  JOIN corretor_studio_profiles p ON p.id = tm."profileId"
  WHERE tm."teamId" = <row.teamId>
    AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
)
```

### Helpers (idempotent)

- `is_team_member(team_id uuid)`
- `is_team_master(team_id uuid)` — auth profile is `Team.masterId`
- `can_manage_meta_connection(team_id uuid)` — master OR member with `canConnectMeta`

### Policies

| Table | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `meta_oauth_connections` | master of connection **or** delegated member of that master’s teams | `can_manage_meta_connection` only |
| `canConnectMeta` flag | team members (same team) | **master only** |
| Meta forms cache / audience snapshots / engagers | `is_team_member(teamId)` | member or service_role |
| `match_attempts` | `is_team_member(teamId)` | prefer **service_role only** |
| Radar `*` extensions | existing team-member policies | unchanged predicate |

### Hard rules

1. **Tokens Meta never** returned to client (API strips secrets; no client SELECT on raw token columns — use view without secrets if needed).
2. MatchEngine cross-team / cross-master logic runs **only** under `service_role`.
3. `authenticated` **must not** SELECT another master’s Lead/Radar PII via PostgREST.
4. Blocked matches store status/reason **without** copying foreign phone/email onto the row.
5. `anon` → deny all; `service_role` → full access for webhooks/API.

### RLS acceptance tests

1. Member team A reads A audience → allow  
2. Member team A reads master B leads → deny  
3. Master updates `canConnectMeta` → allow; non-master → deny  
4. Delegated manager connects Meta → allow; without flag → deny  
5. Webhook Lead Ad via service_role → allow  
6. Client response has no Meta refresh_token  

Migration: `bun run db:migrate:new meta-instagram-rls` (manual SQL, idempotent). **No remote push without owner authorization.**

---

## 8. Errors & LGPD

| Case | Behavior |
|---|---|
| Meta token expired | Badge + reauth CTA; sync stops |
| No IG Business / Page | Alert on Conexões |
| Lead Ad webhook failure | P3 logs + sonner; idempotent retry by `leadgenId` |
| Match blocked | Badge `bloqueado`; no PII copy; event with reason |
| Ambiguous bio regex | hint only; do not promote to primary phone/email |
| No Meta delegation | 403 |
| Meta rate limit | queue + backoff |

Consent: Lead Ad → `allowed` with Meta opt-in provenance. Cold engager → no outbound channel until opt-in. Audit: who connected Meta, who changed delegation, each match/block.

---

## 9. Testing (acceptance)

- OAuth connect/disconnect/reauth + delegation
- Lead Ad → Lead `meta_webhook` → Radar inline
- Social-only profile without phone + merge when phone arrives
- Match same master (teams A↔B)
- Block other master (portfolio / in-sale)
- Allow expired contract > 90 days
- Recheck on Lead/portfolio update
- Bio regex hit/miss/non-promotion
- UI: empty P7, button locks, Sheet scroll
- RLS cases in §7

---

## 10. Pré-requisitos manuais Meta — instruções e motivos

Etapas **fora do código**. Sem elas o módulo não autentica, não recebe leads e não lê Instagram. Guia legado de Lead Ads (mais detalhe de tela): `docs/META_LEAD_ADS_SETUP.md`.

Há **dois papéis**:

1. **Time Corretor Studio** — configura **um** App Meta da plataforma (feito uma vez).
2. **Cada master/corretor** — prepara Page + IG e conecta na UI (feito por cliente).

---

### 10.1 Quem faz o quê

| Quem | Faz | Por quê |
|---|---|---|
| Eng / Ops Corretor Studio | Cria App, Login, Webhooks, env, App Review | A Meta só fala com apps registrados; sem isso nenhum corretor conecta |
| Master (ou delegado) | Converte IG, vincula Page, clica “Conectar Meta”, cria Lead Ads | A autorização é **do negócio dele**; a plataforma não pode “pegar” Page/IG sem OAuth |
| Meta (App Review) | Aprova permissões avançadas | Em produção, permissões sensíveis não funcionam só com app em modo dev |

---

### 10.2 Plataforma — passo a passo (App Meta)

#### Passo 1 — Criar o App

1. Acesse [developers.facebook.com](https://developers.facebook.com) → **Meus Apps** → **Criar App**.
2. Tipo: **Negócios** (Business).
3. Nome claro (ex.: `Corretor Studio`) + e-mail de contato.

**Por quê:** Toda chamada à Graph API e todo OAuth precisam de um **App ID**. Sem app, não existe integração oficial.

#### Passo 2 — Preencher dados básicos do App

Em **Configurações → Básico**:

1. **URL da Política de Privacidade** (página pública HTTPS).
2. **Ícone do app** (1024×1024 PNG).
3. **Categoria** (ex.: Business / Marketing).
4. (Recomendado) URL de Termos de Serviço.

**Por quê:** A Meta **bloqueia** colocar o app ao vivo e/ou App Review sem privacidade e identidade mínima. Também é exigência legal/LGPD ao tratar leads.

#### Passo 3 — Colocar o App **ao vivo**

1. No topo do painel, sair de **Desenvolvimento** → **Ao vivo**.
2. Resolver pendências que o painel listar.

**Por quê:** Em desenvolvimento, só admins/testadores do app usam Login/webhooks de verdade. Clientes reais **falham** em silêncio ou com erro de permissão se o app continuar em modo dev.

#### Passo 4 — Adicionar produto **Webhooks**

1. **Adicionar produto** → **Webhooks**.
2. Objeto típico: **Page** (eventos `leadgen`).
3. Callback URL: `https://<dominio-app>/api/webhooks/meta`.
4. Verify token = valor de `META_VERIFY_TOKEN` no servidor.
5. Inscrever o campo **leadgen**.

**Por quê:** Lead Ads não “empurram” o lead completo no POST. O webhook avisa com `leadgen_id`; o backend busca os campos na Graph API. Sem webhook, a Fase 1 (conversão com telefone) não é tempo real.

#### Passo 5 — Adicionar **Facebook Login** (ou Login for Business)

1. **Adicionar produto** → Facebook Login / Login for Business.
2. Ativar Login no servidor (OAuth code flow).

**Por quê:** A SPEC exige **token por master**, não um `META_ACCESS_TOKEN` único para todos. O corretor autoriza Page + IG na tela Conexões; o Login é o mecanismo oficial dessa autorização.

#### Passo 6 — Cadastrar OAuth Redirect URIs

1. Em Facebook Login → **Configurações**.
2. Incluir URIs HTTPS exatas do Corretor Studio, por ambiente, por exemplo:
   - produção: `https://app.corretoresstudio.../api/v1/meta/oauth/callback` (path final definido na implementação)
   - preview/staging, se usados em teste

**Por quê:** Depois do consentimento, a Meta só redireciona para URIs **pré-cadastradas**. URI errada = erro `redirect_uri_mismatch` e conexão impossível.

#### Passo 7 — Pedir as permissões Graph necessárias

Solicitar (nomes exatos podem variar na versão da API; validar no painel):

| Permissão (exemplos) | Para quê | Por quê |
|---|---|---|
| `pages_show_list` / `pages_manage_metadata` | Listar Pages do usuário | Escolher qual Page conectar |
| `pages_read_engagement` | Dados de engajamento da Page | Base para audiência / contexto |
| `leads_retrieval` | Ler dados do Lead Ad | Sem isso o webhook não consegue telefone/e-mail do form |
| `instagram_basic` | Conta IG Business ligada | Identidade do perfil profissional |
| `instagram_manage_insights` | Insights agregados | “Público ideal” (idade/gênero/cidades) |
| (Fase posterior) messaging, se escopo incluir DM | Conversas | Só se a fase de messaging entrar no plano |

**Por quê:** A Graph API é **opt-in por permissão**. Pedir de menos = feature quebrada; pedir de mais = App Review mais difícil. Fase 1 prioriza Lead Ads; Fase 2 prioriza insights/engajadores.

#### Passo 8 — Submeter **App Review**

1. Em **Análise do app**, justificar caso de uso (CRM de corretores, leads com consentimento, insights do próprio IG).
2. Screencast / instruções de teste para o revisor Meta.
3. Aguardar aprovação por permissão.

**Por quê:** Sem review, só contas de teste usam permissões avançadas. Produção com masters reais **exige** aprovação.

#### Passo 9 — Configurar variáveis de ambiente no servidor

| Variável | Uso | Por quê |
|---|---|---|
| `META_APP_ID` | Iniciar OAuth | Identifica o app no Login |
| `META_APP_SECRET` | Trocar code→token + validar HMAC do webhook | Segredo do app; **nunca** no browser |
| `META_VERIFY_TOKEN` | Handshake GET do webhook | Meta confirma que o endpoint é nosso |
| Tokens Page/IG do master | Persistidos em `MetaOAuthConnection` (DB) | Isolamento por cliente; revogação individual |

**Por quê:** O modelo legado com só `META_ACCESS_TOKEN` global não escala multi-tenant e mistura dados/autorizações. A SPEC migra para OAuth por master; o secret do **app** continua no env.

#### Passo 10 — Domínio HTTPS estável

Webhook e redirect OAuth em HTTPS público (Vercel/produção). Local: túnel (ngrok etc.) só para dev.

**Por quê:** A Meta não chama `localhost` em produção. Certificado/domínio instável derruba leads sem alerta óbvio no CRM.

---

### 10.3 Por corretor / master — passo a passo

#### Passo A — Ter (ou receber admin de) uma Facebook Page

**Por quê:** Instagram profissional e Lead Ads da Graph API andam atrelados à **Page**. Sem Page, não há objeto para webhook `leadgen` nem vínculo IG Business via Login.

#### Passo B — Converter Instagram para **Business** ou **Creator**

No app Instagram: configurações → conta profissional.

**Por quê:** Conta **pessoal** não entra na Instagram Graph API. Insights, business discovery e gestão via app de negócios exigem Professional.

#### Passo C — Vincular o Instagram à Facebook Page

No IG ou no Meta Business Suite: conectar perfil ↔ Page.

**Por quê:** O token OAuth da Page é a “chave” que a API usa para falar com aquele IG. Sem vínculo, o Login pode até completar e ainda assim **não** listar IG / insights.

#### Passo D — (Recomendado) Organizar no Meta Business Manager

Especialmente se Page/IG forem de cliente ou agência.

**Por quê:** Evita “conectei no perfil pessoal errado”, facilita roles e App Review com assets claros.

#### Passo E — Conectar na UI do Corretor Studio (P1)

1. Master (ou manager/backoffice **com** `canConnectMeta`) abre **Minha Conta → Conexões**.
2. Clica **Conectar Meta**, aceita permissões, escolhe Page + IG.
3. Confere badge **Conectado**.

**Por quê:** É o momento em que o consentimento OAuth e os tokens entram no banco (`MetaOAuthConnection`), sob RLS/cerca do master. Sem esse passo, Lead Ads e audiência não têm credencial do **negócio dele**.

#### Passo F — Criar formulário Lead Ad no Ads Manager

1. Campanha com objetivo de leads.
2. Formulário Instantâneo com telefone e/ou e-mail + texto de consentimento.
3. Publicar anúncio no Facebook e/ou Instagram da Page conectada.

**Por quê:** É a única forma **oficial Meta** de obter telefone/e-mail com opt-in neste desenho. Seguidores/curtidas **não** entregam PII pela API.

#### Passo G — Validar ponta a ponta

1. Enviar lead de teste (ou ferramenta de teste de leadgen da Meta).
2. Conferir webhook saudável na P3.
3. Ver Lead no CRM (`originChannel = meta_webhook`) + perfil no Radar.

**Por quê:** Separar falha de App/permissão, falha de Page/IG e falha de mapeamento de campos evita debug cego em produção.

#### Passo H — Delegação (se manager for conectar)

Master em **Gerenciar Times** liga **Pode conectar Meta**.

**Por quê:** Tokens e Page são ativos sensíveis; a SPEC restringe conexão ao master salvo delegação explícita.

---

### 10.4 Ordem recomendada (para não refazer trabalho)

```
1. App Meta criado + básicos + ao vivo
2. Webhooks + Login + redirect URIs + env
3. App Review (pelo menos leads_retrieval)     ← pode ser paralelo ao dev
4. Master de teste: Page + IG Business + vínculo
5. Conectar na UI
6. Lead Ad de teste → CRM/Radar
7. Só então: Fase 2 insights/engajadores (permissões + review extras)
```

**Por quê dessa ordem:** OAuth/redirect/env quebrados impedem qualquer teste de corretor. Review demora dias/semanas — não deixar para o fim. Audiência (Fase 2) depende de permissões que a Fase 1 ainda não precisa.

---

### 10.5 O que o código **não** substitui

| Item | Por quê continua manual |
|---|---|
| Criar App + App Review | Processo Meta / jurídico / screencast |
| Política de privacidade pública | Exigência Meta + LGPD |
| Converter IG + vincular Page | Ação na conta do corretor |
| HTTPS estável | Infra / DNS |
| Aprovação de permissões restritas (ex. seguidores em escala) | Política Meta; pode nunca liberar — ver §12.4 |

---

### 10.6 Checklist mínimo — Fase 1 em produção

**Plataforma**

- [ ] App ao vivo
- [ ] Webhooks (`/api/webhooks/meta`) verificando com `META_VERIFY_TOKEN`
- [ ] Facebook Login + redirect URIs corretos
- [ ] `META_APP_ID` + `META_APP_SECRET` no servidor (não no client)
- [ ] App Review mínimo para Lead Ads (`leads_retrieval` e correlatas)

**Corretor piloto**

- [ ] Page com admin adequado
- [ ] IG Business/Creator vinculado à Page
- [ ] Conexão OK na UI (P1)
- [ ] Lead Ad de teste criou Lead + Radar com telefone/e-mail e consentimento

**Segurança**

- [ ] Resposta de API **sem** refresh/access token Meta no browser
- [ ] Só master/delegado consegue conectar (P2)

---

## 11. Implementation notes (for plan)

- Prefer extending existing Meta Lead + Radar modules over a parallel CDP.
- Feature registration: if new `featureSlug`, seed `backoffice_features` via migration + `seed-backoffice-products.ts`.
- Backend: `Route → UseCase → Service → Prisma` + `Output`; pass `TeamContext` once per request.
- Frontend: page-local `features/{context,services,container}` for new surfaces (P3/P4).
- Governance validation after edits: typecheck, lint, governance:check, lint:pt-br, design:check (UI).

---

## 12. Open items for implementation plan (not TBD product)

1. Exact CRM status set for “em processo de venda”
2. Exact field for “contrato vencido” (`contractDueDate` vs portfolio fields)
3. Final route slug for P3 (`/meta/leads` vs nested under Radar)
4. Whether followers list is available under current Meta app review permissions (fallback: engagers + insights only)

---

## Spec self-review

- [x] No placeholder TBDs for product decisions (open items are implementation mapping only)
- [x] Architecture matches UI phases and Match/RLS rules
- [x] Scope is one module with three shippable phases
- [x] Ambiguities resolved: Meta-only APIs, master fence, hybrid contact, no external enrichment
- [x] Manual Meta prerequisites documented with why/how (§10)
