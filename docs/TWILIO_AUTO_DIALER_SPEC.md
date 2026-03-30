# Especificação — Módulo Discador Automático (Twilio)

**Versão:** 1.1.0
**Data:** 2026-03-30
**Status:** Planejamento
**Produto:** Lead Flow — Corretor Studio

---

## 1. Visão Geral

O módulo de **Discador Automático** permite que operadores executem campanhas de ligações para uma base de contatos pré-carregada. O sistema utiliza **Twilio Programmable Voice** para gerenciar as ligações, detectar atendimento, transferir chamadas ao vivo para o operador e gravar as conversas.

### Fluxo Principal

```
Manager sobe base de contatos (CSV / JSON / XLSX)
        ↓
Operador inicia o discador para o time
        ↓
Twilio liga para o próximo contato da fila
        ↓
[Atendido em até 15s?]
  ├── SIM → Transfere para o operador (Conference) + inicia gravação
  └── NÃO → Registra tentativa, avança para o próximo contato
        ↓
Ao final: relatório de todas as ligações + gravações disponíveis
```

---

## 2. Análise de Custos — Twilio (Brasil, 2025)

### 2.1 Tabela de Preços Twilio (USD)

| Item | Custo | Notas |
|------|-------|-------|
| Número local (BR) | $1,00/mês | Necessário 1 por conta |
| Ligação sainte — celular BR | $0,028/min | Principal custo operacional |
| Ligação sainte — fixo BR | $0,016/min | Menor custo |
| Twilio Client (browser) | $0,004/min | Para conexão do operador via browser |
| Detecção de atendimento (AMD) | $0,005/call | Answering Machine Detection |
| Gravação (recording) | $0,0025/min | Por minuto gravado |
| Armazenamento de gravação | $0,0025/min/mês | Por minuto armazenado |

> Cotação de referência: USD 1,00 ≈ R$ 5,20 (verificar sempre a cotação atual)

### 2.2 Custo por Chamada (Estimativa)

**Cenário: ligação respondida — duração média de 3 minutos**

| Componente | Custo (USD) | Custo (BRL) |
|-----------|-------------|-------------|
| Ligação sainte ao contato (celular, 3 min) | $0,084 | R$ 0,44 |
| AMD (detecção de atendimento) | $0,005 | R$ 0,03 |
| Gravação (3 min) | $0,0075 | R$ 0,04 |
| Bridge ao operador (Twilio Client, 3 min) | $0,012 | R$ 0,06 |
| **Total por chamada atendida** | **~$0,11** | **~R$ 0,57** |

**Cenário: ligação não atendida — timeout de 30 segundos**

| Componente | Custo (USD) | Custo (BRL) |
|-----------|-------------|-------------|
| Tentativa sainte (0,5 min) | $0,014 | R$ 0,07 |
| AMD | $0,005 | R$ 0,03 |
| **Total por chamada não atendida** | **~$0,02** | **~R$ 0,10** |

### 2.3 Custo para 100 Contatos Discados (50% taxa de atendimento)

| | Qtd | Custo (BRL) |
|-|-----|------------|
| Chamadas atendidas (50) | × R$ 0,57 | R$ 28,50 |
| Chamadas não atendidas (50) | × R$ 0,10 | R$ 5,00 |
| **Custo total de infraestrutura** | | **R$ 33,50** |

### 2.4 Observações de Custo

- **Gravações de longa duração** devem ser gerenciadas ativamente: mover para Supabase Storage após conclusão da campanha para reduzir custo de armazenamento Twilio.
- **AMD** aumenta detecção de secretária eletrônica, mas adiciona ~$0,005/chamada. Recomendado ativar.
- Recomenda-se um **número Twilio por time** para evitar bloqueio de SPAM (reputação do número). Custo extra: $1,00/mês por número adicional.

---

## 3. Modelo de Cobrança Proposto

### 3.1 Contexto do Modelo Atual

O Lead Flow cobra:
- **Manager base**: R$ 59,90/mês (via Asaas — PIX ou cartão)
- **Por operador**: R$ 19,90/mês (adicionado à assinatura)

