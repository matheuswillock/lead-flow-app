# Services de Assinatura - Documentação

## 📁 Estrutura (Padrão SOLID)

```
app/api/services/
├── IAsaasCustomerService.ts      # Interface - Contrato de gerenciamento de clientes
├── AsaasCustomerService.ts       # Implementação - Gerenciamento de clientes
├── IAsaasSubscriptionService.ts  # Interface - Contrato de gerenciamento de assinaturas
├── AsaasSubscriptionService.ts   # Implementação - Gerenciamento de assinaturas
├── IAsaasOperatorService.ts      # Interface - Contrato de gerenciamento de operadores
├── AsaasOperatorService.ts       # Implementação - Gerenciamento de operadores
└── index.ts                      # Exportações centralizadas
```

### Padrão de Design

Seguimos o princípio **SOLID (Interface Segregation & Dependency Inversion)**:
- Cada service possui uma **interface** que define seu contrato
- As **classes** implementam as interfaces garantindo type safety
- Facilita **testes unitários** (mocking de dependências)
- Permite **injeção de dependência** em use cases e controllers

**Arquitetura:**

```
┌─────────────────────────────────────────┐
│   API Endpoints (Next.js Route)        │
│   app/api/v1/*/route.ts                 │
└───────────────┬─────────────────────────┘
                │ depends on
                ▼
┌─────────────────────────────────────────┐
│   Use Cases (Business Logic)           │
│   app/api/useCases/*                    │
└───────────────┬─────────────────────────┘
                │ depends on (interfaces)
                ▼
┌─────────────────────────────────────────┐
│   Interfaces (Contracts)                │
│   IAsaasCustomerService                 │
│   IAsaasSubscriptionService             │
│   IAsaasOperatorService                 │
└───────────────┬─────────────────────────┘
                │ implemented by
                ▼
┌─────────────────────────────────────────┐
│   Services (Implementation)             │
│   AsaasCustomerService                  │
│   AsaasSubscriptionService              │
│   AsaasOperatorService                  │
└───────────────┬─────────────────────────┘
                │ uses
                ▼
┌─────────────────────────────────────────┐
│   External APIs & Database              │
│   Asaas API + Prisma (PostgreSQL)       │
└─────────────────────────────────────────┘
```

---

## 🎯 AsaasCustomerService

Gerencia clientes (Managers) no Asaas.

### Métodos Disponíveis

#### `createCustomer(data: AsaasCustomer)`
Cria um novo cliente Manager no Asaas.

```typescript
import { AsaasCustomerService } from '@/app/api/services';

const customer = await AsaasCustomerService.createCustomer({
  name: 'João Silva',
  cpfCnpj: '12345678900',
  email: 'joao@example.com',
  phone: '11987654321',
  externalReference: 'profile-uuid-123',
});

// Retorna: { success: true, customerId: 'cus_xxx', data: {...} }
```

#### `getCustomer(customerId: string)`
Busca cliente por ID.

```typescript
const customer = await AsaasCustomerService.getCustomer('cus_xxx');
```

#### `getCustomerByCpfCnpj(cpfCnpj: string)`
Busca cliente por CPF/CNPJ.

```typescript
const customer = await AsaasCustomerService.getCustomerByCpfCnpj('12345678900');
```

#### `updateCustomer(customerId: string, data: Partial<AsaasCustomer>)`
Atualiza dados do cliente.

```typescript
await AsaasCustomerService.updateCustomer('cus_xxx', {
  phone: '11999998888',
  email: 'novoemail@example.com',
});
```

#### `deleteCustomer(customerId: string)`
Deleta um cliente (⚠️ cuidado: remove todas cobranças).

```typescript
await AsaasCustomerService.deleteCustomer('cus_xxx');
```

---

## 💰 AsaasSubscriptionService

Gerencia assinaturas de Managers e Operadores.

### Métodos Disponíveis

#### `createManagerSubscription(data: AsaasSubscription)`
Cria assinatura base do Manager (R$ 59,90/mês).

```typescript
import { AsaasSubscriptionService } from '@/app/api/services';

const subscription = await AsaasSubscriptionService.createManagerSubscription({
  customer: 'cus_xxx',
  billingType: 'CREDIT_CARD',
  cycle: 'MONTHLY',
  description: 'Assinatura Lead Flow - Plano Manager',
  externalReference: 'profile-uuid-123',
});

// Retorna: { success: true, subscriptionId: 'sub_xxx', data: {...} }
```

