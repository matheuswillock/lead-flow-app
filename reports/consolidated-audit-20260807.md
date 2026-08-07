# Relatório Consolidado de Auditoria de Campanhas de Email
## Gerado em: 2026-08-07 13:37 BRT

---

## 🎯 Sumário Executivo

### Problema Crítico Identificado
**GAP de Sincronização entre Radar Events e Email Logs**

Os eventos de abertura (opens) estão sendo capturados pelo Radar, mas **não estão sendo agregados** nas tabelas de campanhas e logs de email. Isso resulta em métricas zeradas mesmo quando há atividade real dos usuários.

### Impacto
- **Todas as campanhas "Rede Dor"** do time Multiskill mostram 0% de taxa de abertura
- **46 eventos reais de abertura** existem no Radar mas não aparecem nas métricas
- Outros times (Katherein, Avalanche) funcionam normalmente

---

## 1️⃣ Investigação: Multiskill - Campanhas Rede Dor

### Time Identificado
- **Nome**: MultiSkill
- **ID**: `7b577c22-5513-42cc-ab19-2bf867e14ebc`

### Campanhas "Rede Dor"

#### Campanha 1: "Rede Dor Mulheres"
- **ID**: `967f098a-0791-4761-89b1-a3c8c51debb0`
- **Status**: sent
- **Criada em**: 2026-08-06 15:44:59
- **Métricas Consolidadas (na tabela de campanhas)**:
  - Recipients: 4,523
  - Sent: 4,494
  - Delivered: 1,353
  - **Opened: 0 ❌**
  - **Clicked: 0 ❌**
  - Bounced: 305

#### Campanha 2: "Rede Dor 02"
- **ID**: `c42055ee-261f-4fd6-afd9-8180e53a4a5f`
- **Status**: sent
- **Criada em**: 2026-08-06 15:43:42
- **Métricas Consolidadas**:
  - Recipients: 1,000
  - Sent: 989
  - Delivered: 1,403 ⚠️ (maior que sent - inconsistência)
  - **Opened: 0 ❌**
  - **Clicked: 0 ❌**
  - Bounced: 101

### Análise de Logs
**Total de logs das 2 campanhas:**
- 4,523 logs criados
- **Todos** têm `resendEmailId` válido (0 órfãos ✅)
- 2,746 delivered
- **0 com `openedAt` preenchido ❌**
- **0 com `clickedAt` preenchido ❌**

**Amostra de 10 logs:**
Todos os logs mostram:
- Status: delivered ✅
- `resendEmailId`: válido ✅
- `openedAt`: NULL ❌
- `clickedAt`: NULL ❌

### 🔍 Eventos Radar do Time Multiskill (desde 06/08)
**Análise crítica revelou:**
- 5,214 eventos `email.delivered` ✅
- 4,378 eventos `email.sent` ✅
- **46 eventos `email.opened`** ✅✅✅

### 🚨 PROBLEMA IDENTIFICADO
**Os 46 eventos de abertura EXISTEM no Radar**, mas:
1. **NÃO foram propagados** para `corretor_studio_email_logs` (campo `openedAt` permanece NULL)
2. **NÃO foram agregados** em `corretor_studio_email_campaigns` (`totalOpened` permanece 0)

**Taxa de abertura real (no Radar)**: 46 / 5214 = **0.88%**  
**Taxa de abertura nas campanhas**: **0%** ❌

### Dispatches
3 dispatches identificados:

| Dispatch | Template | Recipients | Sent | Delivered | Opened | Status | Error |
|----------|----------|------------|------|-----------|--------|--------|-------|
| 1 | Reder Dor Guarulhos Mulheres | 4,523 | 4,494 | 1,353 | 0 | completed | - |
| 2 | Rede DOr Guarulhos - 002 | 1,000 | 989 | 481 | 0 | completed | - |
| 1 | Rede DOr Guarulhos - 002 | 5,000 | 0 | 922 | 0 | failed | "Campanha já foi processada anteriormente" |

---

## 2️⃣ Investigação: Katherein Antunes

### Time Identificado
- **Nome**: Kathrein Antunes
- **ID**: `28f7b9e8-9516-4a08-864c-9ff3e085ba87`

### Campanhas Recentes (últimas 10)

#### Campanha "Médicos"
- **ID**: `1715d983-b766-44f2-ab0c-30e3e8c4a599`
- **Status**: partially_sent
- Recipients: 2,000
- Sent: 700
- Delivered: 1,314
- **Opened: 547 ✅ (41.6% open rate)**
- **Clicked: 33 ✅ (6.0% CTR)**

