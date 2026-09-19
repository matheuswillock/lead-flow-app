import type { CreditCardFormData } from "@/app/[supabaseId]/manager-users/features/container/CreditCardForm";

export type ReactivationPaymentMethod = "PIX" | "CREDIT_CARD";

export type ReactivationManagerData = {
  id: string;
  name: string;
  email: string;
};

/**
 * E3 (T-21.8): sem fallback para `subscriptionId`. Consultar
 * `/subscriptions/payment-status/{id}` com um id que não é de pagamento
 * nunca confirma o polling, mesmo com o PIX efetivamente pago — o usuário
 * pode acabar pagando duas vezes.
 */
export function extractPixPaymentId(result: { paymentId?: string | null } | null | undefined): string | null {
  return result?.paymentId || null;
}

/**
 * E3 (T-21.10): payload de reativação nunca inclui `remoteIp` forjado
 * (`'127.0.0.1'`) — dado falso enviado ao antifraude de cartão. O backend
 * captura o IP real do request.
 */
export function buildReactivationPayload(input: {
  supabaseId: string;
  operatorCount: number;
  paymentMethod: ReactivationPaymentMethod;
  managerEmail: string;
  creditCardFormData: CreditCardFormData | null;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    supabaseId: input.supabaseId,
    operatorCount: input.operatorCount,
    paymentMethod: input.paymentMethod,
  };

  if (input.paymentMethod === "CREDIT_CARD" && input.creditCardFormData) {
    const creditCardFormData = input.creditCardFormData;
    payload.creditCard = {
      holderName: creditCardFormData.holderName,
      number: creditCardFormData.number,
      expiryMonth: creditCardFormData.expiryMonth,
      expiryYear: creditCardFormData.expiryYear,
      ccv: creditCardFormData.ccv,
    };
    payload.creditCardHolderInfo = {
      name: creditCardFormData.name,
      email: input.managerEmail,
      cpfCnpj: creditCardFormData.cpfCnpj,
      postalCode: creditCardFormData.postalCode,
      addressNumber: creditCardFormData.addressNumber,
      phone: creditCardFormData.phone || creditCardFormData.mobilePhone,
      mobilePhone: creditCardFormData.mobilePhone,
    };
  }

  return payload;
}
