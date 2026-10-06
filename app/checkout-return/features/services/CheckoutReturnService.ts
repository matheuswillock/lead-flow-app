import { API_CLIENT_BASE } from "@/lib/route-map";
import type { ICheckoutReturnService, PaymentStatusLookup } from "./ICheckoutReturnService";

export class CheckoutReturnService implements ICheckoutReturnService {
  async getPaymentStatus(paymentReference: string): Promise<PaymentStatusLookup> {
    const response = await fetch(`${API_CLIENT_BASE}/payments/${paymentReference}/status`);
    const result = await response.json();

    if (!response.ok || !result.isValid || !result.result) {
      throw new Error(result.errorMessages?.join(", ") || "Erro ao verificar status do pagamento");
    }

    return result.result as PaymentStatusLookup;
  }
}

export const checkoutReturnService = new CheckoutReturnService();
