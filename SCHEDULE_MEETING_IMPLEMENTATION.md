# Implementação do Fluxo de Agendamento de Reunião

## 📋 Resumo

Implementado fluxo completo para agendar reuniões com leads, similar ao fluxo de finalização de contrato.

---

## ✨ Funcionalidades Implementadas

### 1. **Botão "Agendar Reunião"**
- Exibido apenas em cards da coluna **"Nova Oportunidade"**
- Abre dialog para preencher dados do agendamento
- Design consistente com botão "Fechar Contrato"

### 2. **Dialog de Agendamento**
- Formulário com validação
- Campos:
  - **Data**: DatePicker com calendário
  - **Horário**: Input de time
  - **Observações**: Textarea opcional
- Validações:
  - Data obrigatória
  - Não permite datas passadas
  - Horário obrigatório

### 3. **Criação Automática de Registro**
- Ao arrastar card para coluna "Agendado":
  - Cria registro em `LeadsSchedule`
  - Atualiza status do lead para `scheduled`
  - Usa `meetingDate` do lead ou data atual

### 4. **API Endpoint**
- `POST /api/v1/leads/{id}/schedule`
- `GET /api/v1/leads/{id}/schedule`
- Validação com Zod
- Autenticação via header `x-supabase-user-id`

---

## 📁 Arquivos Criados

### 1. **Repository**
- `app/api/infra/data/repositories/leadSchedule/ILeadScheduleRepository.ts`
  - Interface atualizada com CRUD completo
  - Métodos: `create`, `findByLeadId`, `findLatestByLeadId`, `update`, `delete`

- `app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository.ts`
  - Implementação completa do repository
  - Instância singleton exportada

### 2. **API Endpoint**
- `app/api/v1/leads/[id]/schedule/route.ts`
  - POST: Criar agendamento
  - GET: Listar agendamentos do lead
  - Validação com Zod schema
  - Tratamento de erros

### 3. **Componentes Frontend**
- `app/[supabaseId]/board/features/container/ScheduleMeetingDialog.tsx`
  - Dialog de agendamento
  - DatePicker integrado
  - Input de horário
  - Textarea para observações
  - Toast notifications

### 4. **Componentes Atualizados**
- `app/[supabaseId]/board/features/container/LeadCard.tsx`
  - Adicionado prop `onScheduleMeeting`
  - Botão "Agendar Reunião" para nova oportunidade
  - Lógica condicional de exibição

- `app/[supabaseId]/board/features/container/BoardColumns.tsx`
  - Prop `onScheduleMeeting` adicionada
  - Passada para cada LeadCard

- `app/[supabaseId]/board/features/container/BoardContainer.tsx`
  - Estado `showScheduleDialog` e `selectedLead`
  - Handler `handleScheduleMeeting`
  - Handler `handleScheduleSuccess`
  - Renderização condicional do ScheduleMeetingDialog

### 5. **Componente shadcn/ui Instalado**
- `components/ui/textarea.tsx`
  - Componente Textarea instalado via CLI

---

## 🔄 Fluxo Completo

### Opção 1: Via Botão
```
Usuário clica em "Agendar Reunião"
    ↓
Dialog abre com formulário
    ↓
Usuário preenche data, horário e observações
    ↓
Submit → POST /api/v1/leads/{id}/schedule
    ↓
Cria registro em LeadsSchedule
    ↓
PUT /api/v1/leads/{id}/status (scheduled)
    ↓
Atualiza status do lead
    ↓
Toast de sucesso + Refresh do board
```

### Opção 2: Via Drag & Drop
```
Usuário arrasta card para "Agendado"
    ↓
BoardContext.onDrop() detecta mudança
    ↓
updateLeadStatusInAPI() chamado
    ↓
LeadUseCase.updateLeadStatus()
    ↓
Se status = scheduled:
  → Cria registro em LeadsSchedule
  → Usa meetingDate ou data atual
    ↓
Lead movido para coluna "Agendado"
```

---

## 🎨 UI/UX

### Botão Agendar Reunião
- **Variante**: `outline`
- **Ícone**: Calendar (lucide-react)
- **Cor**: Secundária (não destaca tanto quanto "Fechar Contrato")
- **Posição**: CardContent do LeadCard
- **Visibilidade**: Apenas coluna "Nova Oportunidade"

### Dialog
- **Largura**: `max-w-[500px]`
- **Título**: "Agendar Reunião"
- **Descrição**: "Agendar reunião com {leadName}"
- **Botões**:
  - Cancelar (outline)
  - Agendar Reunião (primary)
