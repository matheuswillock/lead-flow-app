import { Output } from "@/lib/output";

export interface AddOnCheckoutDefaultBillingData {
  fullName: string;
  email: string;
  phone: string;
  cpfCnpj: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  neighborhood: string;
  complement: string;
  city: string;
  state: string;
}

export interface CheckoutDetailsResponse {
  pendingActionId: string;
  presetBillingType: "PIX" | "CREDIT_CARD";
  addonType: "user" | "team";
  addonLabel: string;
  addonDetail: string;
  pricing: {
    monthlyPrice: number;
    remainingMonths: number;
    totalCharge: number;
    maxInstallments: number;
  };
  status: "pending" | "applied" | "failed" | "canceled";
  masterName: string;
  requesterName?: string;
  alreadyPaid?: boolean;
  defaultBillingData: AddOnCheckoutDefaultBillingData;
}

export interface PaymentStatusResponse {
  paymentId: string;
  status: string;
  amount: number;
  dueDate: string;
  pendingActionStatus: "pending" | "applied" | "failed" | "canceled";
}

export interface AddOnCheckoutPaymentInput {
  billingType: "PIX" | "CREDIT_CARD";
  fullName: string;
  email: string;
  phone: string;
  cpfCnpj: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  neighborhood: string;
  complement?: string;
  city?: string;
  state?: string;
  installments?: number;
  creditCard?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  remoteIp?: string;
}

export interface IAddOnCheckoutUseCase {
  getCheckoutDetails(pendingActionId: string): Promise<Output>;
  createPayment(pendingActionId: string, input: AddOnCheckoutPaymentInput): Promise<Output>;
  checkPaymentStatus(pendingActionId: string): Promise<Output>;
}