A cobrança é gerenciada pela integração com o Asaas, que processa assinaturas recorrentes. Webhooks Asaas atualizam o status da assinatura no banco via `PaymentValidationService`.

### 3.2 Opções de Modelo para o Discador

#### Opção A — Add-on de time com pacote de minutos (RECOMENDADA)

| Plano | Preço | Inclui |
|-------|-------|--------|
| **Discador Básico** | R$ 49,90/time/mês | 300 min de chamadas saintes |
| **Discador Profissional** | R$ 89,90/time/mês | 800 min de chamadas saintes |
| **Minutos avulsos** | R$ 29,90/100 min | Adquiridos pelo manager via Asaas |

- Margem estimada sobre custo Twilio: **~80-100%**
- Alinhado ao modelo atual (cobrança por time, Asaas)
- Minutos expiram no ciclo mensal

#### Opção B — Crédito de chamadas por operador

- R$ 29,90/mês por operador habilitado no discador
- Inclui 100 chamadas/mês (não minutos)
- Alinhado ao modelo atual de cobrança por operador

#### Opção C — Pay-as-you-go puro

- Manager compra créditos de chamadas (R$ 50 = 150 min)
- Sem mensalidade extra; créditos não expiram
- Maior flexibilidade, mas menor previsibilidade de receita

### 3.3 Recomendação

**Opção A** é a mais alinhada com o modelo atual e gera receita recorrente previsível. A cobrança segue o padrão existente no Asaas: criar novo `SubscriptionPlan` para times com discador ativo, ou cobrar como add-on separado via `createSubscription` do `AsaasSubscriptionService`.

Novos valores no enum `SubscriptionPlan`:
```prisma
dialer_basic    // R$ 49,90/time/mês — 300 min
dialer_pro      // R$ 89,90/time/mês — 800 min
```

O controle de minutos consumidos ficará em nova tabela `DialerUsage` (ver seção 5).

---

## 4. Arquitetura Técnica

### 4.1 Fluxo de Chamada (Twilio TwiML)

```
Operador clica "Iniciar Discagem"
        ↓
Backend cria fila de contatos da campanha
        ↓
Para cada contato na fila:
  1. POST /api/v1/dialer/calls/initiate (backend)
  2. Twilio Calls API → disca para o contato
  3. Twilio retorna status: answered / no-answer / busy / failed
        ↓
  [Se answered em ≤ 15s]
  4. TwiML: <Dial><Conference ...> → conecta operador
  5. Twilio Client (browser do operador) entra na Conference
  6. Gravação iniciada automaticamente (Record=true na Conference)
        ↓
  [Se não atendido]
  7. Registra tentativa com status + avança para próximo
        ↓
POST /api/webhooks/twilio/voice → TwiML response (callback)
POST /api/webhooks/twilio/status → atualiza DialerCall no banco
```

### 4.2 Componentes Backend (padrão `app/api/`)

```
app/api/
  v1/
    dialer/
      campaigns/
        route.ts                        # GET (listar) / POST (criar campanha)
        [campaignId]/
          route.ts                      # GET / PUT / DELETE campanha
          contacts/
            route.ts                    # GET lista contatos
            upload/
              route.ts                  # POST upload CSV/JSON/XLSX
          calls/
            route.ts                    # GET histórico de chamadas
          start/
            route.ts                    # POST — inicia discagem
          pause/
            route.ts                    # POST — pausa discagem
  useCases/
    dialer/
      ICreateCampaignUseCase.ts
      CreateCampaignUseCase.ts
      IUploadContactsUseCase.ts
      UploadContactsUseCase.ts
      IStartDialerUseCase.ts
      StartDialerUseCase.ts
      IDialerCallUseCase.ts
      DialerCallUseCase.ts
  services/
    Twilio/
      ITwilioVoiceService.ts
      TwilioVoiceService.ts
    DialerCampaign/
      IDialerCampaignService.ts
      DialerCampaignService.ts
    DialerContactParser/
      IDialerContactParserService.ts
      DialerContactParserService.ts      # CSV / JSON / XLSX parser
  webhooks/
    twilio/
      route.ts                           # TwiML response + status callbacks
```