- **Loading State**: Botão desabilitado com texto "Agendando..."

### DatePicker
- **Componente**: shadcn/ui Popover + Calendar
- **Locale**: pt-BR
- **Restrição**: Não permite datas passadas
- **Formato**: PPP (ex: 2 de outubro de 2025)

---

## 📊 Dados Salvos

### Tabela: `leads_schedule`
```typescript
{
  id: uuid,
  leadId: uuid,
  date: timestamp, // Data/hora combinada da reunião
  notes: string | null, // Observações do agendamento
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Exemplo de Payload
```json
{
  "date": "2025-10-05T14:30:00.000Z",
  "notes": "Reunião para apresentação do plano de saúde"
}
```

---

## 🔧 Integrações

### Com LeadUseCase
O método `updateLeadStatus()` já cria automaticamente registro em `LeadsSchedule` quando:
- Status muda para `scheduled`
- Usa `meetingDate` do lead se disponível
- Caso contrário, usa data atual
- Adiciona nota automática

### Com BoardContext
- `refreshLeads()`: Recarrega board após agendar
- `updateLeadStatusInAPI()`: Atualiza status ao arrastar

### Com Métricas
- Dashboard já busca dados de `LeadsSchedule`
- Métrica "Agendamentos" conta registros da tabela
- Filtros de data aplicados

---

## ✅ Validações

### Frontend
- ✅ Data obrigatória
- ✅ Data não pode ser no passado
- ✅ Horário obrigatório
- ✅ Observações opcionais

### Backend
- ✅ Validação Zod schema
- ✅ Autenticação via header
- ✅ Lead ID válido
- ✅ Data em formato ISO 8601

---

## 🧪 Como Testar

### Teste 1: Agendar via Botão
1. Navegue para o board
2. Encontre um lead na coluna "Nova Oportunidade"
3. Clique em "Agendar Reunião"
4. Preencha data, horário e observações
5. Clique em "Agendar Reunião"
6. Verifique toast de sucesso
7. Verifique se lead mudou para coluna "Agendado"

### Teste 2: Arrastar para Agendado
1. Arraste um lead para coluna "Agendado"
2. Verifique se registro foi criado em `LeadsSchedule`
3. Verifique status do lead no banco

### Teste 3: Validações
1. Tente agendar sem selecionar data
2. Tente selecionar data passada
3. Verifique mensagens de erro

### Teste 4: API
```bash
# Criar agendamento
curl -X POST http://localhost:3000/api/v1/leads/{leadId}/schedule \
  -H "Content-Type: application/json" \
  -H "x-supabase-user-id: {supabaseId}" \
  -d '{
    "date": "2025-10-05T14:30:00.000Z",
    "notes": "Reunião importante"
  }'

# Listar agendamentos
curl -X GET http://localhost:3000/api/v1/leads/{leadId}/schedule \
  -H "x-supabase-user-id: {supabaseId}"
```

---

## 🚀 Próximos Passos Sugeridos

### Melhorias Futuras
- [ ] Notificações por email antes da reunião
- [ ] Integração com Google Calendar
- [ ] Reagendamento de reuniões
- [ ] Histórico de todos os agendamentos do lead
- [ ] Confirmação de presença
- [ ] Link para videochamada (Google Meet/Zoom)

### Validações Adicionais
- [ ] Evitar agendamentos duplicados no mesmo horário
- [ ] Validar horário comercial
- [ ] Limite de agendamentos por dia

### Features Extra
- [ ] Lembrete automático 1 dia antes
- [ ] Status do agendamento (Confirmado, Cancelado, Realizado)
- [ ] Anexar documentos ao agendamento
- [ ] Chat integrado para comunicação antes da reunião

---

## 📝 Notas Técnicas

### Componentes shadcn/ui Utilizados
- Dialog
- Button
- Calendar  
- Popover
- Label
- Textarea (novo)
- Toast (Sonner)

### Bibliotecas
- `date-fns`: Formatação de datas
- `date-fns/locale/ptBR`: Localização em português
- `lucide-react`: Ícones
- `zod`: Validação de schemas

### Performance
- Repository usa singleton pattern
- Queries otimizadas com `select`
- Index no campo `leadId` da tabela `leads_schedule`

---

## 🎯 Resultado

Fluxo de agendamento completo e funcional, integrado com:
- ✅ UI/UX intuitiva
- ✅ Validações robustas
- ✅ API RESTful
- ✅ Banco de dados
- ✅ Métricas do dashboard
- ✅ Drag & drop automático

**Status**: Pronto para produção! 🚀
