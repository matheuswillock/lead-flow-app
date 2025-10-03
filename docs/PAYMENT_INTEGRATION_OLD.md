# Integração de Pagamentos - Lead Flow Platform

## Visão Geral

Este documento descreve a implementação completa do sistema de **monetização da plataforma Lead Flow** usando a API do Asaas.

### 🎯 Modelo de Negócio

O **Lead Flow** é uma plataforma SaaS para assessores gerenciarem seus leads. A receita vem de:

**📋 Planos de Assinatura:**
- **Assinatura Base:** R$ 59,90/mês (Manager)
- **Operador Adicional:** R$ 19,90/mês por operador

**💡 Exemplo de Cobrança:**
- Manager (1 usuário): R$ 59,90/mês
- Manager + 2 Operadores: R$ 59,90 + (2 × R$ 19,90) = R$ 99,70/mês
- Manager + 5 Operadores: R$ 59,90 + (5 × R$ 19,90) = R$ 159,40/mês

### 💳 Meios de Pagamento Suportados

- ✅ **PIX** - Pagamento instantâneo
- ✅ **Cartão de Crédito** - Parcelamento e recorrência
- ✅ **Cartão de Débito** - Pagamento único
- ✅ **Assinaturas/Recorrência** - Cobranças automáticas mensais

---

## 📚 Documentação de Referência

