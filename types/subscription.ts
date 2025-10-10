// types/subscription.ts - Tipos relacionados a assinatura e sign-up

/**
 * Dados salvos no sessionStorage após confirmação de pagamento
 * Estes dados serão usados no sign-up para criar o profile
 */
export interface PendingSignUpData {
  // Dados pessoais
  fullName: string;
  email: string;
  cpfCnpj: string; // Sem máscara
  phone: string; // Sem máscara
  
  // Endereço completo
  postalCode: string; // Sem máscara
  address: string;
  addressNumber: string;
  complement?: string;
  city: string;
  state: string;
  
  // Dados da assinatura Asaas
  subscriptionId: string;
  customerId: string;
  
  // Flags de controle
  subscriptionConfirmed: boolean;
  timestamp: string; // ISO string da data de criação
}

/**
 * Resultado da criação de subscription (sem profile)
 */
export interface SubscriptionCreationResult {
  customerId: string;
  subscriptionId: string;
  paymentUrl?: string;
  paymentId?: string;
  pix?: {
    encodedImage: string;
    payload: string;
    expirationDate: string;
  };
  boleto?: {
    bankSlipUrl: string;
    identificationField: string;
    barCode: string;
    dueDate: string;
  };
}

/**
 * Status do pagamento consultado via polling
 */
export interface PaymentStatus {
  isPaid: boolean;
  status: 'pending' | 'paid_pending_signup' | 'active' | 'not_found';
  subscriptionStatus?: string;
  message?: string;
}
