import type { AddOnCheckoutData, AddOnCheckoutSubmitInput, PaymentStatus } from "../context/AddOnCheckoutTypes";

export interface IAddOnCheckoutService {
  fetchCheckoutData(pendingActionId: string): Promise<AddOnCheckoutData>;
  updateBillingType(pendingActionId: string, billingType: "PIX" | "CREDIT_CARD"): Promise<void>;
  createPayment(pendingActionId: string, input: AddOnCheckoutSubmitInput): Promise<any>;
  checkPaymentStatus(pendingActionId: string): Promise<PaymentStatus>;
}
