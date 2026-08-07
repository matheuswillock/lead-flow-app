# Análise Consolidada: Avalanche de Vendas vs Multiskill vs Katherein

**Data da Análise:** 2026-08-07
**Times Investigados:** Avalanche de Vendas Unipessoal Ltda, Multiskill Rede Dor, Katherein
**Período Analisado:** 7 dias (campanhas desde 2026-08-05)

---

## 📊 Visão Geral Comparativa

### Avalanche de Vendas Unipessoal Ltda
- **Master:** meu@universo.top
- **Campanhas Totais:** 20
- **Total Enviados:** 5.604
- **Total Entregues:** 4.377 (78.11%)
- **Taxa de Abertura:** 40.76% (1.784/4.377)
- **Taxa de Clique:** 29.82% (532/1.784)
- **Taxa de Bounce:** 11.0%

### Multiskill (Rede Dor)
- **Campanhas Analisadas:** Foco em "Rede Dor"
- **Principal Problema:** 0% taxa de abertura em campanhas entregues
- **Entregabilidade:** Alta
- **Engajamento:** Zero (suspeita de problemas de tracking)

### Katherein
- **Principal Problema:** Erro no botão "Reenviar apenas falhas"
- **Campanhas com Falhas:** Múltiplas
- **Leads Fantasmas:** Identificados (criados por form.viewed sem submission)

---

## 🚨 Problemas Identificados

### 1. **Avalanche de Vendas - Logs Órfãos**
- **398 logs sem resendEmailId** em todas as campanhas
- **Impacto:** Perda de tracking de eventos (abertura/clique)
- **Campanhas Afetadas:** 
  - Homens — Homens 06: 398 órfãos
  - Outros: quantidade não reportada individualmente

#### Exemplo de Órfão:
- Dispatch `713deb70` (Homens — Homens 06)
- 398 emails enviados sem resendEmailId
- Status: `sent` mas sem tracking de eventos subsequentes

### 2. **Eventos Radar Sem Lead Associado**
- **25 eventos `form.viewed`** sem lead correspondente
- **Período:** Últimos 7 dias
- **Impacto:** Perda de conversão, leads não capturados

#### Exemplos:
```
- vinicius.rodrigues@smartsteel.com.br (2026-08-07 14:25)
- info@secheron.com.br (2026-08-07 14:20)
- raquel@rfm.com.br (2026-08-07 14:17)
```

### 3. **Falhas de Dispatch**
Campanhas com dispatches falhados:
- **Empresa Jovem — Empresa Jovem 05:**
  - Dispatch `1a2f8ae7` (status: failed)
  - Erro: 409 — Falha no envio (117 destinatários)
  
- **Homens — Homens 05:**
  - Dispatch `6dd1ca15` (status: failed)
  - Erro: 409 — Falha em 1.293 destinatários (múltiplos lotes)

### 4. **Performance por Segmento**

#### Alto Padrão:
- Taxa de abertura: **38.57% a 46.58%**
- Taxa de clique: **67-90%** (excelente CTR)
- Status: ✅ Saudável

#### Empresa Jovem:
- Taxa de abertura: **26-36%**
- Taxa de clique: **15-48%**
- Dispatches com falhas
- Status: ⚠️ Requer atenção

#### Empresa Consolidada:
- Taxa de abertura: **16-41%**
- Taxa de clique: **0-30%**
- Status: ⚠️ Variável

#### Mulheres:
- Taxa de abertura: **30-37%**
- Taxa de clique: **18-34%**
- Status: ✅ Consistente

#### Homens:
- Taxa de abertura: **42%** (consistente)
- Taxa de clique: **21-35%**
- Dispatches com falhas
- Órfãos detectados (398)
- Status: 🚨 Crítico

---

## 📈 Comparação entre Times

### Taxa de Abertura
| Time | Taxa | Status |
|------|------|--------|
| **Avalanche de Vendas** | **40.76%** | ✅ Excelente |
| **Multiskill (Rede Dor)** | **0%** | 🚨 Crítico |
| **Katherein** | **Variável** | ⚠️ Depende da campanha |

### Órfãos (Logs sem resendEmailId)
| Time | Órfãos | Impacto |
|------|--------|---------|
| **Avalanche de Vendas** | **398** | 🚨 Alto |
| **Multiskill** | **Não reportado** | ⚠️ A investigar |
| **Katherein** | **Não reportado** | ⚠️ A investigar |

### Eventos Radar Órfãos
| Time | form.viewed sem lead | Período |
|------|---------------------|---------|
| **Avalanche de Vendas** | **25** | 7 dias |
| **Multiskill** | **Não investigado** | - |
| **Katherein** | **50** | 7 dias |

### Leads Fantasmas
| Time | Leads sem submission | Status |
|------|---------------------|--------|
| **Avalanche de Vendas** | **0** | ✅ Limpo |
| **Katherein** | **Múltiplos** | 🚨 Problema identificado |

---

## 🔍 Análise de Causa Raiz

### 1. **Órfãos (resendEmailId = NULL)**

**Possíveis Causas:**
- Race condition no webhook do Resend
- Batch send falhando antes de gravar resendEmailId
- Timeout no processo de envio
- Erro no mapeamento de resposta do Resend

**Evidência:**
- Eventos `failed` com `ResendID: NULL` (ex: Empresa Jovem dispatch `1a2f8ae7`)
- Eventos de webhook órfãos (sem log correspondente)

### 2. **form.viewed sem Lead**

**Possíveis Causas:**
- Lead criado por `form.viewed` antes de `form.completed`
- Integração Radar → CRM não sincronizando identities
- Radar profileId sem `lead_id` identity

