# Auditoria — Migração do motor da Discadora (Twilio → 3C Plus) + Billing de Repasse

**Data:** 2026-07-12
**Branch inspecionada:** `claude/loving-wozniak-y4bmrd` (PR [#306](https://github.com/matheuswillock/lead-flow-app/pull/306))
**Escopo:** confrontar o que existe hoje (docs + código) contra o novo escopo de produto: trocar o motor de discagem de Twilio por 3C Plus e modelar billing com repasse (custo 3C Plus vs preço cobrado do cliente via Asaas).
**Status das decisões bloqueantes:** resolvidas nesta rodada via pergunta direta ao owner (ver seção 0). A estrutura comercial com a 3C Plus (conta mestre vs conta por cliente) permanece **em aberto** e é a decisão bloqueante mais importante antes de qualquer PR de provisionamento — ver seção 4 e o `DIALER_SPEC.md` reformulado.

---

## 0. Correção de premissa (importante ler antes do resto)

O prompt desta rodada partia de duas suposições que **não se confirmaram** na inspeção do repositório. Registro aqui porque mudam a leitura de todo o resto da auditoria:

1. **Os arquivos citados não existem.** Não há `DIALER_SPEC.md`, `DIALER_IMPLEMENTATION_CONTEXT.md`, `DIALER_IMPLEMENTATION_STATUS.md`, `DIALER_PRICING_AND_COSTS.md`, `DIALER_TRIAL_SETUP.md`, `EMAIL_SPEC.md` ou `BILLING_ENGINE_SPEC.md` em nenhum lugar do repositório (`find . -iname "*.md"` checado). O que existe é:
   - [`docs/TWILIO_AUTO_DIALER_SPEC.md`](TWILIO_AUTO_DIALER_SPEC.md) — v2.1.0, "Plano de implementação aprovado", **inteiramente desenhado em torno do Twilio Programmable Voice**.
   - [`docs/specs/email-dispatch.md`](specs/email-dispatch.md) e [`docs/specs/email-analytics.md`](specs/email-analytics.md) — specs de disparo agendado e analytics de e-mail, não um "motor central de billing".
   - Nenhum `BILLING_ENGINE_SPEC.md` ou equivalente existe. Não há uma camada central de feature-gating de billing a ser "reaproveitada" — o que existe hoje é o par `feature-slugs.ts` / `BackofficeFeatureAccessRule` (visibilidade) + assinaturas específicas por módulo (`EmailCreditSubscription`, `DialerSubscription`) cada uma verificada manualmente pelo próprio módulo.

2. **A discadora já aprovada e em construção usa Twilio, não 3C Plus** — e o próprio spec existente já antecipava e descartava a confusão:
   > "Relação com o webhook 3C Plus: `app/api/webhooks/3cplus/route.ts` (develop) tem propósito distinto: receber leads no CRM a partir de ligações já finalizadas no 3C Plus. É um canal de entrada de leads independente da discadora e **permanece intocado**." (`docs/TWILIO_AUTO_DIALER_SPEC.md`, linha 43-45)

   Evidências no schema/código que confirmam que o motor real hoje é Twilio:
   - `Team` já tem `twilioSubaccountSid`, `twilioSubaccountToken`, `twilioApiKeySid`, `twilioApiKeySecret`, `twilioAppSid`, `twilioNumberSid`, `twilioPhoneNumber` (`prisma/schema.prisma:1218-1225`).
   - `DialerCall.twilioCallSid` é a chave de idempotência da chamada (`prisma/schema.prisma`, model `DialerCall`).
   - `app/api/webhooks/3cplus/route.ts` é um **stub de log** (loga headers/body e retorna 200) — nenhuma lógica de negócio, nenhuma validação de assinatura, não popula nenhuma tabela do domínio Dialer.

   **Perguntei ao owner e a resposta confirma que este é o cenário real desta rodada: existe uma decisão de produto (fora deste chat) de migrar o motor de Twilio para 3C Plus.** A partir daqui, `docs/TWILIO_AUTO_DIALER_SPEC.md` é tratado como **substituído** pelo `DIALER_SPEC.md` reformulado (entregável desta rodada); adicionei um aviso de depreciação no topo do arquivo antigo apontando para o novo.

3. **A premissa "mesma correção já aplicada ao `EmailCreditSubscription` (cobrança por Time)" está incorreta.** No schema atual, `EmailCreditSubscription.profileId` é `@unique` e a FK é `profile` (`prisma/schema.prisma`, model `EmailCreditSubscription`) — billing de e-mail é **por Manager (Profile)**, não por Time. Confirmado também em `EmailCreditService.getStatus(profileId)` (`app/api/services/EmailCredit/EmailCreditService.ts:25`), que consulta por `profileId`. Ou seja, o problema de "Manager com dois Times compartilhando a mesma assinatura" ainda existe no módulo de e-mail — não foi corrigido.
   - Isso não bloqueia a Discadora: `DialerSubscription` **já nasceu correta**, escopada por `teamId @unique` (`prisma/schema.prisma`, model `DialerSubscription`). A Discadora está, neste ponto específico, **à frente** do e-mail, não atrás. Não usar `EmailCreditSubscription` como modelo de escopo a copiar — usar o próprio `DialerSubscription` que já existe.
   - Sinalizo a divergência do e-mail como item para correção futura fora do escopo desta auditoria (não é pedido para resolver aqui).

---

## 1. O que já existe na branch (PR #306) — inventário factual

Diff `main...claude/loving-wozniak-y4bmrd`: 41 arquivos, ~3.760 inserções. Nenhum código de billing, nenhum código de provisionamento de provedor de voz (nem Twilio nem 3C Plus) — confirma a suposição do prompt de que "billing ainda não existe na branch".

| Camada | Arquivo | Estado |
|---|---|---|
| Schema | `prisma/schema.prisma` — `DialerCampaign`, `DialerContact`, `DialerCall`, `DialerUsage`, `DialerSubscription` | Existe. `DialerCall` tem campos **Twilio-específicos** (`twilioCallSid`, `recordingSid`, comentário "URL temporaria no Twilio") que precisam ser generalizados/substituídos. `Team` tem 7 campos `twilio*` que devem ser removidos/substituídos por credenciais 3C Plus. |
| Migration | `supabase/migrations/20260611125755_add-dialer-module.sql` | Existe, aplica os enums/tabelas/RLS acima. RLS já correto (sem SELECT para client; acesso via service role). Precisará de migration nova para renomear/trocar os campos Twilio (não editar a migration já commitada). |
| Repository | `app/api/infra/data/repositories/dialer/{DialerRepository,IDialerRepository}.ts` | Existe. CRUD de campanha/contato com variantes `WithCtx`, já segue a regra de `TeamContext` (`agents.md`). Sem qualquer lógica de billing ou de provedor de voz — puramente CRUD de campanha/contato. |
| UseCase | `app/api/useCases/dialer/{DialerCampaignUseCase,UploadDialerContactsUseCase}.ts` | Existe. Retorna `Output`, cache com tags, invalidation correta. Escopo: CRUD de campanha + upload de contatos. Nenhum uso case de discagem, billing ou provedor. |
| Service | `app/api/services/DialerContactParser/DialerContactParserService.ts` | Existe. Parser de Excel/JSON — agnóstico de provedor, não precisa mudar. |
| Rotas | `app/api/v1/dialer/campaigns/**` (GET/POST/PUT/DELETE campanha, GET/POST contatos e upload) | Existe. Nenhuma rota de discagem, token, webhook de voz ou billing ainda. |
| Frontend | `app/[supabaseId]/dialer/features/**` (container, context, hook, service, components: `CampaignCard`, `CampaignStatusBadge`, `ContactsDialog`, `CreateCampaignDialog`, `UploadContactsDialog`) | Existe. Tela de lista/criação de campanha + upload de contatos. Nenhuma tela de discagem ao vivo, billing ou consumo ainda — essas telas fazem parte dos estágios ainda não implementados. |
| Feature flag | `lib/features/feature-slugs.ts` (`VOICE`, `VOICE_CAMPAIGNS`), `feature-product-slug-map.ts`, `feature-route-access.ts` (`/dialer` → `VOICE`) | Existe e já registrado. Não depende do provedor de voz — não muda com a migração para 3C Plus. |
| Webhook 3C Plus | `app/api/webhooks/3cplus/route.ts` | Existe, mas é **stub de log only** (sem lógica de negócio). Documentado no spec antigo como "canal de entrada de leads, não relacionado à discadora". **Com a migração confirmada, este endpoint precisa de uma decisão explícita**: vira o webhook real de eventos de chamada do novo motor, ou continua sendo um webhook de lead-intake completamente separado e um novo endpoint (`/api/webhooks/3cplus-voice` ou similar) é criado para os eventos do motor de discagem? Ver seção 4. |
| Adapter de voz | `IVoiceProvider` (ou qualquer abstração de provedor) | **Não existe em nenhum lugar do código.** A premissa do prompt de que ele já existe (possivelmente misturando billing) é falsa — ele simplesmente ainda não foi criado. Isso é uma vantagem: não há nada para "desacoplar", o adapter pode nascer já correto. |
| Billing/repasse | Qualquer código de billing, `DialerBillingService`, `ActivateDialerUseCase`, uso de `DialerSubscription`/`DialerUsage`/`dialerEnabled` em UseCase/Service | **Não existe.** Único hit de `dialerEnabled`/`DialerSubscription`/`DialerUsage` no código é a tag de cache em `lib/cache/invalidation.ts` (placeholder de nome, sem lógica). Confirma a suposição do prompt: nada de billing foi implementado ainda. |
| Twilio provisioning | `TwilioSubaccountService`, `TwilioVoiceService`, `@twilio/voice-sdk`, qualquer import de `twilio` fora do schema | **Não existe no código** (só existe na documentação do spec antigo, como plano). `grep -r "twilio"` em `app/` e `lib/` não retorna nenhum arquivo `.ts`/`.tsx`. Ou seja: a dependência de Twilio nunca chegou a ser instalada ou codificada — só está no schema (campos) e no spec (plano). Isso reduz bastante o custo de reverter a decisão: não há código Twilio real para desfazer, só 7 colunas no schema e ~250 linhas de spec.

**Conclusão do inventário**: a branch está inteiramente no estágio "PR 1 — Fundação" do spec antigo (CRUD de campanha, upload de contatos, feature flag) — um estágio que é **agnóstico de provedor de voz** e **não precisa ser refeito**. Tudo que dependeria de Twilio (provisionamento, state machine de discagem, Twilio Client SDK, webhooks de voz, billing) nunca foi codificado, só especificado. A migração para 3C Plus é, na prática, uma reformulação do plano a partir do estágio 2 em diante — não um retrabalho de código já escrito.

---

## 2. 3C Plus — o que a API real confirma (atualizado: spec OpenAPI obtida)

Numa segunda rodada, consegui acessar o **spec OpenAPI/Swagger real da 3C Plus**: a página `https://api-docs.3c.fluxoti.com/` carrega `https://app.3c.plus/api/v1/swagger.json` (159 endpoints, definitions completas). A collection Postman (`https://documenter.getpostman.com/view/25269027/2sA3JT1cqi`) continua sendo uma SPA não legível por fetch simples, e a página de help (`alo.3cplusnow.com/help/voz`) é só um índice de navegação sem conteúdo técnico — mas o swagger.json substitui as duas com muito mais precisão: é a fonte de verdade da API. Isso muda de forma relevante várias conclusões da rodada anterior.

### 2.1 Confirmado com alta confiança (direto do schema da API)

- **Autenticação é por usuário, não por "conta"**: `securityDefinitions.ApiToken` é um `api_token` de query string, e `User.api_token` existe no schema — cada usuário 3C Plus (agente/manager) tem seu próprio token. `POST /authenticate` recebe `company_id` ou subdomínio.
- **3C Plus tem recursos nativos `Teams`, `Users` e `Campaigns`, todos escopados a uma única "company"**: `POST /teams` (name, color, supervisors[], agents[]), `POST /users` (name, extension_number, role: agent|manager, web_extension), `POST /campaigns/{campaign-id}/agents` (agents[]). **Isso confirma que a Hipótese A1 (conta mestre única do Corretor Studio, com um `Team` 3C Plus por Time Lead Flow e um `User` 3C Plus por operador) é tecnicamente viável usando só endpoints públicos documentados — não é necessário nenhum "programa de revenda" especial.** A parte que continua sem confirmação não é mais técnica, é **contratual**: se o contrato/ToS da 3C Plus permite operar uma única conta em nome de múltiplos clientes finais não relacionados entre si. Essa é agora uma pergunta objetiva a levar ao time comercial da 3C Plus, não uma incerteza arquitetural.
- **Billing é pré-pago por saldo, não fatura mensal pós-paga** (correção importante em relação à rodada anterior, que assumia "fatura consolidada"): `Company.balance` ("The company balance") existe no schema; `POST /company/generate-bill` recarrega esse saldo (`amount`: mínimo 200, máximo 2000; `billing_at`: data entre 1 e 5 dias). Não há nenhum endpoint de "fatura mensal" no spec — o modelo real é consumo pré-pago.
- **A tarifa por minuto é exposta via API**: `Route.telephony-rates` → `TelephonyRate` (`minimum_duration`, `minimum_duration_charged`, `cadence`, `type`, `value`). Combinado com `GET /calls` (que retorna `speaking_time`/duração filtrável por `campaigns[]`, ou seja, por Time, já que 1 campanha 3C Plus = 1 Time Lead Flow na Hipótese A1), **dá para calcular o custo real de repasse por Time programaticamente** (Σ duração da chamada × tarifa da rota), sem depender de digitação manual de fatura.
- Schemas `DailyFinanceStats`/`DailyFinanceCallStats`/`DailyFinanceTotalStats` (com `billed_time`, `billed_value`, `speaking_time`, quebra landline/mobile) **existem no spec mas não estão vinculados a nenhum path documentado neste swagger.json** — ou seja, muito provavelmente existe um relatório de consumo/financeiro pronto no produto, mas o endpoint que o retorna não está neste export específico da documentação. **Confirmar isso diretamente com o suporte/comercial da 3C Plus antes de assumir que não existe** — não é a mesma coisa que "a API não suporta".
- **3C Plus controla toda a lógica de discagem preditiva internamente**: `Campaign` tem `amd_enabled`, `asr` (answer-seizure ratio), `recalls`, `call_time`, `wait_time`, `limit_call_per_agent`, `work_break_group_id`, `ivr_after_call_id`, `qualification_list`, `route_landline_id`/`route_mobile_id` — confirma que pacing, AMD, retentativa e qualificação de chamada já são geridos pela 3C Plus. O papel do Lead Flow é configurar a campanha e consumir os resultados, não implementar uma máquina de estados de discagem (mesma conclusão da rodada anterior, agora com evidência direta do schema).
- **Existe webphone próprio da 3C Plus**: `POST /agent/webphone/login`, `POST /webphone/users`. Isso resolve parte da Decisão B (seção 2 do `DIALER_SPEC.md`) — há uma opção de softphone da própria 3C Plus — mas o spec não deixa claro se é embutível via iframe no painel do Lead Flow ou um portal separado; precisa validação ao vivo.
- **Gravações são recuperáveis via API por chamada**: `/calls/{call-id}/recording`, `/recording_amd`, `/recording_consult`, `/recording_transfer`, além de um dump em lote `/records/{year}/{month}/{day}`.
- **Existem dois candidatos a mecanismo de evento em tempo real**, e não ficou claro qual (ou se ambos) o Lead Flow deve usar:
  1. **Socket.IO** (`info.description` do swagger documenta isso explicitamente): canal por company via `socket_channel` (uma string de 32 caracteres configurada em `PUT /company/settings`), com catálogo de eventos documentado — `call-was-created`, `call-was-answered`, `call-was-connected`, `call-was-ended`, `call-was-finished`, `call-was-abandoned`, `call-was-abandoned-due-amd`, `call-was-not-answered`, `call-was-failed`, `call-history-was-created`, `manual-call-acw-connected`/`disconnected`, `hold-call`, `spy-started`/`ended`/`failed`, `list-empty`, `reached-max-online-agents`, `consult-*`. **Isso exige uma conexão persistente de cliente Socket.IO — incompatível com funções serverless do Vercel** (que são de vida curta). Precisaria de um processo sempre ativo (ex.: um pequeno serviço na VPS Hostinger já usada para o bot do WhatsApp) fazendo a ponte entre o socket e o banco/broadcast do Lead Flow.
  2. **Parâmetro `url` por campanha**: `POST /campaigns` aceita `url` ("A valid url for the campaign") e existe `DialerSettings.url` ("The dialer url") no schema — isso sugere um webhook HTTP tradicional por campanha, compatível com rota serverless normal (`app/api/webhooks/3cplus-voice/route.ts`), mas o swagger não documenta o payload nem as condições de disparo desse `url`. **Precisa validação ao vivo** (criar uma campanha de teste apontando para um endpoint de log e observar o que chega) antes de decidir a arquitetura de consumo de eventos.

### 2.2 Ainda não confirmado (levar para o time comercial/técnico da 3C Plus antes do Estágio 5 do `DIALER_SPEC.md`)

- Se o contrato/ToS permite uma única conta 3C Plus operando em nome de múltiplos clientes finais não relacionados (Hipótese A1) — tecnicamente possível, comercialmente incerto.
- Payload e condições de disparo exatas do `url` de campanha (webhook HTTP) vs. a real necessidade de um cliente Socket.IO persistente.
- Se o endpoint de `DailyFinanceStats` (aparentemente existente no produto, órfão neste export do swagger) está disponível e em qual path.
- Se o webphone (`agent/webphone/login`) é embutível via iframe no domínio do Lead Flow ou exige redirecionamento para o domínio da 3C Plus.

**Consequência para a spec**: a reconciliação de repasse deixa de ser puramente "digitação manual de fatura" (como na primeira versão desta auditoria) e passa a ter um caminho automático plausível (saldo pré-pago + tarifa por rota + relatório de chamadas por campanha), mantendo o preenchimento manual como fallback caso o cálculo automático não bata com o extrato real da 3C Plus. Ver seção 4.5 do `DIALER_SPEC.md` reformulada.

---

## 3. Padrões de billing existentes a reaproveitar (precedentes reais no código)

| Padrão | Onde vive hoje | O que reaproveitar para o Dialer |
|---|---|---|
| Assinatura + uso por ciclo, overage calculado | `EmailCreditSubscription` + `EmailCreditUsage` + `EmailCreditService.deductCredits()` (`app/api/services/EmailCredit/EmailCreditService.ts:76-117`) | O cálculo de overage (`Math.ceil(excedente / 100) * taxa`) é o modelo a espelhar para minutos excedentes. **Não copiar o escopo por `profileId`** — usar `teamId`, como o próprio `DialerSubscription` já faz. |
| Item pendente de custo recorrente gated por confirmação de pagamento Asaas | `PendingOperator` + `SubscriptionUpgradeUseCase.confirmPaymentAndCreateOperator/createOperatorFromPending` (`app/api/useCases/subscriptions/SubscriptionUpgradeUseCase.ts`) | Modelo exato para o `PendingDialerSeat` pedido no prompt: só provisiona o recurso real (lá, o operador; aqui, o assento na 3C Plus) depois que `paymentStatus` vira `CONFIRMED`/`RECEIVED` via webhook Asaas. |
| Roteamento de webhook Asaas por prefixo de `externalReference` | `PaymentValidationService` (referenciado no spec antigo, seção 7) — usa prefixo (`"dialer:" + teamId`, `"operator-"`) para decidir a qual módulo o pagamento pertence | Reaproveitar o mesmo prefixo `"dialer:" + teamId` já desenhado no spec antigo para `DialerSubscription` — esse ponto não muda com a troca de provedor. |
| Assinatura já team-scoped desde o desenho original | `DialerSubscription` (`teamId @unique`), `DialerUsage` (`@@unique([teamId, billingMonth])`) | Já correto — só precisa ganhar os campos de custo de repasse (seção 4) e o modelo de assento (seção 4). |

---

## 4. Riscos críticos (CRITIQUE)

1. **[BLOQUEANTE, decisão do owner ainda em aberto — escopo reduzido após ler o swagger real] Estrutura comercial com a 3C Plus não confirmada.** Perguntei diretamente; a resposta foi "modelar como decisão em aberto na spec". A boa notícia (seção 2.1): tecnicamente a Hipótese A1 (conta mestre única, `Team`/`User` nativos da 3C Plus por Time/operador Lead Flow) é implementável só com endpoints públicos documentados — não depende de nenhum programa de revenda especial. A pergunta que resta **não é mais arquitetural, é contratual**: o acordo comercial com a 3C Plus permite isso? Qualquer estágio que provisione de fato um agente/conta na 3C Plus continua **bloqueado** até essa confirmação comercial.
2. **Confundir custo de repasse com preço cobrado do cliente em um único campo.** Nenhum modelo hoje (nem `DialerSubscription`, nem `DialerUsage`) tem qualquer campo de custo de terceiro — é 100% preço ao cliente. A spec reformulada precisa introduzir dois campos/tabelas rastreados separadamente (`custoRepasse3CPlus` vs `precoCobradoCliente`) desde a primeira migration que tocar nisso, nunca um único valor "líquido".
3. **Provisionar agente na 3C Plus antes da confirmação de pagamento.** Mesmo risco que o `PendingOperator` já resolve no fluxo de operador comum — replicar o gate via `PendingDialerSeat`, nunca criar o agente na 3C Plus diretamente a partir da ação do Manager na UI.
4. **Vazamento de billing para dentro do adapter de voz.** Como `IVoiceProvider` ainda não existe, o risco é desenhá-lo já acoplado (ex.: o método que inicia campanha na 3C Plus também decidir se o Time pode pagar). O adapter deve **apenas** falar com a API de controle de chamada/campanha da 3C Plus; toda decisão de billing/gating fica em `DialerBillingService`, chamado *antes* do adapter pelo UseCase.
5. **Falta de reconciliação, mesmo que manual.** Sem nenhum relatório comparando `precoCobradoCliente` (Asaas) contra `custoRepasse3CPlus` (fatura real), o Corretor Studio não tem visibilidade de margem nesta feature — isso precisa existir desde o primeiro estágio que liga o billing, não ser um "nice to have" de uma fase de hardening.
6. **Endpoint 3C Plus de eventos de chamada ainda indefinido.** O webhook `app/api/webhooks/3cplus/route.ts` que já existe é um stub de log, hoje documentado como "não relacionado". Com a migração confirmada, decidir explicitamente (na spec) se ele é reaproveitado para os eventos do motor de discagem ou se um novo endpoint separado é criado — não deixar isso implícito, ou o próximo agente que tocar nesse arquivo vai herdar a mesma confusão desta auditoria.
7. **Campos Twilio no schema (`Team.twilio*`, `DialerCall.twilioCallSid`) precisam de migration de remoção/substituição, não edição manual da migration já commitada.** Nenhum dado de produção existe ainda nessas colunas (o módulo nunca foi ao ar), então a remoção é segura, mas deve seguir o fluxo normal (`bun run db:migrate:new`), nunca editar `20260611125755_add-dialer-module.sql` diretamente.
8. **Arquitetura de discagem em si muda, não só o "provider".** O spec antigo (state machine de claim atômico + TwiML Conference + AMD + Twilio Client SDK no navegador) presume que o Lead Flow constrói a lógica de discagem. Se a 3C Plus já é um discador preditivo hospedado com sua própria interface de agente, grande parte dessa seção 4 do spec antigo (item "Máquina de estados da discagem") deixa de fazer sentido como está — não é uma tradução 1:1 de "troca Twilio por 3C Plus nos mesmos métodos". Isso é sinalizado explicitamente no `DIALER_SPEC.md` reformulado como a maior incerteza técnica (não só comercial) da migração.

---

## 5. Arquivos-chave para quem for implementar

- Schema a alterar: `prisma/schema.prisma` (`Team`, `DialerCall`, novos modelos de billing/repasse/seat).
- Migration base já existente (não editar, só somar novas): `supabase/migrations/20260611125755_add-dialer-module.sql`.
- Spec substituída (mantida como referência histórica, com aviso de depreciação): `docs/TWILIO_AUTO_DIALER_SPEC.md`.
- Spec nova (fonte da verdade a partir de agora): `docs/DIALER_SPEC.md`.
- Precedente de overage: `app/api/services/EmailCredit/EmailCreditService.ts`.
- Precedente de recurso pago gated por confirmação: `app/api/useCases/subscriptions/SubscriptionUpgradeUseCase.ts`.
- Webhook a decidir (reaproveitar ou isolar): `app/api/webhooks/3cplus/route.ts`.
- Feature flag já pronta (não mexer): `lib/features/feature-slugs.ts`, `feature-product-slug-map.ts`, `feature-route-access.ts`.
- Postman a atualizar quando houver rota nova: `postman/Lead-Flow-API-Collection.json`, `postman/Lead-Flow-Environment.json`.
- Spec OpenAPI real da 3C Plus (fonte primária desta rodada, salvar/baixar de novo se necessário): `https://app.3c.plus/api/v1/swagger.json` (carregada por `https://api-docs.3c.fluxoti.com/`). Baixada localmente durante esta auditoria via `curl` (a página Swagger UI só referencia essa URL no HTML — não é legível como HTML puro).