- [Visão Geral Asaas](https://docs.asaas.com/docs/visao-geral)
- [API Reference](https://docs.asaas.com/reference/api-reference)
- [Autenticação](https://docs.asaas.com/docs/autenticacao)
- [Clientes](https://docs.asaas.com/reference/criar-novo-cliente)
- [Cobranças](https://docs.asaas.com/reference/criar-nova-cobranca)
- [Assinaturas](https://docs.asaas.com/reference/criar-nova-assinatura)

---

## 🔐 1. Configuração Inicial

### 1.1. Obter Credenciais

1. Acesse o [Painel Asaas](https://www.asaas.com/)
2. Vá em **Configurações** → **Integrações** → **API**
3. Copie sua **API Key**

**Ambientes:**
- **Sandbox (Homologação):** `$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6OjAwMDAwMDAwMDAwMDAwNDU5OTk6OiRhYWNoXzg2NzJjMGQyLWRjNGEtNDc2Yy04NzE0LTA4NmZjMDExM2Y0Zg==`
- **Produção:** Sua chave real

### 1.2. Configurar Variáveis de Ambiente

Adicione no arquivo `.env.local`:

```env
# Asaas Payment Gateway
ASAAS_API_KEY=your_api_key_here
ASAAS_API_URL=https://sandbox.asaas.com/api/v3  # Sandbox
# ASAAS_API_URL=https://api.asaas.com/v3  # Produção

# Webhook (opcional)
ASAAS_WEBHOOK_SECRET=your_webhook_secret
```

### 1.3. Atualizar lib/asaas.ts

Já existe um arquivo base em `lib/asaas.ts`. Vamos expandir:

```typescript
// lib/asaas.ts
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

if (!ASAAS_API_KEY) {
  throw new Error('ASAAS_API_KEY não configurada');
}

export const asaasHeaders = {
  'Content-Type': 'application/json',
  'access_token': ASAAS_API_KEY,
};

export const asaasApi = {
  customers: `${ASAAS_API_URL}/customers`,
  payments: `${ASAAS_API_URL}/payments`,
  subscriptions: `${ASAAS_API_URL}/subscriptions`,
  paymentLinks: `${ASAAS_API_URL}/paymentLinks`,
};
```

---

## 👤 2. Gestão de Clientes (Usuários da Plataforma)

### 2.1. Criar Cliente no Asaas

Quando um **Manager se cadastra na plataforma**, devemos criar um cliente no Asaas para gerenciar sua assinatura.

#### Estrutura de Dados do Cliente

```typescript
interface AsaasCustomer {
  name: string;                    // Nome completo do Manager
  cpfCnpj: string;                // CPF ou CNPJ (apenas números)
  email: string;                  // Email do Manager
  phone?: string;                 // Telefone (formato: 1234567890)
  mobilePhone?: string;           // Celular (formato: 11987654321)
  address?: string;               // Logradouro
  addressNumber?: string;         // Número
  complement?: string;            // Complemento
  province?: string;              // Bairro
  postalCode?: string;            // CEP (apenas números)
  externalReference?: string;     // ID do Profile (Manager) no nosso sistema
  notificationDisabled?: boolean; // Desabilitar notificações
  additionalEmails?: string;      // Emails adicionais (separados por ,)
  observations?: string;          // Observações internas
}
```

#### Implementação - Create Customer

```typescript
// app/api/services/AsaasCustomerService.ts
import { asaasApi, asaasHeaders } from '@/lib/asaas';

export class AsaasCustomerService {
  /**
   * Cria um novo cliente (Manager) no Asaas
   */
  static async createCustomer(data: AsaasCustomer) {
    try {
      const response = await fetch(asaasApi.customers, {
        method: 'POST',
        headers: asaasHeaders,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.errors?.[0]?.description || 'Erro ao criar cliente');
      }

      const customer = await response.json();
      return {
        success: true,
        customerId: customer.id,
        data: customer,
      };
    } catch (error) {
      console.error('Erro ao criar cliente Asaas:', error);
      throw error;
    }
  }

  /**
   * Busca cliente por ID
   */
  static async getCustomer(customerId: string) {
    const response = await fetch(`${asaasApi.customers}/${customerId}`, {
      method: 'GET',
      headers: asaasHeaders,
    });

    if (!response.ok) {
      throw new Error('Cliente não encontrado');
    }

    return await response.json();
  }

  /**
   * Busca cliente por CPF/CNPJ
   */
  static async getCustomerByCpfCnpj(cpfCnpj: string) {
    const response = await fetch(`${asaasApi.customers}?cpfCnpj=${cpfCnpj}`, {
      method: 'GET',
      headers: asaasHeaders,
    });

    const result = await response.json();
    return result.data?.[0] || null;
  }

  /**
   * Atualiza dados do cliente
   */
  static async updateCustomer(customerId: string, data: Partial<AsaasCustomer>) {
    const response = await fetch(`${asaasApi.customers}/${customerId}`, {
      method: 'PUT',
      headers: asaasHeaders,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors?.[0]?.description || 'Erro ao atualizar cliente');
    }

    return await response.json();
  }
}
```

### 2.2. Integrar com Profile (Manager)

Adicionar campo `asaasCustomerId` ao modelo Profile:

```prisma
// prisma/schema.prisma
model Profile {
  id             String   @id @unique @default(uuid()) @db.Uuid
  email          String   @unique @db.Text
  supabaseId     String?  @unique @db.Uuid
  fullName       String?  @db.Text
  phone          String?  @db.Text
  role           UserRole @default(manager)
  
  // Assinatura e Pagamento
  asaasCustomerId      String?   @db.Text        // ID do cliente no Asaas
  subscriptionStatus   SubscriptionStatus?       // Status da assinatura
  subscriptionId       String?   @db.Text        // ID da assinatura no Asaas
  subscriptionPlan     SubscriptionPlan?         // Plano atual
  operatorCount        Int       @default(0)     // Quantidade de operadores
  subscriptionStartDate DateTime? @db.Timestamptz(6)
  subscriptionEndDate  DateTime? @db.Timestamptz(6)
  trialEndDate        DateTime? @db.Timestamptz(6)  // Data fim do trial
  
  // ... resto do modelo ...
}

enum SubscriptionStatus {
  trial           // Período de teste
  active          // Ativa e paga
  past_due        // Pagamento atrasado
  canceled        // Cancelada
  suspended       // Suspensa por falta de pagamento
}

enum SubscriptionPlan {
  free_trial      // Trial gratuito
  manager_only    // R$ 59,90 - Somente Manager
  with_operators  // R$ 59,90 + (N × R$ 19,90)
}
```

Rodar migração:

```bash
bun prisma migrate dev --name add_subscription_fields
```

---

## 💳 3. Cobranças (Pagamentos Únicos)

### 3.1. Estrutura de Dados da Cobrança

```typescript
interface AsaasPayment {
  customer: string;              // ID do cliente no Asaas (obrigatório)
  billingType: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BOLETO' | 'UNDEFINED';
  value: number;                 // Valor da cobrança
  dueDate: string;              // Data de vencimento (YYYY-MM-DD)
  description?: string;          // Descrição da cobrança
  externalReference?: string;    // Referência externa (ID do lead)
  installmentCount?: number;     // Número de parcelas (cartão de crédito)
  installmentValue?: number;     // Valor da parcela
  discount?: {
    value?: number;              // Valor fixo de desconto
    dueDateLimitDays?: number;   // Dias antes do vencimento
    type?: 'FIXED' | 'PERCENTAGE';
  };
  interest?: {
    value: number;               // Juros ao mês (%)
  };
  fine?: {
    value: number;               // Multa (%)
  };
  postalService?: boolean;       // Enviar por correio
  split?: Array<{               // Split de pagamento
    walletId: string;
    fixedValue?: number;
    percentualValue?: number;
  }>;
  callback?: {
    successUrl?: string;         // URL de retorno (sucesso)
    autoRedirect?: boolean;
  };
}
```

### 3.2. Implementação - Payment Service

```typescript
// app/api/services/AsaasPaymentService.ts
import { asaasApi, asaasHeaders } from '@/lib/asaas';

export class AsaasPaymentService {
  /**
   * Cria uma nova cobrança
   */
  static async createPayment(data: AsaasPayment) {
    try {
      const response = await fetch(asaasApi.payments, {
        method: 'POST',
        headers: asaasHeaders,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.errors?.[0]?.description || 'Erro ao criar cobrança');
      }

      const payment = await response.json();
      return {
        success: true,
        paymentId: payment.id,
        invoiceUrl: payment.invoiceUrl,
        bankSlipUrl: payment.bankSlipUrl,
        pixQrCode: payment.pixQrCodeId ? await this.getPixQrCode(payment.id) : null,
        data: payment,
      };
    } catch (error) {
      console.error('Erro ao criar cobrança:', error);
      throw error;
    }
  }

  /**
   * Busca cobrança por ID
   */
  static async getPayment(paymentId: string) {
    const response = await fetch(`${asaasApi.payments}/${paymentId}`, {
      method: 'GET',
      headers: asaasHeaders,
    });

    if (!response.ok) {
      throw new Error('Cobrança não encontrada');
    }

    return await response.json();
  }

  /**
   * Obtém QR Code PIX
   */
  static async getPixQrCode(paymentId: string) {
    const response = await fetch(`${asaasApi.payments}/${paymentId}/pixQrCode`, {
      method: 'GET',
      headers: asaasHeaders,
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      encodedImage: data.encodedImage,  // Base64 da imagem
      payload: data.payload,             // Código PIX copia e cola
      expirationDate: data.expirationDate,
    };
  }

  /**
   * Cancela uma cobrança
   */
  static async cancelPayment(paymentId: string) {
    const response = await fetch(`${asaasApi.payments}/${paymentId}`, {
      method: 'DELETE',
      headers: asaasHeaders,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors?.[0]?.description || 'Erro ao cancelar cobrança');
    }

    return await response.json();
  }

  /**
   * Estorna uma cobrança
   */
  static async refundPayment(paymentId: string, value?: number) {
    const response = await fetch(`${asaasApi.payments}/${paymentId}/refund`, {
      method: 'POST',
      headers: asaasHeaders,
      body: JSON.stringify({ value }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors?.[0]?.description || 'Erro ao estornar cobrança');
    }

    return await response.json();
  }
}
```

---

## 💰 4. Pagamento PIX

### 4.1. Fluxo PIX

1. Cliente solicita pagamento via PIX
2. Criar cobrança com `billingType: 'PIX'`
3. Asaas retorna QR Code e código "copia e cola"
4. Cliente escaneia QR Code ou copia código
5. Pagamento é processado instantaneamente
6. Webhook notifica confirmação

### 4.2. Exemplo de Implementação

```typescript
// app/api/v1/payments/pix/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AsaasPaymentService } from '@/app/api/services/AsaasPaymentService';
import { Output } from '@/lib/output';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, value, description, dueDate } = body;

    // Validações
    if (!customerId || !value) {
      return NextResponse.json(
        new Output(false, [], ['Cliente e valor são obrigatórios'], null),
        { status: 400 }
      );
    }

    // Criar cobrança PIX
    const payment = await AsaasPaymentService.createPayment({
      customer: customerId,
      billingType: 'PIX',
      value,
      dueDate: dueDate || new Date().toISOString().split('T')[0],
      description: description || 'Pagamento via PIX',
    });

    return NextResponse.json(
      new Output(true, ['Cobrança PIX criada com sucesso'], [], {
        paymentId: payment.paymentId,
        pixQrCode: payment.pixQrCode,
        invoiceUrl: payment.invoiceUrl,
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro ao criar cobrança PIX:', error);
    return NextResponse.json(
      new Output(false, [], ['Erro ao processar pagamento PIX'], null),
      { status: 500 }
    );
  }
}
```

### 4.3. Frontend - Componente PIX

```typescript
// components/payment/PixPayment.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

interface PixPaymentProps {
  customerId: string;
  value: number;
  description?: string;
}

export function PixPayment({ customerId, value, description }: PixPaymentProps) {
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const generatePix = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/payments/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, value, description }),
      });

      const result = await response.json();

      if (!result.isValid) {
        throw new Error(result.errorMessages?.[0] || 'Erro ao gerar PIX');
      }

      setPixData(result.data);
      toast.success('QR Code PIX gerado com sucesso!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar PIX');
    } finally {
      setLoading(false);
    }
  };

  const copyPixCode = () => {
    if (pixData?.pixQrCode?.payload) {
      navigator.clipboard.writeText(pixData.pixQrCode.payload);
      setCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagamento via PIX</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!pixData ? (
          <Button onClick={generatePix} disabled={loading} className="w-full">
            {loading ? 'Gerando...' : 'Gerar QR Code PIX'}
          </Button>
        ) : (
          <div className="space-y-4">
            {/* QR Code */}
            {pixData.pixQrCode?.encodedImage && (
              <div className="flex justify-center">
                <Image
                  src={`data:image/png;base64,${pixData.pixQrCode.encodedImage}`}
                  alt="QR Code PIX"
                  width={300}
                  height={300}
                  className="border rounded"
                />
              </div>
            )}

            {/* Código Copia e Cola */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Ou pague com PIX Copia e Cola:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pixData.pixQrCode?.payload || ''}
                  readOnly
                  className="flex-1 p-2 border rounded text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyPixCode}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Validade */}
            {pixData.pixQrCode?.expirationDate && (
              <p className="text-xs text-muted-foreground">
                Válido até: {new Date(pixData.pixQrCode.expirationDate).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## 💳 5. Pagamento com Cartão

### 5.1. Tokenização de Cartão

Para processar cartões, o Asaas requer **tokenização**. Use a biblioteca JavaScript do Asaas:

```html
<!-- Adicionar no layout ou head -->
<script src="https://js.asaas.com/v1"></script>
```

### 5.2. Criar Token do Cartão (Frontend)

```typescript
// lib/asaas-card-tokenizer.ts
declare global {
  interface Window {
    Asaas: {
      CreditCard: {
        tokenize(card: CardData): Promise<TokenResult>;
      };
    };
  }
}

interface CardData {
  number: string;
  holderName: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

interface TokenResult {
  token: string;
  success: boolean;
  errors?: string[];
}

export async function tokenizeCard(card: CardData): Promise<string> {
  try {
    const result = await window.Asaas.CreditCard.tokenize(card);
    
    if (!result.success || !result.token) {
      throw new Error(result.errors?.join(', ') || 'Erro ao tokenizar cartão');
    }

    return result.token;
  } catch (error) {
    console.error('Erro ao tokenizar cartão:', error);
    throw error;
  }
}
```

### 5.3. Processar Pagamento com Cartão

```typescript
// app/api/v1/payments/credit-card/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AsaasPaymentService } from '@/app/api/services/AsaasPaymentService';
import { Output } from '@/lib/output';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerId,
      value,
      description,
      creditCardToken,      // Token gerado no frontend
      installmentCount,     // Número de parcelas
      holderName,
      holderCpfCnpj,
      holderEmail,
      holderPhone,
      holderAddress,
      holderAddressNumber,
      holderProvince,
      holderPostalCode,
    } = body;

    // Validações
    if (!customerId || !value || !creditCardToken) {
      return NextResponse.json(
        new Output(false, [], ['Dados incompletos'], null),
        { status: 400 }
      );
    }

    // Criar cobrança com cartão de crédito
    const payment = await AsaasPaymentService.createPayment({
      customer: customerId,
      billingType: 'CREDIT_CARD',
      value,
      dueDate: new Date().toISOString().split('T')[0],
      description: description || 'Pagamento com cartão de crédito',
      installmentCount: installmentCount || 1,
      creditCard: {
        holderName,
        number: creditCardToken,  // Token do cartão
        expiryMonth: '', // Já está no token
        expiryYear: '',  // Já está no token
        ccv: '',         // Já está no token
      },
      creditCardHolderInfo: {
        name: holderName,
        email: holderEmail,
        cpfCnpj: holderCpfCnpj,
        postalCode: holderPostalCode,
        addressNumber: holderAddressNumber,
        phone: holderPhone,
      },
    });

    return NextResponse.json(
      new Output(true, ['Pagamento processado com sucesso'], [], payment),
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro ao processar pagamento:', error);
    return NextResponse.json(
      new Output(false, [], ['Erro ao processar pagamento'], null),
      { status: 500 }
    );
  }
}
```

### 5.4. Frontend - Formulário de Cartão

```typescript
// components/payment/CreditCardForm.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { tokenizeCard } from '@/lib/asaas-card-tokenizer';

interface CreditCardFormProps {
  customerId: string;
  value: number;
  onSuccess?: () => void;
}

export function CreditCardForm({ customerId, value, onSuccess }: CreditCardFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cardNumber: '',
    holderName: '',
    expiryMonth: '',
    expiryYear: '',
    ccv: '',
    installments: '1',
    holderCpfCnpj: '',
    holderEmail: '',
    holderPhone: '',
    holderPostalCode: '',
    holderAddressNumber: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Tokenizar cartão
      const cardToken = await tokenizeCard({
        number: formData.cardNumber.replace(/\s/g, ''),
        holderName: formData.holderName,
        expiryMonth: formData.expiryMonth,
        expiryYear: formData.expiryYear,
        ccv: formData.ccv,
      });

      // 2. Processar pagamento
      const response = await fetch('/api/v1/payments/credit-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          value,
          creditCardToken: cardToken,
          installmentCount: parseInt(formData.installments),
          holderName: formData.holderName,
          holderCpfCnpj: formData.holderCpfCnpj,
          holderEmail: formData.holderEmail,
          holderPhone: formData.holderPhone,
          holderPostalCode: formData.holderPostalCode,
          holderAddressNumber: formData.holderAddressNumber,
        }),
      });

      const result = await response.json();

      if (!result.isValid) {
        throw new Error(result.errorMessages?.[0] || 'Erro ao processar pagamento');
      }

      toast.success('Pagamento realizado com sucesso!');
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao processar pagamento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagamento com Cartão de Crédito</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Número do Cartão */}
          <div className="space-y-2">
            <Label>Número do Cartão</Label>
            <Input
              placeholder="0000 0000 0000 0000"
              value={formData.cardNumber}
              onChange={(e) => setFormData({ ...formData, cardNumber: e.target.value })}
              required
            />
          </div>

          {/* Nome no Cartão */}
          <div className="space-y-2">
            <Label>Nome no Cartão</Label>
            <Input
              placeholder="NOME SOBRENOME"
              value={formData.holderName}
              onChange={(e) => setFormData({ ...formData, holderName: e.target.value })}
              required
            />
          </div>

          {/* Validade e CVV */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select
                value={formData.expiryMonth}
                onValueChange={(value) => setFormData({ ...formData, expiryMonth: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="MM" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <SelectItem key={month} value={String(month).padStart(2, '0')}>
                      {String(month).padStart(2, '0')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ano</Label>
              <Select
                value={formData.expiryYear}
                onValueChange={(value) => setFormData({ ...formData, expiryYear: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="AA" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 15 }, (_, i) => new Date().getFullYear() + i).map((year) => (
                    <SelectItem key={year} value={String(year).slice(-2)}>
                      {String(year).slice(-2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>CVV</Label>
              <Input
                placeholder="000"
                maxLength={4}
                value={formData.ccv}
                onChange={(e) => setFormData({ ...formData, ccv: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Parcelas */}
          <div className="space-y-2">
            <Label>Parcelas</Label>
            <Select
              value={formData.installments}
              onValueChange={(value) => setFormData({ ...formData, installments: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => {
                  const installmentValue = value / num;
                  return (
                    <SelectItem key={num} value={String(num)}>
                      {num}x de R$ {installmentValue.toFixed(2)}
                      {num === 1 ? ' à vista' : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Dados do Titular */}
          <div className="space-y-2">
            <Label>CPF/CNPJ</Label>
            <Input
              placeholder="000.000.000-00"
              value={formData.holderCpfCnpj}
              onChange={(e) => setFormData({ ...formData, holderCpfCnpj: e.target.value })}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Processando...' : `Pagar R$ ${value.toFixed(2)}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

---

## 🔄 6. Assinaturas (Recorrência)

### 6.1. Estrutura de Dados da Assinatura

```typescript
interface AsaasSubscription {
  customer: string;              // ID do cliente
  billingType: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BOLETO';
  value: number;                 // Valor da assinatura
  nextDueDate: string;          // Data do primeiro pagamento (YYYY-MM-DD)
  cycle: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';
  description?: string;
  endDate?: string;             // Data de encerramento (opcional)
  maxPayments?: number;         // Número máximo de cobranças
  externalReference?: string;
  discount?: {
    value: number;
    dueDateLimitDays: number;
    type: 'FIXED' | 'PERCENTAGE';
  };
  interest?: { value: number };
  fine?: { value: number };
  creditCard?: {
    holderName: string;
    number: string;              // Token do cartão
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo?: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone: string;
  };
}
```

### 6.2. Implementação - Subscription Service

```typescript
// app/api/services/AsaasSubscriptionService.ts
import { asaasApi, asaasHeaders } from '@/lib/asaas';

export class AsaasSubscriptionService {
  /**
   * Cria nova assinatura
   */
  static async createSubscription(data: AsaasSubscription) {
    try {
      const response = await fetch(asaasApi.subscriptions, {
        method: 'POST',
        headers: asaasHeaders,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.errors?.[0]?.description || 'Erro ao criar assinatura');
      }

      const subscription = await response.json();
      return {
        success: true,
        subscriptionId: subscription.id,
        data: subscription,
      };
    } catch (error) {
      console.error('Erro ao criar assinatura:', error);
      throw error;
    }
  }

  /**
   * Busca assinatura por ID
   */
  static async getSubscription(subscriptionId: string) {
    const response = await fetch(`${asaasApi.subscriptions}/${subscriptionId}`, {
      method: 'GET',
      headers: asaasHeaders,
    });

    if (!response.ok) {
      throw new Error('Assinatura não encontrada');
    }

    return await response.json();
  }

  /**
   * Atualiza assinatura
   */
  static async updateSubscription(
    subscriptionId: string,
    data: Partial<AsaasSubscription>
  ) {
    const response = await fetch(`${asaasApi.subscriptions}/${subscriptionId}`, {
      method: 'PUT',
      headers: asaasHeaders,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors?.[0]?.description || 'Erro ao atualizar assinatura');
    }

    return await response.json();
  }

  /**
   * Cancela assinatura
   */
  static async cancelSubscription(subscriptionId: string) {
    const response = await fetch(`${asaasApi.subscriptions}/${subscriptionId}`, {
      method: 'DELETE',
      headers: asaasHeaders,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors?.[0]?.description || 'Erro ao cancelar assinatura');
    }

    return await response.json();
  }

  /**
   * Lista cobranças de uma assinatura
   */
  static async getSubscriptionPayments(subscriptionId: string) {
    const response = await fetch(
      `${asaasApi.payments}?subscription=${subscriptionId}`,
      {
        method: 'GET',
        headers: asaasHeaders,
      }
    );

    if (!response.ok) {
      throw new Error('Erro ao buscar cobranças');
    }

    const result = await response.json();
    return result.data || [];
  }
}
```

### 6.3. Endpoint de Criação de Assinatura

```typescript
// app/api/v1/subscriptions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AsaasSubscriptionService } from '@/app/api/services/AsaasSubscriptionService';
import { Output } from '@/lib/output';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerId,
      billingType,
      value,
      cycle,
      description,
      creditCardToken,
      holderInfo,
    } = body;

    // Validações
    if (!customerId || !value || !cycle) {
      return NextResponse.json(
        new Output(false, [], ['Dados incompletos'], null),
        { status: 400 }
      );
    }

    const subscriptionData: any = {
      customer: customerId,
      billingType: billingType || 'CREDIT_CARD',
      value,
      nextDueDate: new Date().toISOString().split('T')[0],
      cycle,
      description: description || 'Assinatura mensal',
    };

    // Se for cartão de crédito, incluir dados do cartão
    if (billingType === 'CREDIT_CARD' && creditCardToken) {
      subscriptionData.creditCard = {
        holderName: holderInfo.name,
        number: creditCardToken,
        expiryMonth: '',
        expiryYear: '',
        ccv: '',
      };
      subscriptionData.creditCardHolderInfo = holderInfo;
    }

    const subscription = await AsaasSubscriptionService.createSubscription(
      subscriptionData
    );

    return NextResponse.json(
      new Output(true, ['Assinatura criada com sucesso'], [], subscription),
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro ao criar assinatura:', error);
    return NextResponse.json(
      new Output(false, [], ['Erro ao criar assinatura'], null),
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('id');

    if (!subscriptionId) {
      return NextResponse.json(
        new Output(false, [], ['ID da assinatura é obrigatório'], null),
        { status: 400 }
      );
    }

    const subscription = await AsaasSubscriptionService.getSubscription(subscriptionId);

    return NextResponse.json(
      new Output(true, [], [], subscription),
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro ao buscar assinatura:', error);
    return NextResponse.json(
      new Output(false, [], ['Erro ao buscar assinatura'], null),
      { status: 500 }
    );
  }
}
```

---

## 📡 7. Webhooks

### 7.1. Configurar Webhook no Asaas

1. Acesse o painel Asaas
2. Vá em **Configurações** → **Integrações** → **Webhooks**
3. Adicione a URL: `https://seu-dominio.com/api/webhooks/asaas`
4. Selecione os eventos:
   - ✅ `PAYMENT_RECEIVED` - Pagamento confirmado
   - ✅ `PAYMENT_OVERDUE` - Pagamento vencido
   - ✅ `PAYMENT_DELETED` - Pagamento cancelado
   - ✅ `PAYMENT_REFUNDED` - Pagamento estornado
   - ✅ `SUBSCRIPTION_CREATED` - Assinatura criada
   - ✅ `SUBSCRIPTION_UPDATED` - Assinatura atualizada
   - ✅ `SUBSCRIPTION_DELETED` - Assinatura cancelada

### 7.2. Implementar Endpoint de Webhook

```typescript
// app/api/webhooks/asaas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { LeadRepository } from '@/app/infra/data/repositories/lead/LeadRepository';

const leadRepository = new LeadRepository();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, payment, subscription } = body;

    console.log('Webhook Asaas recebido:', { event, payment, subscription });

    // Processar diferentes tipos de eventos
    switch (event) {
      case 'PAYMENT_RECEIVED':
        await handlePaymentReceived(payment);
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

      case 'SUBSCRIPTION_CREATED':
        await handleSubscriptionCreated(subscription);
        break;

      case 'SUBSCRIPTION_UPDATED':
        await handleSubscriptionUpdated(subscription);
        break;

      case 'SUBSCRIPTION_DELETED':
        await handleSubscriptionDeleted(subscription);
        break;

      default:
        console.log('Evento não tratado:', event);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return NextResponse.json({ error: 'Erro ao processar webhook' }, { status: 500 });
  }
}

async function handlePaymentReceived(payment: any) {
  console.log('💰 Pagamento recebido:', payment.id);
  
  // Buscar lead pelo externalReference
  if (payment.externalReference) {
    const lead = await leadRepository.getLeadById(payment.externalReference);
    if (lead) {
      // Atualizar status do lead para "contract_finalized"
      await leadRepository.updateLeadStatus(
        lead.managerId,
        lead.id,
        'contract_finalized'
      );
      
      // Registrar atividade
      // TODO: Criar atividade de pagamento recebido
    }
  }
}

async function handlePaymentOverdue(payment: any) {
  console.log('⏰ Pagamento vencido:', payment.id);
  // TODO: Enviar notificação ao cliente
}

async function handlePaymentDeleted(payment: any) {
  console.log('🗑️ Pagamento cancelado:', payment.id);
  // TODO: Registrar cancelamento
}

async function handlePaymentRefunded(payment: any) {
  console.log('💸 Pagamento estornado:', payment.id);
  // TODO: Registrar estorno
}

async function handleSubscriptionCreated(subscription: any) {
  console.log('📅 Assinatura criada:', subscription.id);
  // TODO: Registrar assinatura no banco
}

async function handleSubscriptionUpdated(subscription: any) {
  console.log('🔄 Assinatura atualizada:', subscription.id);
  // TODO: Atualizar dados da assinatura
}

async function handleSubscriptionDeleted(subscription: any) {
  console.log('❌ Assinatura cancelada:', subscription.id);
  // TODO: Marcar assinatura como cancelada
}
```

---

## 🗄️ 8. Modelo de Dados

### 8.1. Adicionar Campos ao Lead

```prisma
// prisma/schema.prisma
model Lead {
  id                String      @id @default(uuid()) @db.Uuid
  // ... campos existentes ...
  
  // Pagamento
  asaasCustomerId   String?     @db.Text
  asaasPaymentId    String?     @db.Text
  asaasSubscriptionId String?   @db.Text
  paymentStatus     PaymentStatus?
  paymentMethod     PaymentMethod?
  paymentValue      Float?
  paymentDate       DateTime?   @db.Timestamptz(6)
  
  // ... resto do modelo ...
}

enum PaymentStatus {
  pending
  confirmed
  overdue
  refunded
  canceled
}

enum PaymentMethod {
  pix
  credit_card
  debit_card
  boleto
}
```

Rodar migração:

```bash
bun prisma migrate dev --name add_payment_fields
```

---

## 🎨 9. Interface de Pagamento Completa

### 9.1. Componente Principal

```typescript
// components/payment/PaymentForm.tsx
'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PixPayment } from './PixPayment';
import { CreditCardForm } from './CreditCardForm';
import { SubscriptionForm } from './SubscriptionForm';

interface PaymentFormProps {
  customerId: string;
  value: number;
  leadId: string;
}

export function PaymentForm({ customerId, value, leadId }: PaymentFormProps) {
  const [activeTab, setActiveTab] = useState('pix');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="pix">PIX</TabsTrigger>
        <TabsTrigger value="credit_card">Cartão de Crédito</TabsTrigger>
        <TabsTrigger value="subscription">Assinatura</TabsTrigger>
      </TabsList>

      <TabsContent value="pix">
        <PixPayment
          customerId={customerId}
          value={value}
          description={`Pagamento - Lead ${leadId}`}
        />
      </TabsContent>

      <TabsContent value="credit_card">
        <CreditCardForm
          customerId={customerId}
          value={value}
        />
      </TabsContent>

      <TabsContent value="subscription">
        <SubscriptionForm
          customerId={customerId}
          value={value}
        />
      </TabsContent>
    </Tabs>
  );
}
```

---

## ✅ 10. Checklist de Implementação

### Setup Inicial
- [ ] Criar conta no Asaas
- [ ] Obter API Key (Sandbox)
- [ ] Configurar variáveis de ambiente
- [ ] Atualizar `lib/asaas.ts`

### Backend
- [ ] Criar `AsaasCustomerService`
- [ ] Criar `AsaasPaymentService`
- [ ] Criar `AsaasSubscriptionService`
- [ ] Implementar endpoints de API:
  - [ ] `/api/v1/customers` (POST, GET)
  - [ ] `/api/v1/payments/pix` (POST)
  - [ ] `/api/v1/payments/credit-card` (POST)
  - [ ] `/api/v1/subscriptions` (POST, GET, DELETE)
  - [ ] `/api/webhooks/asaas` (POST)

### Database
- [ ] Adicionar campo `asaasCustomerId` ao Lead
- [ ] Adicionar campos de pagamento ao Lead
- [ ] Criar enums `PaymentStatus` e `PaymentMethod`
- [ ] Rodar migrações

### Frontend
- [ ] Implementar `PixPayment` component
- [ ] Implementar `CreditCardForm` component
- [ ] Implementar `SubscriptionForm` component
- [ ] Implementar `PaymentForm` (tabs principal)
- [ ] Adicionar tokenizador de cartão
- [ ] Integrar com dialog de finalizar contrato

### Testes
- [ ] Testar criação de cliente
- [ ] Testar pagamento PIX
- [ ] Testar pagamento com cartão
- [ ] Testar criação de assinatura
- [ ] Testar webhooks localmente (ngrok)
- [ ] Testar cancelamento de pagamento
- [ ] Testar estorno

### Produção
- [ ] Trocar API Key para produção
- [ ] Configurar webhook em produção
- [ ] Configurar domínio SSL
- [ ] Testar em produção

---

## 📞 Suporte

- **Documentação Asaas:** https://docs.asaas.com
- **Suporte Asaas:** suporte@asaas.com
- **Status da API:** https://status.asaas.com

---

## 🔒 Segurança

### Boas Práticas

1. ✅ **Nunca** exponha a API Key no frontend
2. ✅ **Sempre** use HTTPS em produção
3. ✅ **Sempre** valide dados no backend
4. ✅ **Tokenize** cartões no frontend (nunca envie número do cartão)
5. ✅ **Valide** webhooks com assinatura
6. ✅ **Log** todas as transações
7. ✅ **Implemente** retry logic para webhooks
8. ✅ **Criptografe** dados sensíveis no banco

---

**Versão:** 1.0  
**Data:** Outubro 2025  
**Autor:** Lead Flow Team
