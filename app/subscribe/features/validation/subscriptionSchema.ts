// app/subscribe/features/validation/subscriptionSchema.ts
import { z } from 'zod';

const creditCardSchema = z.object({
  holderName: z.string().min(3, 'Nome do titular deve ter no mínimo 3 caracteres'),
  number: z.string().regex(/^\d{16}$/, 'Número do cartão inválido (16 dígitos)'),
  expiryMonth: z.string().regex(/^(0[1-9]|1[0-2])$/, 'Mês inválido (01-12)'),
  expiryYear: z.string().regex(/^\d{4}$/, 'Ano inválido (YYYY)'),
  ccv: z.string().regex(/^\d{3,4}$/, 'CVV inválido (3-4 dígitos)'),
});

export const subscriptionSchema = z.object({
  // Dados pessoais
  fullName: z.string().min(3, 'Nome completo deve ter no mínimo 3 caracteres'),
  email: z.string().email('Email inválido'),
  cpfCnpj: z.string()
    .regex(/^\d{11}$|^\d{14}$/, 'CPF (11 dígitos) ou CNPJ (14 dígitos) inválido')
    .transform(val => val.replace(/\D/g, '')),
  phone: z.string()
    .regex(/^\d{10,11}$/, 'Telefone inválido (10-11 dígitos)')
    .transform(val => val.replace(/\D/g, '')),
  
  // Endereço
  postalCode: z.string()
    .regex(/^\d{8}$/, 'CEP inválido (8 dígitos)')
    .transform(val => val.replace(/\D/g, '')),
  address: z.string().min(3, 'Endereço deve ter no mínimo 3 caracteres'),
  addressNumber: z.string().min(1, 'Número é obrigatório'),
  complement: z.string().optional(),
  province: z.string().min(2, 'Bairro deve ter no mínimo 2 caracteres'),
  city: z.string().min(2, 'Cidade deve ter no mínimo 2 caracteres'),
  state: z.string().length(2, 'Estado deve ter 2 caracteres (UF)'),
  
  // Pagamento
  billingType: z.enum(['CREDIT_CARD', 'PIX', 'BOLETO'], {
    message: 'Forma de pagamento inválida',
  }),
  
  // Cartão de crédito (condicional)
  creditCard: z.optional(creditCardSchema),
}).refine(
  (data) => {
    // Se billingType for CREDIT_CARD, creditCard é obrigatório
    if (data.billingType === 'CREDIT_CARD') {
      return !!data.creditCard;
    }
    return true;
  },
  {
    message: 'Dados do cartão de crédito são obrigatórios',
    path: ['creditCard'],
  }
);

export type SubscriptionFormSchema = z.infer<typeof subscriptionSchema>;