### 4.3 Componentes Frontend (padrão `app/[supabaseId]/`)

```
app/[supabaseId]/dialer/
  page.tsx
  loading.tsx
  features/
    context/
      DialerTypes.ts
      DialerHook.ts
      DialerContext.tsx
    services/
      IDialerService.ts
      DialerService.ts
    container/
      DialerContainer.tsx
    components/
      CampaignCard.tsx
      ContactTable.tsx
      CallLogTable.tsx
      DialerControls.tsx              # Botão Start/Pause + status ao vivo
      UploadContactsDialog.tsx
      RecordingPlayer.tsx
```

### 4.4 Fluxo do Operador em Tempo Real

- O operador usa o **Twilio JavaScript SDK** (browser) para receber a chamada transferida.
- Quando o contato atende, o backend cria uma Conference Room via API Twilio e "liga" para o browser do operador via Twilio Client Token (JWT gerado pelo backend).
- A conexão de voz acontece diretamente entre Twilio ↔ Browser (WebRTC), sem servidor intermediário de mídia.

```
Contato atende
     ↓
Backend: Twilio REST API → criar Conference + adicionar contato
     ↓
Backend: Twilio REST API → ligar para operador (Twilio Client)
     ↓
Browser do operador: Twilio.Device.incoming() → autoAccept
     ↓
Conversa ao vivo + gravação ativa
```

### 4.5 Tratamento de Arquivos (Upload de Base)

| Formato | Parser |
|---------|--------|
| `.csv` | `papaparse` (já disponível ou `bun add papaparse`) |
| `.json` | `JSON.parse` nativo |
| `.xlsx` | `xlsx` (SheetJS, `bun add xlsx`) |

Colunas mapeadas: `name`, `phone`, `email` (obrigatório: `name` + `phone`)
Limite recomendado por upload: **10.000 contatos**
Armazenamento dos arquivos originais: **Supabase Storage** (bucket `dialer-uploads`)

---

## 5. Schema de Banco de Dados

### 5.1 Novos Modelos Prisma