#### `createOperatorSubscription(data: AsaasSubscription)`
Cria assinatura de Operador (R$ 19,90/mês).

```typescript
const subscription = await AsaasSubscriptionService.createOperatorSubscription({
  customer: 'cus_xxx', // Customer do Manager
  billingType: 'CREDIT_CARD',
  cycle: 'MONTHLY',
  description: 'Operador: Maria Santos',
  externalReference: 'operator-uuid-456',
});
```

#### `getSubscription(subscriptionId: string)`
Busca assinatura por ID.

```typescript
const subscription = await AsaasSubscriptionService.getSubscription('sub_xxx');
```

#### `listSubscriptions(customerId: string, params?)`
Lista todas assinaturas de um cliente.

```typescript
const subscriptions = await AsaasSubscriptionService.listSubscriptions('cus_xxx', {
  status: 'ACTIVE',
  limit: 10,
});
```

#### `updateSubscription(subscriptionId: string, data)`
Atualiza assinatura.

```typescript
await AsaasSubscriptionService.updateSubscription('sub_xxx', {
  nextDueDate: '2025-11-01',
  description: 'Assinatura Atualizada',
});
```

#### `cancelSubscription(subscriptionId: string)`
Cancela assinatura.

```typescript
await AsaasSubscriptionService.cancelSubscription('sub_xxx');
```

#### `reactivateSubscription(subscriptionId: string)`
Reativa assinatura cancelada.

```typescript
await AsaasSubscriptionService.reactivateSubscription('sub_xxx');
```

#### `getSubscriptionPayments(subscriptionId: string)`
Lista cobranças de uma assinatura.

```typescript
const payments = await AsaasSubscriptionService.getSubscriptionPayments('sub_xxx', {
  status: 'PENDING',
  limit: 20,
});
```

#### `updateBillingType(subscriptionId: string, billingType)`
Altera forma de pagamento.

```typescript
await AsaasSubscriptionService.updateBillingType('sub_xxx', 'PIX');
```

---

## 👥 AsaasOperatorService

Gerencia operadores vinculados aos Managers.

### Métodos Disponíveis

#### `addOperator(managerId: string, operatorId: string)`
Adiciona operador ao Manager e cria assinatura (R$ 19,90/mês).

```typescript
import { AsaasOperatorService } from '@/app/api/services';

const result = await AsaasOperatorService.addOperator(
  'manager-uuid-123',
  'operator-uuid-456'
);

// Retorna: {
//   success: true,
//   subscriptionId: 'sub_xxx',
//   operatorId: 'xxx',
//   managerId: 'xxx',
//   value: 19.90
// }
```

**O que acontece:**
1. Valida se Manager existe e tem cliente Asaas
2. Valida se Operador existe e não tem assinatura ativa
3. Cria assinatura de R$ 19,90/mês no Asaas
4. Vincula Operador ao Manager
5. Atualiza contagem de operadores do Manager
6. Muda plano do Manager para `with_operators`

#### `removeOperator(operatorId: string)`
Remove operador e cancela assinatura.

```typescript
const result = await AsaasOperatorService.removeOperator('operator-uuid-456');

// Retorna: {
//   success: true,
//   operatorId: 'xxx',
//   managerId: 'xxx'
// }
```

**O que acontece:**
1. Cancela assinatura no Asaas
2. Remove vínculo com Manager
3. Atualiza status para `canceled`
4. Decrementa contagem de operadores do Manager
5. Se Manager ficar sem operadores, muda plano para `manager_base`

#### `calculateMonthlyBilling(managerId: string)`
Calcula custo mensal total do Manager.

```typescript
const billing = await AsaasOperatorService.calculateMonthlyBilling('manager-uuid-123');

// Retorna: {
//   basePlan: 59.90,
//   operatorCost: 19.90,
//   activeOperators: 3,
//   totalCost: 119.60,
//   breakdown: {
//     manager: 59.90,
//     operators: 59.70
//   }
// }
```

#### `listOperators(managerId: string, includeInactive?)`
Lista operadores de um Manager.

```typescript
const { operators, count } = await AsaasOperatorService.listOperators(
  'manager-uuid-123',
  false // Só ativos
);
```

#### `transferOperator(operatorId: string, newManagerId: string)`
Transfere operador para outro Manager.

```typescript
const result = await AsaasOperatorService.transferOperator(
  'operator-uuid-456',
  'new-manager-uuid-789'
);
```

