import { createAsaasClient, type AsaasAccountId } from "@/lib/asaas";

// 20 — Assinaturas — Backend E5 (C24). Helper único de "GET payment por
// conta com fallback" — os 7 call-sites de polling de pagamento hoje
// consultam um client global fixo em primary, o que gera 404/500 para todo
// pay_ da conta legacy pós-cutover. Quando o registro de origem tem coluna
// de conta (BackofficePayment, BackofficeAdhesion), a conta é conhecida e
// usada direto; quando não (Profile.subscriptionId legado, PlatformPurchase
// sem coluna), tenta primary e cai para legacy só em 404 — nunca o inverso
// (não adivinhar legacy primeiro custaria uma chamada extra no caminho
// majoritário, que já migrou).
export type GetPaymentByAccountResult =
  | { found: true; payment: Record<string, unknown>; account: AsaasAccountId }
  | { found: false };

function isNotFoundError(error: unknown): boolean {
  const statusCode = (error as { statusCode?: number } | undefined)?.statusCode;
  return statusCode === 404;
}

export async function getPaymentByAccountWithFallback(
  paymentId: string,
  knownAccount?: AsaasAccountId | null,
): Promise<GetPaymentByAccountResult> {
  const accountsToTry: AsaasAccountId[] = knownAccount ? [knownAccount] : ["primary", "legacy"];

  for (const account of accountsToTry) {
    try {
      const client = createAsaasClient(account);
      const payment = await client.request(`${client.endpoints.payments}/${paymentId}`, {
        method: "GET",
      });
      return { found: true, payment, account };
    } catch (error) {
      if (isNotFoundError(error)) continue;
      throw error;
    }
  }

  return { found: false };
}