```prisma
enum DialerCampaignStatus {
  draft         // Rascunho, contatos sendo carregados
  ready         // Pronta para iniciar
  running       // Discando ativamente
  paused        // Pausada pelo operador
  completed     // Todos os contatos processados
  canceled      // Cancelada manualmente
}

enum DialerCallStatus {
  pending       // Na fila
  calling       // Discando
  answered      // Atendido — conectando ao operador
  transferred   // Operador conectado
  completed     // Encerrada
  no_answer     // Não atendeu
  busy          // Ocupado
  failed        // Falha técnica
  machine       // Caixa postal / secretária eletrônica
}

model DialerCampaign {
  id          String               @id @default(uuid()) @db.Uuid
  teamId      String               @db.Uuid
  managerId   String               @db.Uuid
  name        String               @db.Text
  description String?              @db.Text
  status      DialerCampaignStatus @default(draft)
  totalContacts     Int            @default(0)
  contactsProcessed Int            @default(0)
  contactsAnswered  Int            @default(0)
  minutesUsed       Decimal        @default(0) @db.Decimal(10, 2)
  createdAt   DateTime             @default(now()) @db.Timestamptz(6)
  updatedAt   DateTime             @updatedAt @db.Timestamptz(6)

  team     Team             @relation(fields: [teamId], references: [id], onDelete: Cascade)
  manager  Profile          @relation(fields: [managerId], references: [id], onDelete: Cascade)
  contacts DialerContact[]
  calls    DialerCall[]

  @@index([teamId])
  @@index([managerId])
  @@map("dialer_campaigns")
}

model DialerContact {
  id         String  @id @default(uuid()) @db.Uuid
  campaignId String  @db.Uuid
  name       String  @db.Text
  phone      String  @db.Text
  email      String? @db.Text
  metadata   Json?   // Campos extras do CSV/JSON/XLSX
  processed  Boolean @default(false)
  position   Int     // Ordem na fila
  createdAt  DateTime @default(now()) @db.Timestamptz(6)

  campaign DialerCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  calls    DialerCall[]

  @@index([campaignId])
  @@index([campaignId, processed])
  @@map("dialer_contacts")
}

model DialerCall {
  id             String           @id @default(uuid()) @db.Uuid
  campaignId     String           @db.Uuid
  contactId      String           @db.Uuid
  operatorId     String           @db.Uuid
  twilioCallSid  String?          @unique @db.Text
  status         DialerCallStatus @default(pending)
  durationSeconds Int?
  recordingUrl    String?          @db.Text  // URL no Twilio (temporária)
  recordingPath   String?          @db.Text  // Path no Supabase Storage (permanente)
  recordingSid    String?          @db.Text
  startedAt      DateTime?        @db.Timestamptz(6)
  answeredAt     DateTime?        @db.Timestamptz(6)
  transferredAt  DateTime?        @db.Timestamptz(6)
  endedAt        DateTime?        @db.Timestamptz(6)
  notes          String?          @db.Text
  createdAt      DateTime         @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime         @updatedAt @db.Timestamptz(6)

  campaign DialerCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  contact  DialerContact  @relation(fields: [contactId], references: [id], onDelete: Cascade)
  operator Profile        @relation(fields: [operatorId], references: [id], onDelete: Restrict)

  @@index([campaignId])
  @@index([contactId])
  @@index([operatorId])
  @@index([twilioCallSid])
  @@map("dialer_calls")
}

model DialerUsage {
  id           String   @id @default(uuid()) @db.Uuid
  teamId       String   @db.Uuid
  billingMonth String   @db.Text  // "2026-03"
  minutesUsed  Decimal  @default(0) @db.Decimal(10, 2)
  minutesLimit Decimal  @db.Decimal(10, 2)   // 300 ou 800 conforme plano
  callsCount   Int      @default(0)
  createdAt    DateTime @default(now()) @db.Timestamptz(6)
  updatedAt    DateTime @updatedAt @db.Timestamptz(6)

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([teamId, billingMonth])
  @@index([teamId])
  @@map("dialer_usage")
}
```

### 5.2 Adições ao `Profile`

```prisma
twilioClientToken    String?   @db.Text   // JWT temporário para Twilio Client
twilioClientTokenExp DateTime? @db.Timestamptz(6)
```

### 5.3 Adições ao `Team`

```prisma
dialerEnabled       Boolean @default(false)
dialerPlan          String? @db.Text   // "dialer_basic" | "dialer_pro"
twilioNumberSid     String? @db.Text   // SID do número Twilio do time
twilioPhoneNumber   String? @db.Text   // "+55..."
```

---

