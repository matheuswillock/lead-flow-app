import type { AddOnCheckoutData, AddOnCheckoutSubmitInput, PaymentStatus } from "../context/AddOnCheckoutTypes";
import type { IAddOnCheckoutService } from "./IAddOnCheckoutService";
import { API_CLIENT_BASE } from "@/lib/route-map";
import {
  mapPlatformPurchaseToCheckoutData,
  type PlatformCheckoutApiResult,
} from "../utils/mapPlatformPurchaseToCheckoutData";

class AddOnCheckoutServiceImpl implements IAddOnCheckoutService {
  private async tryFetchPlatformCheckout(
    checkoutId: string
  ): Promise<AddOnCheckoutData | null> {
    const response = await fetch(`${API_CLIENT_BASE}/platform-checkout/${checkoutId}`);
    if (!response.ok) return null;
    const result = await response.json();
    if (!result.isValid || !result.result) return null;
    return mapPlatformPurchaseToCheckoutData(result.result as PlatformCheckoutApiResult);
  }

  async fetchCheckoutData(pendingActionId: string): Promise<AddOnCheckoutData> {
    // PlatformPurchase genérico e PendingAction legado compartilham /addon-checkout/[id].
    const platform = await this.tryFetchPlatformCheckout(pendingActionId);
    if (platform) return platform;

    const response = await fetch(`${API_CLIENT_BASE}/addon-checkout/${pendingActionId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errorMessages?.[0] || "Erro ao carregar dados do checkout");
    }

    const result = await response.json();
    if (!result.isValid) {
      throw new Error(result.errorMessages?.[0] || "Erro ao carregar dados");
    }

    return {
      ...(result.result as AddOnCheckoutData),
      checkoutSource: "pending_action",
    };
  }

  async createPayment(pendingActionId: string, input: AddOnCheckoutSubmitInput): Promise<any> {
    const body: Record<string, unknown> = {
      billingType: input.billingType,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      cpfCnpj: input.cpfCnpj,
      postalCode: input.postalCode,
      address: input.address,
      addressNumber: input.addressNumber,
      neighborhood: input.neighborhood,
      complement: input.complement || undefined,
      city: input.city || undefined,
      state: input.state || undefined,
    };

    if (input.billingType === "CREDIT_CARD") {
      body.installments = input.installments;
      body.creditCard = {
        holderName: input.cardHolderName,
        number: input.cardNumber,
        expiryMonth: input.cardExpiryMonth,
        expiryYear: input.cardExpiryYear,
        ccv: input.cardCcv,
      };
    }

    const response = await fetch(`${API_CLIENT_BASE}/addon-checkout/${pendingActionId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errorMessages?.[0] || "Erro ao criar cobrança");
    }

    const result = await response.json();
    if (!result.isValid) {
      throw new Error(result.errorMessages?.[0] || "Erro ao criar cobrança");
    }

    return result.result;
  }

  async checkPaymentStatus(pendingActionId: string): Promise<PaymentStatus> {
    const response = await fetch(`${API_CLIENT_BASE}/addon-checkout/${pendingActionId}/status`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errorMessages?.[0] || "Erro ao verificar status");
    }

    const result = await response.json();
    if (!result.isValid) {
      throw new Error(result.errorMessages?.[0] || "Erro ao verificar status");
    }

    return result.result;
  }
}

export const addOnCheckoutService = new AddOnCheckoutServiceImpl();
