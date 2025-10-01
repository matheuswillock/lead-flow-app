# Botão Fechar Contrato no Dialog de Edição de Lead

## Implementação

### Objetivo
Adicionar o botão "Fechar Contrato" dentro do dialog de edição de lead, não apenas no card do kanban board.

### Mudanças Realizadas

#### 1. BoardDialog.tsx (`/app/[supabaseId]/board/features/container/BoardDialog.tsx`)

**Imports Adicionados:**
```typescript
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { FinalizeContractDialog } from "./FinalizeContractDialog";
```

**Estado Adicionado:**
```typescript
const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);

const canFinalizeContract = lead && (
  lead.status === 'invoicePayment' || 
  lead.status === 'dps_agreement' ||
  lead.status === 'offerSubmission'
);
```

**Handlers Adicionados:**
```typescript
const handleFinalizeContract = () => {
  setShowFinalizeDialog(true);
};

const handleFinalizeSubmit = async (data: any) => {
  if (!lead) return;

  try {
    const response = await fetch(`/api/v1/leads/${lead.id}/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors?.[0] || 'Erro ao finalizar contrato');
    }

    toast.success('Contrato finalizado com sucesso!');
    setShowFinalizeDialog(false);
    setOpen(false);
    await refreshLeads();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Erro ao finalizar contrato');
    throw error;
  }
};
```

**UI Atualizada:**
- Botão adicionado no cabeçalho do dialog, ao lado do título
- Aparece apenas quando o lead está em edição (não na criação)
- Visível somente nas colunas permitidas: `invoicePayment`, `dps_agreement`, `offerSubmission`
- Dialog de finalização renderizado condicionalmente

## Comportamento

### Quando o Botão Aparece
1. ✅ Lead está sendo editado (não na criação)
2. ✅ Lead está em uma das colunas permitidas:
   - `invoicePayment` (Pagamento de Fatura)
   - `dps_agreement` (Acordo DPS)
   - `offerSubmission` (Envio de Proposta)

### Fluxo de Uso
1. Usuário abre dialog de edição de lead
2. Se o lead estiver em uma coluna permitida, vê o botão "Fechar Contrato" no cabeçalho
3. Ao clicar, abre o dialog de finalização de contrato
4. Preenche os dados do contrato (data de finalização, data de início, duração, valor, observações)
5. Ao confirmar:
   - Cria registro em `LeadFinalized`
   - Atualiza status do lead para `contract_finalized`
   - Cria atividade no histórico
   - Fecha ambos os dialogs
   - Atualiza o board

### Validações
- Botão só aparece em leads existentes (não na criação)
- Botão só aparece nos status corretos
- API valida todos os dados antes de criar o contrato finalizado
- Data de finalização não pode ser anterior à data de início
- Valor do contrato deve ser maior que zero
- Duração deve ser um número positivo

## Localizações do Botão

### 1. No Card do Kanban (implementação anterior)
- Aparece dentro do corpo do card
- Visível em: `invoicePayment`, `dps_agreement`, `offerSubmission`

### 2. No Dialog de Edição (nova implementação)
- Aparece no cabeçalho do dialog, ao lado do título
- Mesmas regras de visibilidade que o card
- Mesmo comportamento e validações

## Benefícios
- ✅ Maior acessibilidade: usuário pode finalizar contrato enquanto edita o lead
- ✅ Melhor UX: não precisa fechar o dialog e clicar no card
- ✅ Consistência: mesmo botão disponível em dois contextos
- ✅ Flexibilidade: usuário escolhe o momento mais conveniente para finalizar

## Arquivos Modificados
1. `/app/[supabaseId]/board/features/container/BoardDialog.tsx`

## Testes Sugeridos
1. ✅ Abrir dialog de criação de lead → Botão NÃO deve aparecer
2. ✅ Abrir dialog de edição de lead em status não permitido → Botão NÃO deve aparecer
3. ✅ Abrir dialog de edição de lead em `invoicePayment` → Botão deve aparecer
4. ✅ Clicar no botão → Dialog de finalização deve abrir
5. ✅ Finalizar contrato com dados válidos → Deve criar contrato e atualizar board
6. ✅ Verificar que ambos os dialogs fecham após finalização
7. ✅ Verificar toast de sucesso
8. ✅ Verificar atualização automática do board