**O que acontece:**
1. Remove operador do Manager atual
2. Adiciona ao novo Manager
3. Cria nova assinatura no Asaas
4. Atualiza contagens de ambos Managers

#### `suspendOperator(operatorId: string)`
Suspende operador (cancela assinatura mas mantém vínculo).

```typescript
await AsaasOperatorService.suspendOperator('operator-uuid-456');
```

#### `reactivateOperator(operatorId: string)`
Reativa operador suspenso (recria assinatura).

```typescript
await AsaasOperatorService.reactivateOperator('operator-uuid-456');
```

---

## 📊 Exemplo de Fluxo Completo

### 1. Manager se cadastra e cria assinatura

```typescript
// 1. Criar cliente no Asaas
const customer = await AsaasCustomerService.createCustomer({
  name: 'João Silva',
  cpfCnpj: '12345678900',
  email: 'joao@example.com',
  phone: '11987654321',
  externalReference: profileId,
});

// 2. Atualizar Profile com customerId
await prisma.profile.update({
  where: { id: profileId },
  data: { asaasCustomerId: customer.customerId },
});

// 3. Criar assinatura base
const subscription = await AsaasSubscriptionService.createManagerSubscription({
  customer: customer.customerId,
  billingType: 'CREDIT_CARD',
  cycle: 'MONTHLY',
  description: 'Assinatura Lead Flow - Plano Manager',
  externalReference: profileId,
});

// 4. Atualizar Profile com assinatura
await prisma.profile.update({
  where: { id: profileId },
  data: {
    subscriptionId: subscription.subscriptionId,
    subscriptionStatus: 'active',
    subscriptionPlan: 'manager_base',
    subscriptionStartDate: new Date(),
  },
});
```

### 2. Manager adiciona operadores

```typescript
// Adicionar primeiro operador
await AsaasOperatorService.addOperator(managerId, operator1Id);
// Total mensal: R$ 79,80 (59,90 + 19,90)

// Adicionar segundo operador
await AsaasOperatorService.addOperator(managerId, operator2Id);
// Total mensal: R$ 99,70 (59,90 + 39,80)

// Calcular billing total
const billing = await AsaasOperatorService.calculateMonthlyBilling(managerId);
console.log(`Total: R$ ${billing.totalCost}`); // R$ 99,70
```

### 3. Manager remove operador

```typescript
// Remover operador
await AsaasOperatorService.removeOperator(operator1Id);

// Calcular novo total
const billing = await AsaasOperatorService.calculateMonthlyBilling(managerId);
console.log(`Total: R$ ${billing.totalCost}`); // R$ 79,80
```

---

## 🔄 Integração com Webhooks

Os services podem ser usados dentro dos webhook handlers:

```typescript
// app/api/webhooks/asaas/route.ts
import { AsaasOperatorService } from '@/app/api/services';

async function handlePaymentOverdue(payment: any) {
  const profileId = payment.externalReference;
  
  // Atualizar status
  await prisma.profile.update({
    where: { id: profileId },
    data: { subscriptionStatus: 'past_due' },
  });
  
  // Notificar Manager
  // ... enviar email ...
}
```

---

## 🛡️ Tratamento de Erros

Todos os services lançam erros descritivos:

```typescript
try {
  await AsaasOperatorService.addOperator(managerId, operatorId);
} catch (error) {
  console.error('Erro:', error.message);
  // Exemplos de erros:
  // - "Manager não encontrado"
  // - "Manager não possui cliente Asaas"
  // - "Operador já possui assinatura ativa"
  // - "Erro ao criar assinatura"
}
```

---

## 📝 Notas Importantes

1. **Sempre verifique** se o Manager tem `asaasCustomerId` antes de criar assinaturas
2. **Operadores herdam** o método de pagamento do Manager
3. **Cancelamentos** no Asaas são permanentes (use suspensão se precisar reverter)
4. **externalReference** deve sempre ser o UUID do Profile
5. **Valores são fixos**: R$ 59,90 (Manager) e R$ 19,90 (Operador)

---

## 🏗️ Usando com Dependency Injection (SOLID)

### Use Case Example

