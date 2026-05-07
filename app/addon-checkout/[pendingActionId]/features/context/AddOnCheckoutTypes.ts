export type AddOnType = "user" | "team";

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

export interface AddOnCheckoutData {
  pendingActionId: string;
  paymentId: string | null;
  presetBillingType: "PIX" | "CREDIT_CARD";
  addonType: AddOnType;
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

export interface PaymentStatus {
  paymentId: string;
  status: string;
  amount: number;
  dueDate: string;
  pendingActionStatus: "pending" | "applied" | "failed" | "canceled";
}

export interface AddOnCheckoutSubmitInput {
  billingType: "PIX" | "CREDIT_CARD";
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
  installments: number;
  cardHolderName: string;
  cardNumber: string;
  cardExpiryMonth: string;
  cardExpiryYear: string;
  cardCcv: string;
}

export type AddOnCheckoutStep = "loading" | "idle" | "payment" | "success" | "error";

export interface AddOnCheckoutState {
  step: AddOnCheckoutStep;
  data?: AddOnCheckoutData;
  selectedPaymentMethod: "PIX" | "CREDIT_CARD";
  paymentData?: any;
  paymentStatus?: PaymentStatus;
  error?: string;
  isProcessing: boolean;
}

export const initialState: AddOnCheckoutState = {
  step: "loading",
  selectedPaymentMethod: "PIX",
  isProcessing: false,
};
