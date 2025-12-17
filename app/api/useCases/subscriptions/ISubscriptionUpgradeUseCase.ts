import type { Output } from "@/lib/output";

export interface AddOperatorPaymentData {
  managerId: string;
  operatorData: {
    name: string;
    email: string;
    role: string;
  };
  paymentMethod: "PIX" | "CREDIT_CARD";
  creditCard?: {
    holderName: string;
    number: string;
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
    mobilePhone: string;
  };
  remoteIp?: string;
}

export interface SubscriptionUpgradeResult {
  paymentId: string;
  paymentStatus: string;
  paymentMethod: string;
  dueDate?: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  operatorCreated: boolean;
  operatorId?: string;
}

export interface ReactivateSubscriptionData {
  supabaseId: string;
  operatorCount: number;
  paymentMethod: 'PIX' | 'CREDIT_CARD';
  creditCard?: {
    holderName: string;
    number: string;
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
    mobilePhone: string;
  };
  remoteIp: string;
}

export interface ISubscriptionUpgradeUseCase {
  /**
   * Cria pagamento para adicionar novo operador
   */
  createOperatorPayment(data: AddOperatorPaymentData): Promise<Output>;
  
  /**
   * Confirma pagamento e cria operador
   */
  confirmPaymentAndCreateOperator(paymentId: string): Promise<Output>;
  
  /**
   * Verifica status do pagamento do operador
   */
  checkOperatorPaymentStatus(paymentId: string): Promise<Output>;

  /**
   * Remove operador e atualiza assinatura do manager
   */
  removeOperatorAndUpdateSubscription(operatorId: string): Promise<Output>;

  /**
   * Reativa assinatura cancelada com novo plano
   */
  reactivateSubscription(data: ReactivateSubscriptionData): Promise<Output>;
}