## 6. Variáveis de Ambiente Novas

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WEBHOOK_TOKEN=                  # Token secreto para validar webhooks Twilio
TWILIO_APP_SID=APxxxxxxxx              # TwiML App SID (para Twilio Client)
```

Adicionar também ao `postman/Lead-Flow-Environment.json` ao criar os endpoints.

---

## 7. Integrações e Dependências

### 7.1 Novos Pacotes

```bash
bun add twilio                  # Twilio Node.js SDK
bun add papaparse               # Parser CSV
bun add @types/papaparse -D
bun add xlsx                    # Parser XLSX (SheetJS)
```

### 7.2 Webhook Twilio

O Twilio envia dois tipos de callbacks:

| Endpoint | Trigger | Propósito |
|----------|---------|-----------|
| `POST /api/webhooks/twilio/voice` | Chamada atendida | Retorna TwiML (ação de conferência) |
| `POST /api/webhooks/twilio/status` | Mudança de status | Atualiza `DialerCall` no banco |

Validação obrigatória: verificar assinatura Twilio via `twilio.validateRequest()` usando `TWILIO_AUTH_TOKEN`.

---

## 8. Rotas Protegidas (Middleware)

Adicionar `/dialer` à lista de rotas protegidas em `middleware.ts`:

```typescript
// Adicionar ao array de prefixos protegidos
'/dialer',
```

---

## 9. Permissões por Papel

| Ação | Manager | Operator |
|------|---------|----------|
| Criar campanha | ✅ | ❌ |
| Fazer upload de contatos | ✅ | ❌ |
| Ver campanhas do time | ✅ | ✅ |
| Iniciar/pausar discagem | ❌ | ✅ |
| Ver histórico de chamadas | ✅ | ✅ (próprias) |
| Ouvir gravações | ✅ | ✅ (próprias) |
| Ativar módulo (billing) | ✅ | ❌ |

---

## 10. Roadmap de Implementação

### Fase 1 — Fundação (Sprint 1)

- [ ] Criar schema Prisma + migration
- [ ] Setup Twilio: conta, número, TwiML App
- [ ] Endpoint: criar/listar campanhas (`/api/v1/dialer/campaigns`)
- [ ] Endpoint: upload de contatos (CSV/JSON/XLSX)
- [ ] Página frontend: listagem de campanhas

### Fase 2 — Core do Discador (Sprint 2)

- [ ] `TwilioVoiceService`: initiate call, create conference, generate client token
- [ ] `StartDialerUseCase`: orquestrar fila de contatos
- [ ] Webhooks Twilio: `/api/webhooks/twilio/voice` e `/api/webhooks/twilio/status`
- [ ] Integração Twilio Client SDK no frontend (operador recebe chamada)
- [ ] Controles de discagem: Start / Pause / Next

### Fase 3 — Gravações e Histórico (Sprint 3)

- [ ] Gravação automática de chamadas atendidas
- [ ] Migração de gravação Twilio → Supabase Storage após término
- [ ] Página de histórico de chamadas + player de gravação
- [ ] Relatório de campanha (taxa de atendimento, duração média, etc.)

### Fase 4 — Billing do Módulo (Sprint 4)

- [ ] Novo `SubscriptionPlan` no enum Prisma: `dialer_basic`, `dialer_pro`
- [ ] `DialerUsage`: contabilização de minutos por ciclo mensal
- [ ] Fluxo de ativação do add-on via Asaas (igual ao fluxo de operadores)
- [ ] Bloqueio de discagem ao atingir limite de minutos
- [ ] UI de consumo de minutos na tela do discador

---

## 11. Checklist de PR (obrigatório por CLAUDE.md)

- [ ] Segue `agents.md`?
- [ ] Criou exceção legada? Se sim, justificou e atualizou allowlist?
- [ ] Criou endpoint backend novo? Atualizou `postman/Lead-Flow-API-Collection.json` e `postman/Lead-Flow-Environment.json`?
- [ ] Rodou `bun run typecheck` e `bun run lint`?
- [ ] Rodou `bun run governance:check`?

---

---

## 12. Plano Ilimitado — Viabilidade e Abordagem

### 12.1 Por que "ilimitado real" não existe no Twilio

O Twilio **não oferece plano de voz flat-rate** para o Brasil. Todo uso é cobrado por minuto (pay-as-you-go). Portanto, oferecer "ilimitado" ao cliente significa que **nós absorvemos o risco** de uso excessivo.

> Custo de referência Twilio para ligações ao Brasil (número local BR → celular BR):
> ~$0,028/min com número local brasileiro.
> Se usar número US para ligar ao Brasil: ~$0,14/min (muito mais caro — sempre usar número BR local).

### 12.2 Estratégias para Plano "Ilimitado"

#### Opção 1 — Alto Volume com Teto de Segurança (RECOMENDADA)

Vendemos como "ilimitado" mas aplicamos um teto de proteção contra abuso:

| Plano | Preço | Minutos incluídos | Excedente |
|-------|-------|-------------------|-----------|
| Discador Básico | R$ 49,90/time/mês | 300 min | R$ 0,35/min adicional |
| Discador Pro | R$ 89,90/time/mês | 800 min | R$ 0,30/min adicional |
| **Discador Ilimitado** | **R$ 199,90/time/mês** | **até 2.000 min** | R$ 0,25/min adicional |

- Para o plano "Ilimitado": custo Twilio médio ≈ R$ 150 (2.000 min × R$ 0,15) → margem de ~25%
- Usuário médio de call center: 200–500 min/mês → margem muito maior para a maioria
- O teto (2.000 min) bloqueia abusos e é transparente no contrato

#### Opção 2 — Créditos Pré-pagos (Pay-as-you-go para o cliente)

- Manager compra pacotes de crédito via Asaas (cobrança avulsa, não recorrente)
- Créditos se convertem em minutos: R$ 29,90 = 100 min
- Sem mensalidade de discador; desconto por volume nos pacotes maiores
- Risco para nós: zero (cliente pré-paga antes de usar)

#### Opção 3 — Repasse Direto com Markup Fixo

- Consultamos a API de usage do Twilio ao final de cada ciclo
- Cobramos o cliente pelo exato uso + markup de 100%: custo Twilio × 2
- Cobrança via Asaas on-demand (não recorrente) no fechamento do mês
- Vantagem: totalmente justo por uso; desvantagem: cobrança variável assusta alguns clientes

### 12.3 Recomendação Final para Ilimitado

**Posicionar o Plano Ilimitado como "até 2.000 min/mês"** (limite técnico transparente), com excedente automático cobrado pelo Asaas via cobrança avulsa. Isso:
- Permite marketing de "ilimitado" para o perfil típico de uso
- Protege contra custo excessivo com teto declarado
- Mantém cobrança recorrente previsível para o negócio

---

## 13. Isolamento por Cliente — Twilio Subcontas

### 13.1 Problema

Em um SaaS multi-tenant, misturar todos os clientes em uma única conta Twilio cria:
- Sem isolamento de dados (logs de chamadas misturados)
- Risco: um cliente com problema (spam, fraude) pode comprometer a conta principal
- Impossível suspender individualmente um cliente sem afetar os outros
- Difícil rastrear custo exato por cliente para billing preciso

### 13.2 Solução: Twilio Subcontas (Subaccounts)

O Twilio permite criar **subcontas filhas** a partir de uma conta mestre via API. Cada subconta é independente mas os custos sobem para a conta mestre (nós pagamos uma única fatura ao Twilio e repassamos aos clientes via Asaas).

```
Nossa Conta Mestre Twilio (Lead Flow)
│  ← Uma única fatura Twilio por mês
│
├── Subconta: Time "Alfa" (Manager João)
│   ├── Account SID: ACaaa...
│   ├── Auth Token: próprio
│   ├── Número BR: +55 11 9XXXX-XXXX
│   ├── Chamadas, gravações e logs isolados
│   └── Suspendível individualmente
│
├── Subconta: Time "Beta" (Manager Maria)
│   ├── Account SID: ACbbb...
│   ├── Auth Token: próprio
│   ├── Número BR: +55 21 9XXXX-XXXX
│   └── Dados completamente separados
│
└── Subconta: Time "Gama" (Manager Carlos)
    └── ...