#### Campanha "Advogados"
- **ID**: `5b89a358-e76e-48b9-a013-461638c01ef7`
- **Status**: partially_sent
- Recipients: 1,968
- Sent: 1,449
- Delivered: 1,333
- **Opened: 492 ✅ (36.9% open rate)**
- **Clicked: 36 ✅ (7.3% CTR)**

### ✅ Conclusão: Sistema de tracking FUNCIONA para este time
- Open rates consistentes (36-41%)
- Click rates consistentes (6-7%)
- Métricas sendo agregadas corretamente

---

## 3️⃣ Investigação: Avalanche de Vendas

### Time Identificado
- **Nome**: Avalanche de Vendas Unipessoal Ltda
- **ID**: `aef1bfe7-d1fc-4085-879e-81d51a0cc9b8`

### Campanhas Recentes (últimas 10)

#### Campanha "Homens"
- **ID**: `ac5afcb9-19b2-4a1f-a6be-cf80e8e9375d`
- **Status**: sent
- Recipients: 3,879
- Sent: 2,132
- Delivered: 1,427
- **Opened: 610 ✅ (42.7% open rate)**
- **Clicked: 152 ✅ (24.9% CTR)**

#### Campanha "Mulheres 05"
- **ID**: `5a885ac6-40f8-4ec0-93be-27f6e24b2ca8`
- **Status**: sent
- Recipients: 296
- Sent: 296
- Delivered: 256
- **Opened: 96 ✅ (37.5% open rate)**
- **Clicked: 18 ✅ (18.8% CTR)**

### ✅ Conclusão: Sistema de tracking FUNCIONA para este time
- Open rates consistentes (37-42%)
- Click rates muito bons (18-24%)
- Métricas sendo agregadas corretamente

---

## 4️⃣ Auditoria Radar: Eventos dos 3 Times (últimos 7 dias)

### Volume Total de Eventos

| Tipo de Evento | Total | Primeiro | Último |
|----------------|-------|----------|--------|
| profile.first_contact | 44,609 | 2026-07-31 | 2026-08-07 |
| **email.sent** | **10,077** | 2026-07-31 | 2026-08-07 |
| **email.delivered** | **9,665** | 2026-07-31 | 2026-08-07 |
| email.delivery_delayed | 3,148 | 2026-08-05 | 2026-08-07 |
| email.bounced | 2,376 | 2026-08-05 | 2026-08-07 |
| **email.opened** | **1,516** | 2026-08-03 | 2026-08-07 |
| **email.clicked** | **380** | 2026-08-05 | 2026-08-07 |
| form.* (vários) | 543 | - | - |
| lead.* (vários) | 179 | - | - |

### ✅ Eventos estão sendo capturados
- 10,077 envios rastreados
- 9,665 entregas rastreadas
- **1,516 aberturas capturadas**
- **380 cliques capturados**

### ❌ Problema: Gap de Sincronização
Os eventos de abertura/clique **existem no Radar**, mas nem todos estão sendo propagados para as campanhas.

---

## 📊 Resumo Comparativo

### Performance por Time

| Time | Campanhas | Total Sent | Total Delivered | Total Opened | Total Clicked | Open Rate | CTR |
|------|-----------|------------|-----------------|--------------|---------------|-----------|-----|
| **Multiskill (Rede Dor)** | 2 | 5,483 | 2,756 | **0** ❌ | **0** ❌ | **0%** ❌ | **0%** ❌ |
| **Katherein** | 10 | 3,649 | 5,005 | 1,808 ✅ | 125 ✅ | 36.1% ✅ | 6.9% ✅ |
| **Avalanche** | 10 | 4,791 | 3,985 | 1,549 ✅ | 384 ✅ | 38.9% ✅ | 24.8% ✅ |

### Open Rate Real vs. Consolidada (Multiskill)

| Fonte | Delivered | Opened | Open Rate |
|-------|-----------|--------|-----------|
| **Radar Events** | 5,214 | 46 | 0.88% |
| **Email Campaigns** | 2,756 | 0 | 0% |
| **Gap** | - | **-46** ❌ | **-0.88pp** |

---

## 🔴 Problemas Identificados

