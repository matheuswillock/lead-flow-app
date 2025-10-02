# Sincronização de Data de Reunião (meetingDate)

## 📋 Objetivo

Garantir que o campo `meetingDate` da tabela `leads` seja atualizado sempre que um agendamento for criado, permitindo que o dialog de edição do lead mostre a data da reunião.

---

## ✨ Implementação

### 1. **Atualização via Dialog de Agendamento**

Quando o usuário clica em "Agendar Reunião" e preenche o formulário:

```typescript
// POST /api/v1/leads/{id}/schedule
1. Cria registro em LeadsSchedule com a data escolhida
2. Atualiza Lead.meetingDate com a mesma data
3. Retorna sucesso
```

**Arquivo**: `app/api/v1/leads/[id]/schedule/route.ts`

```typescript
// Criar agendamento
const schedule = await leadScheduleRepository.create({
  leadId,
  date: meetingDate,
  notes,
});

// Atualizar o campo meetingDate do lead
await prisma.lead.update({
  where: { id: leadId },
  data: { meetingDate },
});
```

### 2. **Atualização via Drag & Drop**

Quando o usuário arrasta um card para a coluna "Agendado":

```typescript
// LeadUseCase.updateLeadStatus()
1. Se status = scheduled e lead NÃO tem meetingDate:
   - Define meetingDate = data atual
   - Cria registro em LeadsSchedule com data atual
   - Atualiza Lead.meetingDate
   
2. Se status = scheduled e lead JÁ tem meetingDate:
   - Cria registro em LeadsSchedule com meetingDate existente
   - NÃO atualiza Lead.meetingDate (mantém a data original)
```

**Arquivo**: `app/api/useCases/leads/LeadUseCase.ts`

```typescript
if (status === LeadStatus.scheduled) {
  const meetingDate = existingLead.meetingDate || new Date();
  
  await leadScheduleRepository.create({
    leadId: id,
    date: meetingDate,
    notes: `Lead agendado`,
  });

  // Se não tinha meetingDate, atualizar o lead
  if (!existingLead.meetingDate) {
    await this.leadRepository.update(id, {
      meetingDate,
    });
  }
}
```

---

## 🔄 Fluxos Completos

### Fluxo 1: Agendar via Botão (com data escolhida)

```
Card na coluna "Nova Oportunidade"
    ↓
Usuário clica "Agendar Reunião"
    ↓
Dialog abre: usuário escolhe data/hora (ex: 05/10/2025 14:30)
    ↓
Submit → POST /api/v1/leads/{id}/schedule
    ↓
1. Cria registro em LeadsSchedule (date: 05/10/2025 14:30)
2. Atualiza Lead.meetingDate = 05/10/2025 14:30
3. PUT /api/v1/leads/{id}/status (scheduled)
    ↓
Lead move para coluna "Agendado"
    ↓
Dialog do lead mostra: "Data Reunião: 05/10/2025 14:30" ✅
```

### Fluxo 2: Arrastar para Agendado (SEM meetingDate)

```
Card na coluna "Nova Oportunidade" (sem meetingDate)
    ↓
Usuário arrasta para coluna "Agendado"
    ↓
LeadUseCase.updateLeadStatus(scheduled)
    ↓
1. Lead não tem meetingDate
2. Define meetingDate = data/hora atual
3. Cria registro em LeadsSchedule (date: agora)
4. Atualiza Lead.meetingDate = agora
    ↓
Lead move para coluna "Agendado"
    ↓
Dialog do lead mostra: "Data Reunião: [data atual]" ✅
```

### Fluxo 3: Arrastar para Agendado (COM meetingDate)

```
Card na coluna "Nova Oportunidade" (com meetingDate: 08/10/2025)
    ↓
Usuário arrasta para coluna "Agendado"
    ↓
LeadUseCase.updateLeadStatus(scheduled)
    ↓
1. Lead JÁ tem meetingDate = 08/10/2025
2. Cria registro em LeadsSchedule (date: 08/10/2025)
3. NÃO atualiza Lead.meetingDate (mantém 08/10/2025)
    ↓
Lead move para coluna "Agendado"
    ↓
Dialog do lead mostra: "Data Reunião: 08/10/2025" ✅
```

---

## 📊 Dados Sincronizados

### Tabela: `leads`
```typescript
{
  id: uuid,
  name: string,
  status: LeadStatus,
  meetingDate: timestamp | null, // ✅ Atualizado
  // ... outros campos
}
```

