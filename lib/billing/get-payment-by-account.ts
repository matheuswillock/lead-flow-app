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

  // Achado P2 da revisão do PR #1207 (thread PRRT_...eDvN): sem conta
  // conhecida, este laço é uma SONDA — tentar primary e depois legacy é o
  // desenho, e o 404 final é resultado normal (`found: false`), não sintoma
  // de ponteiro morto. Deixar o alerta `asaas-legacy-404` disparar aqui
  // inunda o alarme de E7/X3, ainda por cima a partir de
  // `/api/q/payments/[id]/status`, que aceita `pay_` arbitrário sem
  // autenticação. Com a conta conhecida não há sonda: é consulta dirigida a
  // um ponteiro persistido, e aí o 404 é exatamente o sintoma que o alerta
  // existe para pegar — por isso a supressão é condicional, não fixa.
  const isFallbackProbe = !knownAccount;

  for (const account of accountsToTry) {
    try {
      const client = createAsaasClient(account);
      const payment = await client.request(`${client.endpoints.payments}/${paymentId}`, {
        method: "GET",
        suppressLegacy404Alert: isFallbackProbe,
      });
      return { found: true, payment, account };
    } catch (error) {
      if (isNotFoundError(error)) continue;
      throw error;
    }
  }

  return { found: false };
}
