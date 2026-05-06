import type { AddOnCheckoutData, AddOnCheckoutSubmitInput, PaymentStatus } from "../context/AddOnCheckoutTypes";

export interface IAddOnCheckoutService {
  fetchCheckoutData(pendingActionId: string): Promise<AddOnCheckoutData>;
  createPayment(pendingActionId: string, input: AddOnCheckoutSubmitInput): Promise<any>;
  checkPaymentStatus(pendingActionId: string): Promise<PaymentStatus>;
}