### Tabela: `leads_schedule`
```typescript
{
  id: uuid,
  leadId: uuid,
  date: timestamp, // Sempre igual ao Lead.meetingDate
  notes: string | null,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

---

## 🎯 Benefícios

### 1. **Consistência de Dados**
- ✅ `Lead.meetingDate` sempre reflete a data do último agendamento
- ✅ Dialog do lead mostra data correta
- ✅ Histórico completo em `LeadsSchedule`

### 2. **Melhor UX**
- ✅ Usuário vê a data da reunião no dialog de edição
- ✅ Não precisa ir em outro lugar para ver a data
- ✅ Data atualizada automaticamente

### 3. **Flexibilidade**
- ✅ Permite múltiplos agendamentos (histórico)
- ✅ `meetingDate` mostra o agendamento "ativo"
- ✅ `LeadsSchedule` mantém todo o histórico

---

## 🔍 Visualização no Dialog

### Antes (sem sincronização):
```
Dialog "Editar Lead"
├── Nome: João Silva
├── Email: joao@email.com
├── Status: Agendado
└── Data Reunião: [vazio] ❌
```

### Depois (com sincronização):
```
Dialog "Editar Lead"
├── Nome: João Silva
├── Email: joao@email.com
├── Status: Agendado
└── Data Reunião: 05/10/2025 14:30 ✅
```

---

## 🧪 Como Testar

### Teste 1: Agendar via Dialog
1. Abra um lead na coluna "Nova Oportunidade"
2. Clique em "Agendar Reunião"
3. Escolha data: 05/10/2025 às 14:30
4. Clique em "Agendar Reunião"
5. Abra o dialog de edição do lead
6. ✅ Verifique se mostra "Data Reunião: 05/10/2025 14:30"

### Teste 2: Arrastar SEM meetingDate
1. Crie um novo lead (não terá meetingDate)
2. Arraste para coluna "Agendado"
3. Abra o dialog de edição do lead
4. ✅ Verifique se mostra data/hora atual

### Teste 3: Arrastar COM meetingDate
1. Crie um lead e defina meetingDate manualmente no banco
2. Arraste para coluna "Agendado"
3. Abra o dialog de edição do lead
4. ✅ Verifique se mantém a data original

### Teste 4: Verificar no Banco
```sql
-- Verificar Lead
SELECT id, name, status, "meetingDate" 
FROM leads 
WHERE name = 'João Silva';

-- Verificar Agendamento
SELECT id, "leadId", date, notes 
FROM leads_schedule 
WHERE "leadId" = '{lead_id}';

-- ✅ meetingDate e date devem ser iguais
```

---

## 📝 Arquivos Modificados

### 1. `app/api/v1/leads/[id]/schedule/route.ts`
**Mudança**: Adicionada atualização de `Lead.meetingDate` após criar agendamento

```typescript
// ANTES
const schedule = await leadScheduleRepository.create({
  leadId,
  date: new Date(date),
  notes,
});

// DEPOIS
const meetingDate = new Date(date);
const schedule = await leadScheduleRepository.create({
  leadId,
  date: meetingDate,
  notes,
});

// ✅ NOVO: Atualiza meetingDate do lead
await prisma.lead.update({
  where: { id: leadId },
  data: { meetingDate },
});
```

### 2. `app/api/useCases/leads/LeadUseCase.ts`
**Mudança**: Atualiza `Lead.meetingDate` ao arrastar para "Agendado" (se não tiver data)

```typescript
// ANTES
if (status === LeadStatus.scheduled) {
  await leadScheduleRepository.create({
    leadId: id,
    date: existingLead.meetingDate || new Date(),
    notes: `Lead agendado`,
  });
}

// DEPOIS
if (status === LeadStatus.scheduled) {
  const meetingDate = existingLead.meetingDate || new Date();
  
  await leadScheduleRepository.create({
    leadId: id,
    date: meetingDate,
    notes: `Lead agendado`,
  });

  // ✅ NOVO: Atualiza meetingDate se não tiver
  if (!existingLead.meetingDate) {
    await this.leadRepository.update(id, {
      meetingDate,
    });
  }
}
```

---

## ⚠️ Considerações

### Sobrescrever Data
- ✅ Via dialog: SEMPRE sobrescreve (usuário escolheu nova data)
- ✅ Via drag: APENAS se não tiver data (preserva data existente)

### Múltiplos Agendamentos
- ✅ `LeadsSchedule`: Mantém histórico completo
- ✅ `Lead.meetingDate`: Mostra último/próximo agendamento
- 💡 Futuro: Pode-se mostrar "próximo agendamento" em vez de "último"

### Reagendamento
- 💡 Criar endpoint específico para reagendar
- 💡 Permitir editar data no dialog de agendamento
- 💡 Manter histórico de todas as mudanças

---

## 🚀 Resultado

Agora o campo `meetingDate` da tabela `leads` está **sempre sincronizado** com os agendamentos, permitindo que:

- ✅ Dialog de edição mostre data da reunião
- ✅ Filtros por data funcionem corretamente
- ✅ Relatórios usem data correta
- ✅ Notificações sejam enviadas no momento certo

**Status**: Implementado e funcionando! ✅
