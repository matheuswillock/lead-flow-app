# ✅ Correção dos Cálculos de Métricas - Dashboard

## 🎯 **Problema Identificado**

As métricas do dashboard não estavam considerando corretamente:
1. A diferença entre **Manager** e **Operator**
2. Os grupos de status corretos
3. Os cálculos de conversão e churn

## 🔧 **Correções Aplicadas**

### 1. **Lógica de Busca por Role (Manager/Operator)**

#### **Manager:**
- Busca leads do próprio manager **E** de todos os seus operators
- Usa `OR` clause: `managerId = profile.id OR assignedTo IN (operatorIds)`

#### **Operator:**
- Busca **apenas** os leads atribuídos a ele
- Usa: `assignedTo = profile.id`

### 2. **Grupos de Status Corrigidos**

```typescript
const STATUS_GROUPS = {
  AGENDAMENTOS: ['scheduled'],
  
  NEGOCIACAO: [
    'offerNegotiation',  // Negociação
    'pricingRequest'     // Cotação ← ADICIONADO
  ],
  
  IMPLEMENTACAO: [
    'offerSubmission',    // Proposta
    'dps_agreement',      // DPS
    'invoicePayment',     // BOLETO
    'pending_documents'   // DOCUMENTOS PENDENTES
  ],
  
  VENDAS: ['contract_finalized'],
  CHURN: ['operator_denied'],
  NO_SHOW: ['no_show']
}
```

### 3. **Cálculos das Métricas**

#### **Agendamentos:**
- Total de leads com status `scheduled`

#### **Negociação:**
- Leads com status `offerNegotiation` + `pricingRequest`

#### **Implementação:**
- Leads com status `offerSubmission` + `dps_agreement` + `invoicePayment` + `pending_documents`

#### **Vendas:**
- Leads com status `contract_finalized`

#### **Receita Total:**
- Soma do `currentValue` de todos os leads com status `contract_finalized`

#### **Taxa de Conversão:**
```typescript
taxaConversao = (vendas / agendamentos) * 100
```

#### **Churn Rate:**
```typescript
churnRate = (operator_denied / vendas) * 100
```

## 📁 **Arquivos Modificados**

### 1. **MetricsRepository.ts**
```typescript
// Antes: Buscava apenas por manager.supabaseId
where: {
  manager: {
    supabaseId: supabaseId,
  }
}

// Depois: Verifica role e busca corretamente
const profile = await prisma.profile.findUnique({
  where: { supabaseId },
  select: { id: true, role: true, operators: true }
});

if (profile.role === 'manager') {
  // Busca do manager + operators
  whereClause = {
    OR: [
      { managerId: profile.id },
      { assignedTo: { in: operatorIds } }
    ]
  };
} else {
  // Busca apenas do operator
  whereClause = {
    assignedTo: profile.id
  };
}
```

### 2. **DashboardInfosService.ts**
```typescript
// Antes: NEGOCIACAO tinha apenas 'offerNegotiation'
NEGOCIACAO: ['offerNegotiation']

// Depois: Inclui 'pricingRequest' (Cotação)
NEGOCIACAO: ['offerNegotiation', 'pricingRequest']
```

## 🧪 **Como Testar**

### **Teste 1: Manager**
```bash
curl "http://localhost:3000/api/v1/dashboard/metrics?supabaseId=<MANAGER_ID>&period=30d"
```
**Esperado:** Retorna métricas do manager + todos os operators

### **Teste 2: Operator**
```bash
curl "http://localhost:3000/api/v1/dashboard/metrics?supabaseId=<OPERATOR_ID>&period=30d"
```
**Esperado:** Retorna métricas apenas do operator

### **Verificar Cálculos:**
```bash
curl "http://localhost:3000/api/v1/dashboard/metrics?supabaseId=<ID>&period=30d" | jq '.result | {
  agendamentos,
  negociacao,
  implementacao,
  vendas,
  taxaConversao,
  churnRate,
  receitaTotal
}'
```

## ✅ **Validações**

- ✅ **Manager**: Busca leads do manager + operators
- ✅ **Operator**: Busca apenas leads atribuídos ao operator
- ✅ **Status Groups**: Incluído `pricingRequest` em Negociação
- ✅ **Taxa de Conversão**: `(vendas / agendamentos) * 100`
- ✅ **Churn Rate**: `(operator_denied / vendas) * 100`
- ✅ **Receita Total**: Soma de `currentValue` dos leads vendidos

## 📊 **Exemplo de Resposta**

```json
{
  "agendamentos": 10,
  "negociacao": 5,
  "implementacao": 3,
  "vendas": 2,
  "NoShow": 1,
  "taxaConversao": 20.00,
  "churnRate": 0.00,
  "receitaTotal": 5000.00,
  "leadsPorPeriodo": [...],
  "statusCount": {...}
}
```

## 🎯 **Status Final**

- ✅ **Lógica Manager/Operator**: Implementada corretamente
- ✅ **Grupos de Status**: Corrigidos (Negociação inclui Cotação)
- ✅ **Cálculos**: Taxas de conversão e churn calculadas corretamente
- ✅ **Receita Total**: Somando apenas vendas finalizadas
- ✅ **API**: Funcionando para ambos os perfis (Manager/Operator)

---

**Data da Correção:** 30 de setembro de 2025
**Branch:** `feature/adding-dashboard-service`