```

**Limite padrão**: até 1.000 subcontas por conta mestre (expandível via suporte Twilio).

### 13.3 Como Criar e Gerenciar Subcontas

```typescript
// TwilioSubaccountService.ts (novo service)

// Criar subconta quando manager ativa o módulo discador
const subaccount = await twilioClient.api.accounts.create({
  friendlyName: `LeadFlow - Time ${teamId}`,
});
// Retorna: subaccount.sid, subaccount.authToken

// Comprar número BR para a subconta
const twilioSubClient = twilio(subaccount.sid, subaccount.authToken);
const number = await twilioSubClient.incomingPhoneNumbers.create({
  phoneNumber: selectedBrazilNumber,
});

// Suspender subconta (cliente inadimplente)
await twilioClient.api.accounts(subaccountSid).update({ status: 'suspended' });

// Reativar subconta (cliente pagou)
await twilioClient.api.accounts(subaccountSid).update({ status: 'active' });
```

### 13.4 Rastreamento de Custo por Cliente (Usage API)

Ao final de cada ciclo (ou em tempo real), consultamos o custo exato de cada subconta:

```typescript
// Consultar uso de voz no mês atual para uma subconta
const usageRecords = await twilioSubClient.usage.records.thisMonth.list({
  category: 'calls',
});

