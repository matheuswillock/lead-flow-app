# 🎯 Sistema de Tratamento de Erros Específicos

## 📋 Visão Geral

Implementação completa de tratamento de erros específicos para operações de criação de leads, fornecendo feedback detalhado e acionável aos usuários.

## 🎨 Benefícios

### Antes ❌
```
Toast: "Erro ao criar lead"
```
**Problema:** Usuário não sabe o que está errado nem como corrigir.

### Depois ✅
```
Toast: "⚠️ Já existe um lead com este telefone: (11) 98370-9746"
```
**Solução:** Usuário sabe exatamente qual é o problema e pode corrigir imediatamente.

## 🏗️ Arquitetura

### Camadas de Tratamento

```
┌─────────────────────────────────────────────────┐
│         1. API Layer (LeadUseCase.ts)           │
│  ┌────────────────────────────────────────┐     │
│  │ Prisma Error → Specific Error Message │     │
│  └────────────────────────────────────────┘     │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│      2. Hook Layer (useLeads.ts)                │
│  ┌────────────────────────────────────────┐     │
│  │ Extract errorMessages from Response    │     │
│  └────────────────────────────────────────┘     │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│       3. UI Layer (BoardDialog.tsx)             │
│  ┌────────────────────────────────────────┐     │
│  │ Categorize & Display Specific Toast   │     │
│  └────────────────────────────────────────┘     │
└─────────────────────────────────────────────────┘
```

## 📝 Implementação Detalhada

### 1. API Layer - LeadUseCase.ts

**Responsabilidade:** Detectar erros do Prisma e converter em mensagens específicas.

```typescript
async createLead(supabaseId: string, data: CreateLeadRequest): Promise<Output> {
  try {
    // ... código de criação ...
    
    return new Output(true, ["Lead criado com sucesso"], [], lead);
    
  } catch (error) {
    if (error instanceof Error) {
      // 🔴 Unique Constraint (Telefone Duplicado)
      if (error.message.includes('Unique constraint')) {
        if (data.phone) {
          return new Output(
            false, 
            [], 
            [`Já existe um lead com o telefone ${data.phone}`], 
            null
          );
        }
        return new Output(false, [], ["Já existe um lead com estes dados"], null);
      }
      
      // 🟡 Validation Error
      if (error.message.includes('validation') || error.message.includes('Invalid')) {
        return new Output(false, [], [`Dados inválidos: ${error.message}`], null);
      }
      
      // 🟠 Foreign Key Constraint
      if (error.message.includes('Foreign key constraint')) {
        return new Output(false, [], ["Erro: Dados de relacionamento inválidos"], null);
      }
    }
    
    // 🔵 Generic Error
    return new Output(false, [], ["Erro interno do servidor ao criar lead"], null);
  }
}
```

**Erros Detectados:**
- ✅ Unique Constraint → Telefone duplicado
- ✅ Validation Error → Dados inválidos
- ✅ Foreign Key Constraint → Relacionamento inválido
- ✅ Generic Error → Erro desconhecido

### 2. Hook Layer - useLeads.ts

**Responsabilidade:** Extrair mensagens de erro específicas da API.

```typescript
const createLead = useCallback(async (lead: CreateLeadRequest) => {
  try {
    const response = await fetch('/api/v1/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-supabase-user-id': supabaseId,
      },
      body: JSON.stringify(lead),
    });

    // ⚠️ IMPORTANTE: Parse response ANTES de verificar status
    const apiResult = await response.json();

    if (!response.ok) {
      // Extrai mensagem específica do errorMessages array
      const errorMessage = apiResult.errorMessages?.join(', ') 
        || apiResult.message 
        || 'Erro ao criar lead';
      
      throw new Error(errorMessage);
    }

    return apiResult;
  } catch (error) {
    console.error('Error creating lead:', error);
    throw error; // Re-throw para UI Layer capturar
  }
}, [supabaseId]);
```

**Fluxo:**
1. Faz requisição POST para API
2. Parse response **antes** de verificar status
3. Extrai `errorMessages` array do Output
4. Junta mensagens com vírgula ou usa fallback
5. Lança erro com mensagem específica

### 3. UI Layer - BoardDialog.tsx

**Responsabilidade:** Categorizar erro e exibir toast apropriado.

