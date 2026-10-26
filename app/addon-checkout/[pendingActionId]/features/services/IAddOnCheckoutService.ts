import type { AddOnCheckoutData, AddOnCheckoutSubmitInput, PaymentStatus } from "../context/AddOnCheckoutTypes";

import type { PlatformPixPaymentData } from "../utils/platformPixPayment";

export interface IAddOnCheckoutService {
  fetchCheckoutData(pendingActionId: string): Promise<AddOnCheckoutData>;
  updateBillingType(pendingActionId: string, billingType: "PIX" | "CREDIT_CARD"): Promise<void>;
  createPayment(pendingActionId: string, input: AddOnCheckoutSubmitInput): Promise<any>;
  createPlatformPixPayment(purchaseId: string, input: AddOnCheckoutSubmitInput): Promise<PlatformPixPaymentData>;
  checkPaymentStatus(pendingActionId: string): Promise<PaymentStatus>;
}