const totalCost = usageRecords.reduce((sum, r) => sum + parseFloat(r.price), 0);
const totalMinutes = usageRecords.reduce((sum, r) => sum + parseFloat(r.usage), 0);
// Usar totalMinutes para debitar do DialerUsage.minutesUsed no banco
```

### 13.5 Fluxo de Dinheiro (Como o Repasse Funciona)

```
Cliente (Manager) paga Lead Flow (via Asaas)
        ↓ mensalidade do plano discador + excedentes
Lead Flow recebe no banco (conta PJ da empresa)
        ↓ paga a fatura Twilio consolidada
Twilio debita da conta mestre Lead Flow
        ↓ (os custos das subcontas filhas somam na fatura mestre)
Subcontas de cada time são debitadas internamente no Twilio
```

**Não há repasse direto cliente → Twilio.** O Lead Flow é o intermediário:
- **Recebe** do cliente via Asaas (PIX/cartão)
- **Paga** ao Twilio com cartão corporativo cadastrado na conta mestre
- **Margem** = receita Asaas − custo Twilio

### 13.6 Schema de Banco — Dados da Subconta por Time

Adicionar ao modelo `Team` (além do que já foi proposto):

```prisma
// Novos campos em Team
twilioSubaccountSid      String? @db.Text   // Account SID da subconta
twilioSubaccountToken    String? @db.Text   // Auth Token da subconta (criptografado)
dialerEnabled            Boolean @default(false)
dialerPlan               String? @db.Text   // "dialer_basic" | "dialer_pro" | "dialer_unlimited"
twilioNumberSid          String? @db.Text   // SID do número Twilio
twilioPhoneNumber        String? @db.Text   // "+55 11 9XXXX-XXXX"
```

> **Segurança**: `twilioSubaccountToken` deve ser armazenado **criptografado** (AES-256 ou KMS). Nunca expor via API pública.

### 13.7 Ciclo de Vida da Subconta

```
Manager ativa módulo discador (paga via Asaas)
        ↓
CreateDialerSubaccountUseCase:
  1. POST Twilio API → criar subconta
  2. Comprar número BR disponível na subconta
  3. Configurar TwiML App na subconta (webhook URLs)
  4. Salvar SID + token criptografado no Team
  5. Criar DialerUsage para o ciclo atual
        ↓
[Uso mensal]
  - Cada chamada usa o Auth Token da subconta específica
  - DialerUsage.minutesUsed atualizado em tempo real via webhook de status
        ↓
Manager cancela / inadimplência:
  1. Suspender subconta via Twilio API
  2. Team.dialerEnabled = false
        ↓
Manager reativa:
  1. Reativar subconta via Twilio API
  2. Team.dialerEnabled = true
```

---

## 14. Referências

- [Twilio Programmable Voice Quickstart (Node.js)](https://www.twilio.com/docs/voice/quickstart/server)
- [Twilio Pricing — Brazil](https://www.twilio.com/en-us/voice/pricing/br)
- [Twilio AMD (Answering Machine Detection)](https://www.twilio.com/docs/voice/answering-machine-detection)
- [Twilio Conference Rooms](https://www.twilio.com/docs/voice/twiml/conference)
- [Twilio Client SDK (Browser)](https://www.twilio.com/docs/voice/sdks/javascript)
- [Twilio Call Recordings](https://www.twilio.com/docs/voice/api/recording)
- Modelo de cobrança atual: `app/api/services/AsaasSubscription/AsaasSubscriptionService.ts`
- Fluxo de webhook de pagamento: `app/api/services/PaymentValidation/PaymentValidationService.ts`
- Output contract: `lib/output/index.ts`
