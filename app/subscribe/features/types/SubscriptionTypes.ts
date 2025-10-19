// app/subscribe/features/types/SubscriptionTypes.ts
export type BillingType = 'CREDIT_CARD' | 'PIX' | 'BOLETO';

export interface SubscriptionFormData {
  // Dados pessoais
  fullName: string;
  email: string;
  cpfCnpj: string;
  phone: string;
  
  // Endereço
  postalCode: string;
  address: string;
  addressNumber: string;
  complement?: string;
  province: string;
  city: string;
  state: string;
  
  // Pagamento
  billingType: BillingType;
  
  // Cartão de crédito (se aplicável)
  creditCard?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
}

export interface SubscriptionState {
  step: 'form' | 'processing' | 'success' | 'error';
  loading: boolean;
  error: string | null;
  customerId?: string;
  subscriptionId?: string;
  paymentUrl?: string;
  paymentId?: string;
  pix?: { encodedImage: string; payload: string; expirationDate: string };
  boleto?: { bankSlipUrl: string; identificationField: string; barCode: string; dueDate: string };
}