```typescript
const onSubmit = async (data: LeadFormData) => {
  try {
    if (currentLead?.id) {
      // ... update logic ...
    } else {
      // CREATE FLOW
      const toastId = toast.loading(`Criando lead "${data.name}"...`);
      
      try {
        setOpen(false); // ✨ Optimistic update
        
        const createData = transformToCreateRequest(data);
        const result = await createLead(createData);
        
        if (result.success) {
          toast.success(
            `Lead "${data.name}" criado com sucesso!`,
            { id: toastId }
          );
          await refreshLeads();
        }
      } catch (createError) {
        const errorMessage = createError instanceof Error 
          ? createError.message 
          : "Erro ao criar lead";
        
        // 🔴 UNIQUE CONSTRAINT ERROR
        if (errorMessage.includes('Unique constraint') || errorMessage.includes('já existe')) {
          toast.error(
            `⚠️ Já existe um lead com este telefone: ${data.phone}`,
            {
              id: toastId,
              duration: 5000,
              description: "Por favor, verifique se o lead já está cadastrado ou use outro telefone."
            }
          );
        } 
        // 🟡 VALIDATION ERROR
        else if (errorMessage.includes('validation') || errorMessage.includes('inválido')) {
          toast.error(
            `⚠️ Dados inválidos: ${errorMessage}`,
            {
              id: toastId,
              duration: 5000,
              description: "Por favor, verifique os campos e tente novamente."
            }
          );
        } 
        // 🔵 GENERIC ERROR
        else {
          toast.error(errorMessage, {
            id: toastId,
            duration: 5000,
            description: "Por favor, tente novamente."
          });
        }
        
        setOpen(true); // 🔄 Reabre dialog para retry
        throw createError; // Re-throw para outer catch
      }
    }
  } catch (error) {
    console.error("Erro ao salvar lead:", error);
  }
};
```

**Categorização de Erros:**

| Tipo | Detecção | Toast | Ícone | Duração |
|------|----------|-------|-------|---------|
| **Unique Constraint** | `includes('já existe')` | Telefone específico | ⚠️ | 5s |
| **Validation** | `includes('inválido')` | Dados inválidos + descrição | ⚠️ | 5s |
| **Generic** | Fallback | Mensagem original | ❌ | 5s |

## 🎯 Casos de Uso

### Caso 1: Telefone Duplicado

**Cenário:**
```typescript
Manager tenta criar lead com telefone: (11) 98370-9746
Telefone já existe no banco de dados
```

**Fluxo:**
```
1. UI: Loading toast "Criando lead "João Silva"..."
2. UI: Dialog fecha (optimistic)
3. API: Prisma lança Unique constraint error
4. API: LeadUseCase detecta e retorna "Já existe um lead com o telefone (11) 98370-9746"
5. Hook: Extrai mensagem e lança erro
6. UI: Detecta "já existe", exibe toast específico
7. UI: Reabre dialog para usuário corrigir
```

**Toast Exibido:**
```
⚠️ Já existe um lead com este telefone: (11) 98370-9746
Por favor, verifique se o lead já está cadastrado ou use outro telefone.
```

### Caso 2: Dados Inválidos

**Cenário:**
```typescript
Email com formato inválido: "joao@"
```

**Toast Exibido:**
```
⚠️ Dados inválidos: Invalid email format
Por favor, verifique os campos e tente novamente.
```

### Caso 3: Erro de Rede

**Cenário:**
```typescript
Servidor fora do ar ou timeout
```

**Toast Exibido:**
```
❌ Erro interno do servidor ao criar lead
Por favor, tente novamente.
```

## 🔄 Recuperação de Erros

### Automatic Dialog Reopen

```typescript
// Quando erro ocorre:
setOpen(true); // Dialog reabre automaticamente

// Benefícios:
✅ Dados preservados no formulário
✅ Usuário pode corrigir imediatamente
✅ Não perde contexto
✅ Sem necessidade de recomeçar
```

### Data Preservation

```typescript
// Form data é mantido durante todo o ciclo:
const { control, handleSubmit } = useForm<LeadFormData>({
  defaultValues: currentLead || getDefaultValues()
});

// Mesmo após erro, dados continuam disponíveis
```

## 📊 Mapeamento de Erros Prisma

### Unique Constraint

**Prisma Error:**
```
Error: Unique constraint failed on the fields: (`managerId`,`phone`)
```

**Nossa Mensagem:**
```
Já existe um lead com o telefone (11) 98370-9746
```

### Validation Error

**Prisma Error:**
```
Error: Invalid value for field `email`: Invalid email format
```

**Nossa Mensagem:**
```
Dados inválidos: Invalid value for field `email`: Invalid email format
```

### Foreign Key Constraint

**Prisma Error:**
```
Error: Foreign key constraint failed on the field: `assignedTo`
```

**Nossa Mensagem:**
```
Erro: Dados de relacionamento inválidos
```

## 🧪 Testes

### Teste 1: Unique Constraint

