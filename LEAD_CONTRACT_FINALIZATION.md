# ✅ Implementação: Botão "Fechar Contrato" no Lead Card

## 🎯 Objetivo

Adicionar funcionalidade para finalizar contratos diretamente no card do lead no board Kanban.

## 📋 Funcionalidades Implementadas

### 1. **Botão "Fechar Contrato" no LeadCard**

**Comportamento:**
- Aparece apenas em colunas específicas:
  - `invoicePayment` (Boleto)
  - `dps_agreement` (DPS | Contrato)
  - `offerSubmission` (Proposta)
- Ao clicar, abre um dialog para preencher os dados do contrato
- Não interfere com o drag & drop do card

**Arquivo:** `/app/[supabaseId]/board/features/container/LeadCard.tsx`

### 2. **Dialog de Finalização de Contrato**

**Campos do Formulário:**
- **Valor do Contrato (R$)**: Campo numérico obrigatório
- **Data de Início**: Date picker com calendário
- **Data de Finalização**: Date picker com calendário (não pode ser anterior à data de início)
- **Observações**: Campo de texto opcional

**Validações:**
- Valor deve ser maior que zero
- Datas são obrigatórias
- Data de finalização não pode ser anterior à data de início

**Arquivo:** `/app/[supabaseId]/board/features/container/FinalizeContractDialog.tsx`

### 3. **Context atualizado**

Adicionado método `finalizeContract` no BoardContext para gerenciar a finalização.

**Arquivo:** `/app/[supabaseId]/board/features/context/BoardContext.tsx`

### 4. **API Endpoint**

**Rota:** `POST /api/v1/leads/[id]/finalize`

**Funcionalidades:**
- Valida dados do contrato
- Calcula duração em dias (desde criação até finalização)
- Cria registro na tabela `LeadFinalized`
- Atualiza status do lead para `contract_finalized`
- Atualiza `currentValue` do lead
- Cria atividade de histórico

**Transação Atômica:**
```typescript
prisma.$transaction([
  // 1. Criar LeadFinalized
  prisma.leadFinalized.create({...}),
  // 2. Atualizar Lead
  prisma.lead.update({...}),
  // 3. Criar Activity
  prisma.leadActivity.create({...})
])
```

**Arquivo:** `/app/api/v1/leads/[id]/finalize/route.ts`

## 📦 Dependências Instaladas

```bash
bun add date-fns
bunx shadcn@latest add popover calendar
```

## 🗂️ Estrutura da Tabela LeadFinalized

```prisma
model LeadFinalized {
  id              String   @id @default(uuid())
  leadId          String
  finalizedDateAt DateTime  // Data de finalização
  startDateAt     DateTime  // Data de início do contrato
  duration        Int       // Duração em dias
  amount          Decimal   // Valor do contrato
  notes           String?   // Observações
  createdAt       DateTime
  updatedAt       DateTime
  
  lead Lead @relation(...)
}
```

## 🔄 Fluxo Completo

1. **Usuário clica em "Fechar Contrato"** no card do lead
2. **Dialog abre** com formulário vazio
3. **Usuário preenche:**
   - Valor do contrato
   - Data de início (via date picker)
   - Data de finalização (via date picker)
   - Observações (opcional)
4. **Validações** são executadas no cliente
5. **Submit** envia dados para API
6. **API processa** em transação:
   - Cria `LeadFinalized`
   - Move lead para coluna `contract_finalized`
   - Atualiza valor do lead
   - Registra atividade
7. **Board recarrega** leads automaticamente
8. **Toast de sucesso** é exibido
9. **Lead aparece** na coluna "Negócio fechado"

## 🎨 UI Components Utilizados

- **Dialog**: Modal overlay para o formulário
- **Button**: Botão de ação no card e no dialog
- **Input**: Campo numérico para valor
- **Popover + Calendar**: Seletor de datas
- **Label**: Labels dos campos
- **Toast (Sonner)**: Notificações de sucesso/erro

## ✅ Features

- ✅ Botão condicional baseado na coluna
- ✅ Dialog com formulário completo
- ✅ Validações client-side
- ✅ Date pickers com restrições
- ✅ API endpoint com transação
- ✅ Cálculo automático de duração
- ✅ Atualização automática do board
- ✅ Feedback visual (loading states)
- ✅ Tratamento de erros
- ✅ Registro de atividade/histórico

## 🧪 Testes Necessários

1. **Teste Manual:**
   - Clicar no botão em diferentes colunas
   - Preencher formulário com dados válidos
   - Tentar submeter com dados inválidos
   - Verificar se o lead move para "Negócio fechado"
   - Verificar registro na tabela `LeadFinalized`

2. **Casos de Erro:**
   - Valor zero ou negativo
   - Datas não preenchidas
   - Data de finalização anterior à data de início
   - Lead não encontrado
   - Erro de rede

## 📝 Observações

- O botão só aparece nas colunas finais do funil
- O dialog não impede o uso normal do board
- A finalização é irreversível (sem botão de desfazer)
- Todas as operações são registradas no histórico
- O valor do contrato é formatado em Real (R$)

---

**Data:** 1 de outubro de 2025  
**Branch:** `feature/adding-dashboard-service`
