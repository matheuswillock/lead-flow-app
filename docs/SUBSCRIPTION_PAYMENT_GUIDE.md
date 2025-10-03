# Guia de Assinaturas - Lead Flow Platform

## 📋 Visão Geral

Este documento descreve a implementação completa do **sistema de assinaturas** da plataforma Lead Flow usando a API do Asaas.

### 🎯 Modelo de Negócio

O **Lead Flow** é uma plataforma SaaS B2B onde assessores pagam assinaturas mensais para gerenciar seus leads.

**Planos de Assinatura:**
- **Manager (Base):** R$ 59,90/mês - Conta principal com acesso completo
- **Operador (Add-on):** R$ 19,90/mês - Usuário adicional vinculado ao Manager

**Exemplos de Cobrança Mensal:**
| Configuração | Cálculo | Total |
|-------------|---------|-------|
| 1 Manager | R$ 59,90 | **R$ 59,90** |
| 1 Manager + 2 Operadores | R$ 59,90 + (2 × R$ 19,90) | **R$ 99,70** |
| 1 Manager + 5 Operadores | R$ 59,90 + (5 × R$ 19,90) | **R$ 159,40** |

**Métodos de Pagamento:**
- ✅ PIX (instantâneo)
- ✅ Cartão de Crédito (recorrente)
- ✅ Boleto (2-3 dias úteis)