```typescript
// 1. Criar lead
const lead1 = {
  name: "João Silva",
  phone: "(11) 98370-9746",
  email: "joao@email.com"
};
await createLead(lead1); // ✅ Sucesso

// 2. Tentar criar lead com mesmo telefone
const lead2 = {
  name: "Maria Santos",
  phone: "(11) 98370-9746", // ❌ Duplicado
  email: "maria@email.com"
};
await createLead(lead2); 

// ✅ Deve exibir: "⚠️ Já existe um lead com este telefone: (11) 98370-9746"
// ✅ Dialog deve reabrir automaticamente
```

### Teste 2: Validation Error

```typescript
const lead = {
  name: "João Silva",
  phone: "(11) 98370-9746",
  email: "email-invalido" // ❌ Formato inválido
};
await createLead(lead);

// ✅ Deve exibir: "⚠️ Dados inválidos: ..."
// ✅ Dialog deve reabrir automaticamente
```

### Teste 3: Success Flow

```typescript
const lead = {
  name: "João Silva",
  phone: "(11) 98370-9746",
  email: "joao@email.com"
};
await createLead(lead);

// ✅ Deve exibir loading: "Criando lead "João Silva"..."
// ✅ Dialog deve fechar imediatamente
// ✅ Deve exibir success: "Lead "João Silva" criado com sucesso!"
// ✅ Lead deve aparecer no board
```

## 📈 Melhorias Implementadas

| Feature | Status | Benefício |
|---------|--------|-----------|
| Mensagens específicas de erro | ✅ | Usuário sabe exatamente o problema |
| Telefone no erro de duplicata | ✅ | Identifica qual telefone está duplicado |
| Categorização de erros | ✅ | Toast apropriado para cada tipo |
| Dialog reopen automático | ✅ | Usuário pode corrigir imediatamente |
| Preservação de dados | ✅ | Não perde informações digitadas |
| Loading states | ✅ | Feedback visual durante operação |
| Optimistic updates | ✅ | UI responde instantaneamente |
| Descrições detalhadas | ✅ | Orientação sobre como resolver |

## 🎓 Boas Práticas

### 1. Parse Response Antes de Verificar Status
```typescript
// ✅ CORRETO
const apiResult = await response.json();
if (!response.ok) {
  throw new Error(apiResult.errorMessages?.join(', '));
}

// ❌ ERRADO
if (!response.ok) {
  const apiResult = await response.json(); // Pode falhar
}
```

### 2. Use Array de Error Messages
```typescript
// ✅ API retorna array
return new Output(false, [], ["Mensagem 1", "Mensagem 2"], null);

// ✅ Hook junta com vírgula
apiResult.errorMessages?.join(', ')
```

### 3. Sempre Reabra Dialog em Erros
```typescript
catch (error) {
  toast.error(message);
  setOpen(true); // ⚠️ Crucial para UX
}
```

### 4. Inclua Contexto nas Mensagens
```typescript
// ✅ ESPECÍFICO
`Já existe um lead com o telefone ${data.phone}`

// ❌ GENÉRICO
"Lead duplicado"
```

## 🚀 Próximos Passos

### Melhorias Futuras

1. **Botão de Ação no Toast**
```typescript
toast.error("Lead duplicado", {
  action: {
    label: "Ver Lead Existente",
    onClick: () => navigateToLead(existingLeadId)
  }
});
```

2. **Sugestão de Correção**
```typescript
toast.error("Telefone duplicado", {
  description: "Sugestão: Adicione extensão ao telefone (11) 98370-9746 ramal 123"
});
```

3. **Verificação Prévia**
```typescript
// Antes de criar, verificar se telefone existe
const exists = await checkPhoneDuplicate(phone);
if (exists) {
  showWarning("Este telefone já está cadastrado. Deseja continuar?");
}
```

4. **Analytics**
```typescript
// Rastrear tipos de erros mais comuns
trackError('lead_creation', errorType, errorMessage);
```

## 📚 Arquivos Modificados

```
✅ app/api/useCases/leads/LeadUseCase.ts
   - Detecção de erros Prisma
   - Mensagens específicas por tipo
   
✅ hooks/useLeads.ts
   - Extração de errorMessages array
   - Parse antes de verificar status
   
✅ app/[supabaseId]/board/features/container/BoardDialog.tsx
   - Categorização de erros
   - Toasts específicos por tipo
   - Dialog reopen automático
```

## 🎉 Resultado Final

**UX Completo:**
```
1. Loading: "Criando lead "João Silva"..."
2. Optimistic: Dialog fecha em 0ms
3. Success: "Lead "João Silva" criado com sucesso!" ✅
   
   OU
   
3. Error: "⚠️ Já existe um lead com este telefone: (11) 98370-9746"
4. Recovery: Dialog reabre automaticamente para correção
5. Data: Todos os campos preservados
```

---

**Documentação criada em:** ${new Date().toLocaleDateString('pt-BR')}
**Versão:** 1.0.0