### 1. Gap de Sincronização (CRÍTICO)
**Descrição**: Eventos de abertura existem no Radar mas não são propagados para logs/campanhas  
**Afetados**: Time Multiskill (campanhas Rede Dor)  
**Impacto**: Métricas zeradas mesmo com atividade real  
**Evidência**: 46 opens no Radar vs. 0 nos logs

### 2. Inconsistência delivered > sent
**Descrição**: Campanha "Rede Dor 02" mostra 1,403 delivered mas apenas 989 sent  
**Possível causa**: Reprocessamento de dispatch ou contagem duplicada

### 3. Dispatch failed com delivered não-zero
**Descrição**: Dispatch com status "failed" mas 922 emails delivered  
**Erro**: "Campanha já foi processada anteriormente"  
**Possível causa**: Tentativa de reprocessamento

---

## 💡 Recomendações

### Ação Imediata (P0)

1. **Investigar pipeline de agregação de eventos Radar → Email Logs**
   - Verificar job de sync/aggregation
   - Verificar webhooks do Resend
   - Verificar processamento de eventos `email.opened` e `email.clicked`

2. **Backfill dos 46 eventos de abertura perdidos**
   ```sql
   -- Query para identificar os eventos perdidos
   SELECT re.id, re."eventType", re."occurredAt", re.metadata
   FROM corretor_studio_radar_events re
   JOIN corretor_studio_radar_profiles rp ON re."profileId" = rp.id
   WHERE rp."teamId" = '7b577c22-5513-42cc-ab19-2bf867e14ebc'
     AND re."occurredAt" >= '2026-08-06 00:00:00'
     AND re."eventType" = 'email.opened'
     AND NOT EXISTS (
       SELECT 1 FROM corretor_studio_email_logs el
       WHERE el."resendEmailId" = re.metadata->>'emailId'
         AND el."openedAt" IS NOT NULL
     );
   ```

3. **Verificar integridade do pipeline para campanhas futuras**
   - Monitorar próximas campanhas do Multiskill
   - Alertar se open rate permanecer em 0% por mais de 24h após envio

### Ação de Curto Prazo (P1)

4. **Corrigir inconsistências de contagem**
   - Reconciliar delivered vs. sent na campanha "Rede Dor 02"
   - Investigar dispatch failed com delivered não-zero

5. **Implementar validação de integridade**
   - Alerta quando `delivered > sent`
   - Alerta quando `open rate = 0%` após 48h do envio
   - Alerta quando há eventos no Radar mas não nos logs

### Ação de Médio Prazo (P2)

6. **Dashboard de Saúde do Pipeline**
   - Monitorar latência entre Radar event → Email log update
   - Monitorar taxa de eventos órfãos
   - Monitorar gap entre Radar metrics vs. Campaign metrics

7. **Processo de Reconciliação Automática**
   - Job diário para identificar gaps
   - Job de backfill automático para eventos perdidos

---

## 📝 Conclusões

1. **O sistema de tracking geral está funcional** - evidenciado pelos times Katherein e Avalanche com métricas normais (36-42% open rate)

2. **Há um problema específico** no processamento de eventos das campanhas "Rede Dor" do time Multiskill

3. **Os eventos EXISTEM no Radar** (46 opens capturados) mas não foram propagados

4. **Não há problema de órfãos** - todos os logs têm `resendEmailId` válido

5. **Root cause mais provável**: Falha no job de agregação/sync entre Radar Events e Email Logs, possivelmente relacionada a:
   - Timing do processamento
   - Erro silencioso no webhook handler
   - Problema na query de reconciliação
   - Issue com o metadata/tags das campanhas Rede Dor

---

## 📎 Anexos

### IDs para Investigação

**Times:**
- Multiskill: `7b577c22-5513-42cc-ab19-2bf867e14ebc`
- Katherein: `28f7b9e8-9516-4a08-864c-9ff3e085ba87`
- Avalanche: `aef1bfe7-d1fc-4085-879e-81d51a0cc9b8`

**Campanhas Rede Dor:**
- Rede Dor Mulheres: `967f098a-0791-4761-89b1-a3c8c51debb0`
- Rede Dor 02: `c42055ee-261f-4fd6-afd9-8180e53a4a5f`

**Dispatches:**
- Dispatch 1 (Mulheres): `e7873d8d-03f9-47d9-8a2d-c36cdbefcd25`
- Dispatch 2 (02): `a4140957-b933-41aa-8d12-c18c745652f8`
- Dispatch 1 failed: `cb9a14d4-1bcb-412d-bb16-2dc53421e965`

---

**Fim do Relatório**