**Gateway de Pagamento:** [Asaas](https://www.asaas.com/)

---

## 📚 Índice

1. [Configuração Inicial](#1-configuração-inicial)
2. [Gestão de Clientes (Managers)](#2-gestão-de-clientes-managers)
3. [Assinaturas Base (Manager)](#3-assinaturas-base-manager)
4. [Assinaturas de Operadores](#4-assinaturas-de-operadores)
5. [Webhooks (Notificações)](#5-webhooks-notificações)
6. [Controle de Acesso](#6-controle-de-acesso)
7. [Dashboard de Billing](#7-dashboard-de-billing)
8. [Fluxos Completos](#8-fluxos-completos)

---

## 🔐 1. Configuração Inicial

### 1.1. Obter Credenciais do Asaas

1. Acesse [Painel Asaas](https://www.asaas.com/)
2. Vá em **Configurações** → **Integrações** → **API**
3. Copie sua **API Key**

**Ambientes:**
- **Sandbox:** Para testes (dados não são reais)
- **Produção:** Transações reais

### 1.2. Configurar Variáveis de Ambiente

```env
# .env.local

# Asaas Payment Gateway
ASAAS_API_KEY=your_api_key_here
ASAAS_API_URL=https://sandbox.asaas.com/api/v3  # Sandbox
# ASAAS_API_URL=https://api.asaas.com/v3        # Produção

# Webhook Secret (para validar notificações)
ASAAS_WEBHOOK_SECRET=your_webhook_secret_here
```

### 1.3. Atualizar lib/asaas.ts

```typescript
// lib/asaas.ts
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

if (!ASAAS_API_KEY) {
  throw new Error('❌ ASAAS_API_KEY não configurada');
}

export const asaasHeaders = {
  'Content-Type': 'application/json',
  'access_token': ASAAS_API_KEY,
};

export const asaasApi = {
  customers: `${ASAAS_API_URL}/customers`,
  subscriptions: `${ASAAS_API_URL}/subscriptions`,
  payments: `${ASAAS_API_URL}/payments`,
  webhooks: `${ASAAS_API_URL}/notifications`,
};

// Helper para fazer requisições ao Asaas
export async function asaasFetch(endpoint: string, options?: RequestInit) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      ...asaasHeaders,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.description || 'Erro na API Asaas');
  }

  return response.json();
}
```

---

## 👤 2. Gestão de Clientes (Managers)

### 2.1. Estrutura de Dados do Cliente

Quando um **Manager se cadastra**, criamos um cliente no Asaas:

```typescript
interface AsaasCustomer {
  name: string;              // Nome completo do Manager
  cpfCnpj: string;          // CPF ou CNPJ (apenas números)
  email: string;            // Email do Manager
  phone?: string;           // Telefone (11987654321)
  mobilePhone?: string;     // Celular
  address?: string;         // Logradouro
  addressNumber?: string;   // Número
  complement?: string;      // Complemento
  province?: string;        // Bairro
  postalCode?: string;      // CEP (apenas números)
  externalReference: string; // ID do Profile no nosso sistema
}
```

### 2.2. Service de Clientes

```typescript
// app/api/services/AsaasCustomerService.ts
import { asaasApi, asaasFetch } from '@/lib/asaas';

export class AsaasCustomerService {
  /**
   * Cria um novo cliente Manager no Asaas
   */
  static async createCustomer(data: AsaasCustomer) {
    try {
      const customer = await asaasFetch(asaasApi.customers, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      return {
        success: true,
        customerId: customer.id,
        data: customer,
      };
    } catch (error: any) {
      console.error('❌ Erro ao criar cliente:', error);
      throw new Error(error.message || 'Erro ao criar cliente no Asaas');
    }
  }

  /**
   * Busca cliente por ID
   */
  static async getCustomer(customerId: string) {
    return await asaasFetch(`${asaasApi.customers}/${customerId}`, {
      method: 'GET',
    });
  }

  /**
   * Busca cliente por CPF/CNPJ
   */
  static async getCustomerByCpfCnpj(cpfCnpj: string) {
    const result = await asaasFetch(
      `${asaasApi.customers}?cpfCnpj=${cpfCnpj}`,
      { method: 'GET' }
    );
    return result.data?.[0] || null;
  }

  /**
   * Atualiza dados do cliente
   */
  static async updateCustomer(customerId: string, data: Partial<AsaasCustomer>) {
    return await asaasFetch(`${asaasApi.customers}/${customerId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}
```

### 2.3. Atualizar Schema do Prisma

Adicione campos de assinatura ao modelo `Profile`:

```prisma
// prisma/schema.prisma

model Profile {
  id             String   @id @unique @default(uuid()) @db.Uuid
  email          String   @unique @db.Text
  supabaseId     String?  @unique @db.Uuid
  fullName       String?  @db.Text
  phone          String?  @db.Text
  role           UserRole @default(manager)
  
  // 💳 Campos de Assinatura
  asaasCustomerId       String?   @db.Text         // ID do cliente no Asaas
  subscriptionId        String?   @db.Text         // ID da assinatura no Asaas
  subscriptionStatus    SubscriptionStatus?        // Status da assinatura
  subscriptionPlan      SubscriptionPlan?          // Plano atual
  operatorCount         Int       @default(0)      // Quantidade de operadores
  subscriptionStartDate DateTime? @db.Timestamptz(6)
  subscriptionEndDate   DateTime? @db.Timestamptz(6)
  trialEndDate          DateTime? @db.Timestamptz(6)
  
  // Relacionamentos
  managerId     String?   @db.Uuid
  manager       Profile?  @relation("ManagerOperators", fields: [managerId], references: [id], onDelete: Cascade)
  operators     Profile[] @relation("ManagerOperators")
  
  createdAt     DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt     DateTime  @updatedAt @db.Timestamptz(6)
  
  // ... outros campos existentes ...
  
  @@map("profiles")
}

enum SubscriptionStatus {
  trial       // Período de teste (7-30 dias)
  active      // Ativa e paga
  past_due    // Pagamento atrasado (ainda com acesso)
  suspended   // Suspensa por falta de pagamento
  canceled    // Cancelada pelo usuário
  
  @@map("subscription_status")
}

enum SubscriptionPlan {
  free_trial      // Trial gratuito
  manager_base    // R$ 59,90 - Somente Manager
  with_operators  // R$ 59,90 + (N × R$ 19,90)
  
  @@map("subscription_plan")
}
```

**Rodar migração:**

```bash
bun prisma migrate dev --name add_subscription_fields
```

### 2.4. API Endpoint - Criar Cliente

```typescript
// app/api/v1/asaas/customers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AsaasCustomerService } from '@/app/api/services/AsaasCustomerService';
import { prisma } from '@/lib/prisma';
import { Output } from '@/lib/output';

/**
 * POST /api/v1/asaas/customers
 * Cria cliente Manager no Asaas
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profileId, name, cpfCnpj, email, phone, mobilePhone, address } = body;

    // Validações
    if (!profileId || !name || !cpfCnpj) {
      return NextResponse.json(
        new Output(false, [], ['Campos obrigatórios: profileId, name, cpfCnpj'], null),
        { status: 400 }
      );
    }

    // Buscar Profile
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      return NextResponse.json(
        new Output(false, [], ['Manager não encontrado'], null),
        { status: 404 }
      );
    }

    // Verificar se já existe cliente
    if (profile.asaasCustomerId) {
      return NextResponse.json(
        new Output(false, [], ['Manager já possui cliente Asaas'], {
          customerId: profile.asaasCustomerId,
        }),
        { status: 400 }
      );
    }

    // Criar cliente no Asaas
    const asaasCustomer = await AsaasCustomerService.createCustomer({
      name,
      cpfCnpj,
      email: email || profile.email,
      phone,
      mobilePhone: mobilePhone || profile.phone,
      externalReference: profileId,
      ...address,
    });

    // Atualizar Profile
    await prisma.profile.update({
      where: { id: profileId },
      data: {
        asaasCustomerId: asaasCustomer.customerId,
      },
    });

    return NextResponse.json(
      new Output(true, ['Cliente criado com sucesso'], [], {
        customerId: asaasCustomer.customerId,
      }),
      { status: 201 }
    );

  } catch (error: any) {
    console.error('❌ Erro ao criar cliente:', error);
    return NextResponse.json(
      new Output(false, [], [error.message || 'Erro ao criar cliente'], null),
      { status: 500 }
    );
  }
}
```

---

## 💰 3. Assinaturas Base (Manager)

### 3.1. Estrutura de Assinatura

```typescript
interface AsaasSubscription {
  customer: string;              // ID do cliente Asaas
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
  value: number;                 // Valor da assinatura (59.90)
  cycle: 'MONTHLY';              // Ciclo de cobrança
  description?: string;          // Descrição da assinatura
  externalReference?: string;    // ID do Profile
  nextDueDate?: string;          // Data da próxima cobrança (YYYY-MM-DD)
  discount?: {
    value: number;               // Desconto em reais
    dueDateLimitDays: number;    // Dias antes do vencimento
  };
  fine?: {
    value: number;               // Multa percentual (%)
  };
  interest?: {
    value: number;               // Juros ao mês (%)
  };
}
```

### 3.2. Service de Assinaturas

```typescript
// app/api/services/AsaasSubscriptionService.ts
import { asaasApi, asaasFetch } from '@/lib/asaas';

export class AsaasSubscriptionService {
  /**
   * Cria assinatura base do Manager (R$ 59,90/mês)
   */
  static async createManagerSubscription(data: AsaasSubscription) {
    try {
      const subscription = await asaasFetch(asaasApi.subscriptions, {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          value: 59.90, // Valor fixo da assinatura base
          cycle: 'MONTHLY',
        }),
      });

      return {
        success: true,
        subscriptionId: subscription.id,
        data: subscription,
      };
    } catch (error: any) {
      console.error('❌ Erro ao criar assinatura:', error);
      throw new Error(error.message || 'Erro ao criar assinatura');
    }
  }

  /**
   * Busca assinatura por ID
   */
  static async getSubscription(subscriptionId: string) {
    return await asaasFetch(`${asaasApi.subscriptions}/${subscriptionId}`, {
      method: 'GET',
    });
  }

  /**
   * Lista assinaturas de um cliente
   */
  static async listSubscriptions(customerId: string) {
    const result = await asaasFetch(
      `${asaasApi.subscriptions}?customer=${customerId}`,
      { method: 'GET' }
    );
    return result.data || [];
  }

  /**
   * Atualiza assinatura (alterar forma de pagamento, valor, etc)
   */
  static async updateSubscription(
    subscriptionId: string,
    data: Partial<AsaasSubscription>
  ) {
    return await asaasFetch(`${asaasApi.subscriptions}/${subscriptionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Cancela assinatura
   */
  static async cancelSubscription(subscriptionId: string) {
    return await asaasFetch(`${asaasApi.subscriptions}/${subscriptionId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Reativa assinatura cancelada
   */
  static async reactivateSubscription(subscriptionId: string) {
    return await asaasFetch(
      `${asaasApi.subscriptions}/${subscriptionId}/restore`,
      { method: 'POST' }
    );
  }
}
```

### 3.3. API Endpoint - Criar Assinatura Manager

```typescript
// app/api/v1/subscriptions/manager/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AsaasSubscriptionService } from '@/app/api/services/AsaasSubscriptionService';
import { prisma } from '@/lib/prisma';
import { Output } from '@/lib/output';

/**
 * POST /api/v1/subscriptions/manager
 * Cria assinatura base do Manager (R$ 59,90/mês)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profileId, billingType, nextDueDate } = body;

    // Validações
    if (!profileId || !billingType) {
      return NextResponse.json(
        new Output(false, [], ['Campos obrigatórios: profileId, billingType'], null),
        { status: 400 }
      );
    }

    // Buscar Profile
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      return NextResponse.json(
        new Output(false, [], ['Manager não encontrado'], null),
        { status: 404 }
      );
    }

    if (!profile.asaasCustomerId) {
      return NextResponse.json(
        new Output(false, [], ['Manager não possui cliente Asaas cadastrado'], null),
        { status: 400 }
      );
    }

    if (profile.subscriptionId) {
      return NextResponse.json(
        new Output(false, [], ['Manager já possui assinatura ativa'], {
          subscriptionId: profile.subscriptionId,
        }),
        { status: 400 }
      );
    }

    // Criar assinatura no Asaas
    const subscription = await AsaasSubscriptionService.createManagerSubscription({
      customer: profile.asaasCustomerId,
      billingType,
      value: 59.90,
      cycle: 'MONTHLY',
      description: 'Assinatura Lead Flow - Plano Manager',
      externalReference: profileId,
      nextDueDate: nextDueDate || new Date().toISOString().split('T')[0],
    });

    // Atualizar Profile
    await prisma.profile.update({
      where: { id: profileId },
      data: {
        subscriptionId: subscription.subscriptionId,
        subscriptionStatus: 'active',
        subscriptionPlan: 'manager_base',
        subscriptionStartDate: new Date(),
      },
    });

    return NextResponse.json(
      new Output(true, ['Assinatura criada com sucesso'], [], {
        subscriptionId: subscription.subscriptionId,
        value: 59.90,
        billingType,
      }),
      { status: 201 }
    );

  } catch (error: any) {
    console.error('❌ Erro ao criar assinatura:', error);
    return NextResponse.json(
      new Output(false, [], [error.message || 'Erro ao criar assinatura'], null),
      { status: 500 }
    );
  }
}
```

### 3.4. Use Case - Criar Assinatura

```typescript
// app/api/useCases/subscriptions/CreateManagerSubscription.ts
import { AsaasCustomerService } from '@/app/api/services/AsaasCustomerService';
import { AsaasSubscriptionService } from '@/app/api/services/AsaasSubscriptionService';
import { prisma } from '@/lib/prisma';

interface CreateManagerSubscriptionInput {
  profileId: string;
  name: string;
  cpfCnpj: string;
  email: string;
  phone?: string;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
}

export class CreateManagerSubscription {
  async execute(input: CreateManagerSubscriptionInput) {
    const { profileId, name, cpfCnpj, email, phone, billingType } = input;

    // 1. Buscar Profile
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      throw new Error('Manager não encontrado');
    }

    // 2. Criar cliente no Asaas (se não existir)
    let customerId = profile.asaasCustomerId;
    
    if (!customerId) {
      const customer = await AsaasCustomerService.createCustomer({
        name,
        cpfCnpj,
        email,
        phone,
        externalReference: profileId,
      });
      
      customerId = customer.customerId;
      
      // Atualizar Profile com customerId
      await prisma.profile.update({
        where: { id: profileId },
        data: { asaasCustomerId: customerId },
      });
    }

    // 3. Criar assinatura
    const subscription = await AsaasSubscriptionService.createManagerSubscription({
      customer: customerId,
      billingType,
      value: 59.90,
      cycle: 'MONTHLY',
      description: 'Assinatura Lead Flow - Plano Manager',
      externalReference: profileId,
    });

    // 4. Atualizar Profile
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
      subscriptionId: subscription.subscriptionId,
      customerId,
      value: 59.90,
    };
  }
}
```

---

## 👥 4. Assinaturas de Operadores

### 4.1. Lógica de Operadores

Quando um Manager adiciona um Operador:
1. Cria-se uma **nova assinatura** de R$ 19,90/mês
2. Operador é vinculado ao Manager (`managerId`)
3. Billing total = R$ 59,90 (base) + (N × R$ 19,90)

### 4.2. Service de Operadores

```typescript
// app/api/services/AsaasOperatorService.ts
import { AsaasSubscriptionService } from './AsaasSubscriptionService';
import { prisma } from '@/lib/prisma';

export class AsaasOperatorService {
  /**
   * Adiciona operador e cria assinatura (R$ 19,90/mês)
   */
  static async addOperator(managerId: string, operatorId: string) {
    try {
      // 1. Buscar Manager
      const manager = await prisma.profile.findUnique({
        where: { id: managerId },
      });

      if (!manager || !manager.asaasCustomerId) {
        throw new Error('Manager não possui cliente Asaas');
      }

      // 2. Buscar Operador
      const operator = await prisma.profile.findUnique({
        where: { id: operatorId },
      });

      if (!operator) {
        throw new Error('Operador não encontrado');
      }

      // 3. Criar assinatura do operador no Asaas
      const subscription = await AsaasSubscriptionService.createManagerSubscription({
        customer: manager.asaasCustomerId,
        billingType: 'CREDIT_CARD', // Mesmo método do Manager
        value: 19.90,
        cycle: 'MONTHLY',
        description: `Operador: ${operator.fullName || operator.email}`,
        externalReference: operatorId,
      });

      // 4. Atualizar Operador
      await prisma.profile.update({
        where: { id: operatorId },
        data: {
          subscriptionId: subscription.subscriptionId,
          subscriptionStatus: 'active',
          managerId: managerId,
        },
      });

      // 5. Atualizar contagem de operadores do Manager
      await prisma.profile.update({
        where: { id: managerId },
        data: {
          operatorCount: { increment: 1 },
          subscriptionPlan: 'with_operators',
        },
      });

      return {
        success: true,
        subscriptionId: subscription.subscriptionId,
        operatorId,
        value: 19.90,
      };

    } catch (error: any) {
      console.error('❌ Erro ao adicionar operador:', error);
      throw error;
    }
  }

  /**
   * Remove operador e cancela assinatura
   */
  static async removeOperator(operatorId: string) {
    try {
      // 1. Buscar Operador
      const operator = await prisma.profile.findUnique({
        where: { id: operatorId },
        include: { manager: true },
      });

      if (!operator || !operator.subscriptionId) {
        throw new Error('Operador não possui assinatura');
      }

      // 2. Cancelar assinatura no Asaas
      await AsaasSubscriptionService.cancelSubscription(operator.subscriptionId);

      // 3. Atualizar Operador
      await prisma.profile.update({
        where: { id: operatorId },
        data: {
          subscriptionId: null,
          subscriptionStatus: 'canceled',
          managerId: null,
        },
      });

      // 4. Atualizar contagem do Manager
      if (operator.managerId) {
        const manager = await prisma.profile.findUnique({
          where: { id: operator.managerId },
          include: { operators: true },
        });

        await prisma.profile.update({
          where: { id: operator.managerId },
          data: {
            operatorCount: { decrement: 1 },
            subscriptionPlan: manager?.operators.length === 1 ? 'manager_base' : 'with_operators',
          },
        });
      }

      return {
        success: true,
        operatorId,
        message: 'Operador removido e assinatura cancelada',
      };

    } catch (error: any) {
      console.error('❌ Erro ao remover operador:', error);
      throw error;
    }
  }

  /**
   * Calcula billing total do Manager
   */
  static async calculateMonthlyBilling(managerId: string) {
    const manager = await prisma.profile.findUnique({
      where: { id: managerId },
      include: {
        operators: {
          where: {
            subscriptionStatus: 'active',
          },
        },
      },
    });

    if (!manager) {
      throw new Error('Manager não encontrado');
    }

    const basePlan = 59.90;
    const operatorCost = 19.90;
    const activeOperators = manager.operators.length;
    const totalCost = basePlan + (activeOperators * operatorCost);

    return {
      basePlan,
      operatorCost,
      activeOperators,
      totalCost,
      breakdown: {
        manager: basePlan,
        operators: activeOperators * operatorCost,
      },
    };
  }
}
```

### 4.3. API Endpoint - Gerenciar Operadores

```typescript
// app/api/v1/subscriptions/operators/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AsaasOperatorService } from '@/app/api/services/AsaasOperatorService';
import { Output } from '@/lib/output';

/**
 * POST /api/v1/subscriptions/operators
 * Adiciona operador e cria assinatura
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { managerId, operatorId } = body;

    if (!managerId || !operatorId) {
      return NextResponse.json(
        new Output(false, [], ['Campos obrigatórios: managerId, operatorId'], null),
        { status: 400 }
      );
    }

    const result = await AsaasOperatorService.addOperator(managerId, operatorId);

    return NextResponse.json(
      new Output(true, ['Operador adicionado com sucesso'], [], result),
      { status: 201 }
    );

  } catch (error: any) {
    console.error('❌ Erro ao adicionar operador:', error);
    return NextResponse.json(
      new Output(false, [], [error.message], null),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/subscriptions/operators/[operatorId]
 * Remove operador e cancela assinatura
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { operatorId: string } }
) {
  try {
    const result = await AsaasOperatorService.removeOperator(params.operatorId);

    return NextResponse.json(
      new Output(true, ['Operador removido com sucesso'], [], result),
      { status: 200 }
    );

  } catch (error: any) {
    console.error('❌ Erro ao remover operador:', error);
    return NextResponse.json(
      new Output(false, [], [error.message], null),
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/subscriptions/operators/billing/[managerId]
 * Calcula billing total do Manager
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { managerId: string } }
) {
  try {
    const billing = await AsaasOperatorService.calculateMonthlyBilling(params.managerId);

    return NextResponse.json(
      new Output(true, [], [], billing),
      { status: 200 }
    );

  } catch (error: any) {
    return NextResponse.json(
      new Output(false, [], [error.message], null),
      { status: 500 }
    );
  }
}
```

---

## 🔔 5. Webhooks (Notificações)

### 5.1. Configurar Webhooks no Asaas

1. Acesse o [Painel Asaas](https://www.asaas.com/)
2. Vá em **Configurações** → **Webhooks**
3. Adicione a URL: `https://seudominio.com/api/webhooks/asaas`
4. Selecione eventos:
   - `PAYMENT_RECEIVED` - Pagamento confirmado
   - `PAYMENT_CONFIRMED` - Pagamento aprovado
   - `PAYMENT_OVERDUE` - Pagamento vencido
   - `PAYMENT_DELETED` - Cobrança cancelada
   - `PAYMENT_REFUNDED` - Pagamento estornado

### 5.2. Estrutura de Webhook

```typescript
interface AsaasWebhookEvent {
  event: 
    | 'PAYMENT_CREATED'
    | 'PAYMENT_UPDATED'
    | 'PAYMENT_CONFIRMED'
    | 'PAYMENT_RECEIVED'
    | 'PAYMENT_OVERDUE'
    | 'PAYMENT_DELETED'
    | 'PAYMENT_REFUNDED';
  payment: {
    id: string;
    customer: string;
    subscription: string;
    value: number;
    netValue: number;
    status: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE';
    billingType: string;
    dueDate: string;
    externalReference?: string;
  };
}
```

### 5.3. Webhook Handler

```typescript
// app/api/webhooks/asaas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * POST /api/webhooks/asaas
 * Recebe notificações do Asaas
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const signature = request.headers.get('asaas-signature');

    // 1. Validar assinatura (segurança)
    if (!validateSignature(body, signature)) {
      console.error('❌ Assinatura inválida');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const { event, payment } = body;

    console.log(`📩 Webhook recebido: ${event}`, payment);

    // 2. Processar evento
    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        await handlePaymentConfirmed(payment);
        break;

      case 'PAYMENT_OVERDUE':
        await handlePaymentOverdue(payment);
        break;

      case 'PAYMENT_DELETED':
        await handlePaymentDeleted(payment);
        break;

      case 'PAYMENT_REFUNDED':
        await handlePaymentRefunded(payment);
        break;

      default:
        console.log(`ℹ️ Evento não tratado: ${event}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Erro ao processar webhook:', error);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}

/**
 * Valida assinatura do webhook
 */
function validateSignature(body: any, signature: string | null): boolean {
  if (!signature) return false;

  const webhookSecret = process.env.ASAAS_WEBHOOK_SECRET;
  if (!webhookSecret) return true; // Desenvolvimento sem secret

  const hash = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(body))
    .digest('hex');

  return hash === signature;
}

/**
 * Pagamento confirmado - Ativar assinatura
 */
async function handlePaymentConfirmed(payment: any) {
  const profileId = payment.externalReference;

  if (!profileId) {
    console.error('❌ externalReference não encontrado');
    return;
  }

  // Atualizar status da assinatura
  await prisma.profile.update({
    where: { id: profileId },
    data: {
      subscriptionStatus: 'active',
    },
  });

  console.log(`✅ Assinatura ativada: ${profileId}`);
}

/**
 * Pagamento vencido - Marcar como atrasado
 */
async function handlePaymentOverdue(payment: any) {
  const profileId = payment.externalReference;

  if (!profileId) return;

  await prisma.profile.update({
    where: { id: profileId },
    data: {
      subscriptionStatus: 'past_due',
    },
  });

  console.log(`⚠️ Pagamento atrasado: ${profileId}`);
}

/**
 * Pagamento cancelado - Suspender assinatura
 */
async function handlePaymentDeleted(payment: any) {
  const profileId = payment.externalReference;

  if (!profileId) return;

  await prisma.profile.update({
    where: { id: profileId },
    data: {
      subscriptionStatus: 'suspended',
    },
  });

  console.log(`🚫 Assinatura suspensa: ${profileId}`);
}

/**
 * Pagamento estornado
 */
async function handlePaymentRefunded(payment: any) {
  const profileId = payment.externalReference;

  if (!profileId) return;

  await prisma.profile.update({
    where: { id: profileId },
    data: {
      subscriptionStatus: 'canceled',
    },
  });

  console.log(`💰 Pagamento estornado: ${profileId}`);
}
```

---

## 🔒 6. Controle de Acesso

### 6.1. Middleware de Verificação

```typescript
// middleware/checkSubscription.ts
import { prisma } from '@/lib/prisma';

export async function checkSubscription(profileId: string) {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: {
      subscriptionStatus: true,
      subscriptionPlan: true,
      trialEndDate: true,
    },
  });

  if (!profile) {
    return {
      hasAccess: false,
      reason: 'profile_not_found',
      message: 'Usuário não encontrado',
    };
  }

  // 1. Trial ativo
  if (profile.trialEndDate && new Date() < new Date(profile.trialEndDate)) {
    return {
      hasAccess: true,
      reason: 'trial',
      message: 'Trial ativo',
    };
  }

  // 2. Assinatura ativa
  if (profile.subscriptionStatus === 'active') {
    return {
      hasAccess: true,
      reason: 'active_subscription',
      message: 'Assinatura ativa',
    };
  }

  // 3. Pagamento atrasado (ainda com acesso por período de carência)
  if (profile.subscriptionStatus === 'past_due') {
    return {
      hasAccess: true,
      reason: 'past_due_grace_period',
      message: 'Pagamento pendente - período de carência',
      warning: true,
    };
  }

  // 4. Sem acesso
  return {
    hasAccess: false,
    reason: profile.subscriptionStatus || 'no_subscription',
    message: 'Assinatura necessária',
  };
}
```

### 6.2. Usar no Middleware Next.js

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { checkSubscription } from './middleware/checkSubscription';

export async function middleware(request: NextRequest) {
  // ... autenticação Supabase ...

  // Verificar assinatura em rotas protegidas
  if (request.nextUrl.pathname.startsWith('/app')) {
    const profileId = 'USER_PROFILE_ID'; // Obter do contexto

    const access = await checkSubscription(profileId);

    if (!access.hasAccess) {
      return NextResponse.redirect(new URL('/subscription/required', request.url));
    }

    if (access.warning) {
      // Adicionar header de aviso
      const response = NextResponse.next();
      response.headers.set('X-Subscription-Warning', access.message);
      return response;
    }
  }

  return NextResponse.next();
}
```

### 6.3. Página de Assinatura Necessária

```typescript
// app/subscription/required/page.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

export default function SubscriptionRequired() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>🔒 Assinatura Necessária</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Sua assinatura está inativa. Para continuar usando o Lead Flow,
            por favor ative ou renove sua assinatura.
          </p>

          <div className="space-y-2">
            <p className="font-semibold">Planos disponíveis:</p>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>Manager: R$ 59,90/mês</li>
              <li>Operador adicional: R$ 19,90/mês</li>
            </ul>
          </div>

          <Button
            onClick={() => router.push('/subscription/plans')}
            className="w-full"
          >
            Ver Planos
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 📊 7. Dashboard de Billing

### 7.1. Componente de Billing

```typescript
// components/billing/BillingDashboard.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface BillingData {
  basePlan: number;
  operatorCost: number;
  activeOperators: number;
  totalCost: number;
  subscriptionStatus: string;
  nextBillingDate?: string;
}

export function BillingDashboard({ managerId }: { managerId: string }) {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBilling();
  }, [managerId]);

  const fetchBilling = async () => {
    try {
      const response = await fetch(`/api/v1/subscriptions/operators/billing/${managerId}`);
      const result = await response.json();
      
      if (result.success) {
        setBilling(result.data);
      }
    } catch (error) {
      console.error('Erro ao carregar billing:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!billing) {
    return <div>Erro ao carregar dados de cobrança</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Sua Assinatura
            <Badge variant={
              billing.subscriptionStatus === 'active' ? 'default' : 'destructive'
            }>
              {billing.subscriptionStatus === 'active' ? 'Ativa' : 'Inativa'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Resumo de custos */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Plano Manager (base)</span>
              <span className="font-semibold">
                R$ {billing.basePlan.toFixed(2)}
              </span>
            </div>

            {billing.activeOperators > 0 && (
              <div className="flex justify-between text-sm">
                <span>
                  {billing.activeOperators} Operador{billing.activeOperators > 1 ? 'es' : ''}
                  {' × '}R$ {billing.operatorCost.toFixed(2)}
                </span>
                <span className="font-semibold">
                  R$ {(billing.activeOperators * billing.operatorCost).toFixed(2)}
                </span>
              </div>
            )}

            <div className="border-t pt-2 flex justify-between font-bold text-lg">
              <span>Total Mensal</span>
              <span>R$ {billing.totalCost.toFixed(2)}</span>
            </div>
          </div>

          {billing.nextBillingDate && (
            <div className="text-sm text-muted-foreground">
              Próxima cobrança: {new Date(billing.nextBillingDate).toLocaleDateString('pt-BR')}
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1">
              Alterar Forma de Pagamento
            </Button>
            <Button variant="outline" className="flex-1">
              Ver Histórico
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 7.2. Página de Billing

```typescript
// app/[supabaseId]/billing/page.tsx
import { BillingDashboard } from '@/components/billing/BillingDashboard';
import { getServerSession } from '@/lib/auth';

export default async function BillingPage() {
  const session = await getServerSession();
  const managerId = session?.user?.profileId;

  if (!managerId) {
    return <div>Erro: Usuário não autenticado</div>;
  }

  return (
    <div className="container max-w-4xl py-8">
      <h1 className="text-3xl font-bold mb-6">Billing & Assinatura</h1>
      
      <BillingDashboard managerId={managerId} />
    </div>
  );
}
```

---

## 🔄 8. Fluxos Completos

### 8.1. Fluxo: Novo Manager se Cadastra

```
1. Manager cria conta no Lead Flow
   ↓
2. Sistema oferece período trial (7-30 dias)
   ↓
3. Manager usa plataforma gratuitamente
   ↓
4. Ao final do trial, solicita cadastro de pagamento
   ↓
5. Manager informa dados (CPF/CNPJ, forma de pagamento)
   ↓
6. Sistema cria cliente no Asaas
   ↓
7. Sistema cria assinatura base (R$ 59,90/mês)
   ↓
8. Primeira cobrança é processada
   ↓
9. Webhook confirma pagamento
   ↓
10. Assinatura ativada - acesso total liberado
```

**Código completo:**

```typescript
// app/api/useCases/onboarding/CompleteManagerOnboarding.ts
export class CompleteManagerOnboarding {
  async execute(input: {
    profileId: string;
    name: string;
    cpfCnpj: string;
    email: string;
    phone: string;
    billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
  }) {
    // 1. Criar cliente no Asaas
    const customer = await AsaasCustomerService.createCustomer({
      name: input.name,
      cpfCnpj: input.cpfCnpj,
      email: input.email,
      phone: input.phone,
      externalReference: input.profileId,
    });

    // 2. Atualizar Profile com customerId
    await prisma.profile.update({
      where: { id: input.profileId },
      data: {
        asaasCustomerId: customer.customerId,
      },
    });

    // 3. Criar assinatura base
    const subscription = await AsaasSubscriptionService.createManagerSubscription({
      customer: customer.customerId,
      billingType: input.billingType,
      value: 59.90,
      cycle: 'MONTHLY',
      description: 'Assinatura Lead Flow - Plano Manager',
      externalReference: input.profileId,
    });

    // 4. Atualizar Profile com assinatura
    await prisma.profile.update({
      where: { id: input.profileId },
      data: {
        subscriptionId: subscription.subscriptionId,
        subscriptionStatus: 'active',
        subscriptionPlan: 'manager_base',
        subscriptionStartDate: new Date(),
        trialEndDate: null, // Finalizar trial
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

### 8.2. Fluxo: Manager Adiciona Operador

```
1. Manager acessa área de gestão de usuários
   ↓
2. Clica em "Adicionar Operador"
   ↓
3. Preenche dados do operador
   ↓
4. Sistema cria perfil do operador
   ↓
5. Sistema cria assinatura adicional (R$ 19,90/mês)
   ↓
6. Vincula operador ao Manager (managerId)
   ↓
7. Atualiza contagem de operadores
   ↓
8. Próxima cobrança incluirá R$ 19,90 adicional
```

### 8.3. Fluxo: Pagamento Atrasado

```
1. Data de vencimento passa
   ↓
2. Asaas tenta cobrar automaticamente
   ↓
3. Se falha, envia webhook PAYMENT_OVERDUE
   ↓
4. Sistema marca assinatura como 'past_due'
   ↓
5. Manager recebe notificação por email
   ↓
6. Período de carência de 7 dias (ainda com acesso)
   ↓
7. Se não pagar em 7 dias:
   - Status muda para 'suspended'
   - Acesso bloqueado
   - Redirecionado para página de pagamento
   ↓
8. Quando pagar:
   - Webhook PAYMENT_CONFIRMED
   - Status volta para 'active'
   - Acesso liberado
```

---

## 📝 Checklist de Implementação

### Configuração Base
- [ ] Criar conta no Asaas
- [ ] Obter API Key (Sandbox e Produção)
- [ ] Configurar variáveis de ambiente
- [ ] Atualizar `lib/asaas.ts`

### Database
- [ ] Adicionar campos de assinatura ao modelo Profile
- [ ] Criar enums SubscriptionStatus e SubscriptionPlan
- [ ] Rodar migração do Prisma

### Services
- [ ] Criar AsaasCustomerService
- [ ] Criar AsaasSubscriptionService
- [ ] Criar AsaasOperatorService

### API Endpoints
- [ ] POST /api/v1/asaas/customers (criar cliente)
- [ ] POST /api/v1/subscriptions/manager (criar assinatura base)
- [ ] POST /api/v1/subscriptions/operators (adicionar operador)
- [ ] DELETE /api/v1/subscriptions/operators/[id] (remover operador)
- [ ] GET /api/v1/subscriptions/operators/billing/[managerId] (calcular billing)

### Webhooks
- [ ] Criar endpoint POST /api/webhooks/asaas
- [ ] Implementar validação de assinatura
- [ ] Handlers para eventos:
  - [ ] PAYMENT_CONFIRMED
  - [ ] PAYMENT_OVERDUE
  - [ ] PAYMENT_DELETED
  - [ ] PAYMENT_REFUNDED
- [ ] Configurar URL no painel Asaas

### Controle de Acesso
- [ ] Criar middleware checkSubscription
- [ ] Integrar com middleware.ts
- [ ] Criar página /subscription/required
- [ ] Criar página /subscription/plans

### UI/UX
- [ ] Componente BillingDashboard
- [ ] Página de billing /[supabaseId]/billing
- [ ] Botões adicionar/remover operadores
- [ ] Exibir status de assinatura
- [ ] Alertas de pagamento pendente

### Testes
- [ ] Testar criação de cliente
- [ ] Testar criação de assinatura
- [ ] Testar adição de operador
- [ ] Testar remoção de operador
- [ ] Testar webhooks (usar Sandbox)
- [ ] Testar controle de acesso
- [ ] Testar cálculo de billing

### Produção
- [ ] Trocar para API Key de produção
- [ ] Atualizar ASAAS_API_URL para produção
- [ ] Configurar webhook em produção
- [ ] Testar fluxo completo em produção

---

## 🔗 Links Úteis

- [Documentação Asaas](https://docs.asaas.com/)
- [API Reference](https://docs.asaas.com/reference)
- [Criar Cliente](https://docs.asaas.com/reference/criar-novo-cliente)
- [Criar Assinatura](https://docs.asaas.com/reference/criar-nova-assinatura)
- [Webhooks](https://docs.asaas.com/docs/webhooks)

---

## 🎯 Próximos Passos

1. **Implementar trial gratuito**
   - 7 ou 30 dias de uso gratuito
   - Notificações antes do fim do trial

2. **Sistema de notificações**
   - Email quando pagamento é confirmado
   - Email quando pagamento está atrasado
   - Email quando assinatura é suspensa

3. **Relatórios financeiros**
   - Histórico de pagamentos
   - Relatório mensal de custos
   - Projeção de custos futuros

4. **Upgrades e downgrades**
   - Mudar forma de pagamento
   - Adicionar/remover operadores em lote
   - Cancelar assinatura (com feedback)

---

**Documento criado em:** 03/10/2025  
**Última atualização:** 03/10/2025  
**Versão:** 1.0.0