```typescript
// app/api/useCases/CreateManagerOnboarding.ts
import type { IAsaasCustomerService, IAsaasSubscriptionService } from '@/app/api/services';
import { prisma } from '@/app/api/infra/data/prisma';

export class CreateManagerOnboarding {
  constructor(
    private customerService: IAsaasCustomerService,
    private subscriptionService: IAsaasSubscriptionService
  ) {}

  async execute(profileId: string) {
    // 1. Buscar perfil
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      throw new Error('Profile não encontrado');
    }

    // 2. Criar cliente no Asaas
    const customer = await this.customerService.createCustomer({
      name: profile.fullName,
      cpfCnpj: profile.cpf || '',
      email: profile.email,
      phone: profile.phone || '',
      externalReference: profileId,
    });

    // 3. Atualizar profile com customerId
    await prisma.profile.update({
      where: { id: profileId },
      data: { asaasCustomerId: customer.customerId },
    });

    // 4. Criar assinatura base
    const subscription = await this.subscriptionService.createManagerSubscription({
      customer: customer.customerId,
      billingType: 'CREDIT_CARD',
      cycle: 'MONTHLY',
      description: 'Assinatura Lead Flow - Plano Manager',
      externalReference: profileId,
    });

    // 5. Atualizar profile com assinatura
    await prisma.profile.update({
      where: { id: profileId },
      data: {
        subscriptionId: subscription.subscriptionId,
        subscriptionStatus: 'active',
        subscriptionPlan: 'manager_base',
        subscriptionStartDate: new Date(),
      },
    });

    return {
      success: true,
      customerId: customer.customerId,
      subscriptionId: subscription.subscriptionId,
    };
  }
}
```

### Usando em um API Endpoint

```typescript
// app/api/v1/onboarding/manager/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AsaasCustomerService, AsaasSubscriptionService } from '@/app/api/services';
import { CreateManagerOnboarding } from '@/app/api/useCases/CreateManagerOnboarding';
import { Output } from '@/lib/output';

export async function POST(req: NextRequest) {
  try {
    const { profileId } = await req.json();

    // Injeção de dependência
    const useCase = new CreateManagerOnboarding(
      AsaasCustomerService,
      AsaasSubscriptionService
    );

    const result = await useCase.execute(profileId);

    return NextResponse.json(
      Output.success(result, 'Onboarding completo com sucesso'),
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      Output.error(error.message),
      { status: 400 }
    );
  }
}
```

### Testes Unitários com Mocks

```typescript
// __tests__/useCases/CreateManagerOnboarding.test.ts
import { CreateManagerOnboarding } from '@/app/api/useCases/CreateManagerOnboarding';
import type { IAsaasCustomerService, IAsaasSubscriptionService } from '@/app/api/services';

describe('CreateManagerOnboarding', () => {
  it('deve criar customer e subscription com sucesso', async () => {
    // Mock dos services
    const mockCustomerService: IAsaasCustomerService = {
      createCustomer: jest.fn().mockResolvedValue({
        success: true,
        customerId: 'cus_123',
        data: {},
      }),
      getCustomer: jest.fn(),
      getCustomerByCpfCnpj: jest.fn(),
      listCustomers: jest.fn(),
      updateCustomer: jest.fn(),
      deleteCustomer: jest.fn(),
      restoreCustomer: jest.fn(),
    };

    const mockSubscriptionService: IAsaasSubscriptionService = {
      createManagerSubscription: jest.fn().mockResolvedValue({
        success: true,
        subscriptionId: 'sub_456',
        data: {},
      }),
      createOperatorSubscription: jest.fn(),
      createSubscription: jest.fn(),
      getSubscription: jest.fn(),
      listSubscriptions: jest.fn(),
      updateSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      reactivateSubscription: jest.fn(),
      getSubscriptionPayments: jest.fn(),
      updateNextDueDate: jest.fn(),
      updateBillingType: jest.fn(),
    };

    // Instanciar use case com mocks
    const useCase = new CreateManagerOnboarding(
      mockCustomerService,
      mockSubscriptionService
    );

    // Executar
    const result = await useCase.execute('profile-uuid-123');

    // Assertions
    expect(result.success).toBe(true);
    expect(mockCustomerService.createCustomer).toHaveBeenCalledTimes(1);
    expect(mockSubscriptionService.createManagerSubscription).toHaveBeenCalledTimes(1);
  });
});
```

---

## 🔗 Próximos Passos

- [ ] Implementar endpoints da API que usam esses services
- [ ] Criar webhook handler para processar notificações do Asaas
- [ ] Implementar middleware de verificação de assinatura
- [ ] Criar UI para gerenciamento de billing

---

**Última atualização:** 03/10/2025