**Evidência:**
- 25 eventos `form.viewed` nos últimos 7 dias
- Query retorna `leadId IS NULL`

### 3. **Taxa de Abertura 0% (Multiskill)**

**Possíveis Causas:**
- Tracking pixel não renderizado
- Emails marcados como spam (sem abertura)
- Link de tracking quebrado
- Cliente de email bloqueando imagens

**Diferença com Avalanche:**
- Avalanche: 40.76% abertura (tracking funcionando)
- Multiskill: 0% abertura (tracking quebrado ou emails não sendo abertos)

---

## 💡 Recomendações Priorizadas

### 🔴 **Urgente - Crítico**

#### 1. **Corrigir Órfãos (resendEmailId = NULL)**
**Ação:**
- Adicionar retry exponencial no save de `resendEmailId`
- Implementar transação atômica: `sendEmail` + `saveLog` + `saveResendId`
- Adicionar timeout de 30s no batch send

**Script de Correção:**
```typescript
// Criar script: fix-orphan-logs.ts
// 1. Buscar logs com status != 'failed' e resendEmailId = null
// 2. Buscar eventos de webhook correspondentes (por email + timestamp)
// 3. Recuperar resendEmailId dos eventos
// 4. Atualizar logs
```

**Prioridade:** 🔴 P0 (afeta tracking de engajamento)

---

#### 2. **Sincronizar Eventos Radar Órfãos**
**Ação:**
- Criar job: `sync-radar-events-to-leads`
- Processar eventos `form.viewed` sem lead
- Criar `RadarIdentity` com `type: 'lead_id'`
- Vincular profileId → leadId

**Script de Correção:**
```typescript
// Criar script: sync-radar-events-to-leads.ts
// 1. Buscar eventos form.viewed/form.started sem lead (últimos 30 dias)
// 2. Buscar lead correspondente por email/phone
// 3. Criar RadarIdentity se lead existe
// 4. Reportar órfãos não resolvidos
```

**Prioridade:** 🔴 P0 (perda de conversão)

---

### 🟡 **Importante - Alto Impacto**

#### 3. **Investigar Taxa de Abertura 0% (Multiskill)**
**Ação:**
- Comparar HTML dos emails Avalanche vs Multiskill
- Verificar tracking pixel no template
- Testar envio manual (Gmail, Outlook, Apple Mail)
- Analisar SPF/DKIM/DMARC

**Prioridade:** 🟡 P1 (afeta 1 time, mas pode indicar problema sistêmico)

---

#### 4. **Corrigir Botão "Reenviar Apenas Falhas" (Katherein)**
**Ação:**
- Revisar código de retry em `EmailCampaignUseCase`
- Adicionar validação de `parentCampaignId`
- Evitar duplicação de dispatches
- Implementar idempotência

**Prioridade:** 🟡 P1 (UX bloqueador)

---

### 🟢 **Melhorias - Prevenção**

#### 5. **Monitoria de Taxa de Abertura em Tempo Real**
**Ação:**
- Dashboard com alerta se taxa < 10% após 1h do dispatch
- Webhook monitoring (delay médio, taxa de falha)
- Slack alert para campanhas com órfãos > 5%

**Prioridade:** 🟢 P2 (prevenção)

---

#### 6. **Auditoria de Leads Fantasmas (Katherein)**
**Ação:**
- Revisar lógica de criação de lead em `form.viewed`
- Preferir criação apenas em `form.completed`
- Implementar garbage collection de leads sem submission após 7 dias

**Prioridade:** 🟢 P2 (cleanup)

---

## 📋 Checklist de Implementação

### Sprint 1 (Crítico)
- [ ] Criar `fix-orphan-logs.ts` e executar para Avalanche de Vendas
- [ ] Adicionar retry + transação atômica em `EmailCampaignDispatchService`
- [ ] Criar `sync-radar-events-to-leads.ts` e executar

### Sprint 2 (Alto Impacto)
- [ ] Investigar HTML/tracking pixel de Multiskill Rede Dor
- [ ] Corrigir botão "Reenviar Apenas Falhas"
- [ ] Testar envio manual em múltiplos clientes

### Sprint 3 (Prevenção)
- [ ] Implementar dashboard de monitoria
- [ ] Adicionar alertas no Slack
- [ ] Revisar lógica de criação de leads fantasmas
- [ ] Implementar garbage collection

---

## 🎯 Conclusão

### Avalanche de Vendas
- **Performance:** ✅ Excelente (40.76% abertura, 29.82% CTR)
- **Problemas:** 398 órfãos, 25 eventos Radar sem lead
- **Status:** Operacional, mas requer correção de órfãos

### Multiskill Rede Dor
- **Performance:** 🚨 Crítica (0% abertura)
- **Problemas:** Tracking quebrado ou emails não sendo abertos
- **Status:** Requer investigação urgente

### Katherein
- **Performance:** ⚠️ Variável
- **Problemas:** Botão "Reenviar Apenas Falhas" com erro, leads fantasmas
- **Status:** Requer correções funcionais

### Prioridade Global
1. 🔴 Corrigir órfãos (afeta todos os times)
2. 🔴 Sincronizar eventos Radar
3. 🟡 Investigar Multiskill (0% abertura)
4. 🟡 Corrigir botão de retry (Katherein)
5. 🟢 Monitoria preventiva

---

**Próximos Passos:**
1. Executar `fix-orphan-logs.ts` em produção (com approval)
2. Executar `sync-radar-events-to-leads.ts`
3. Agendar investigação técnica de Multiskill
4. Code review de `EmailCampaignDispatchService`
