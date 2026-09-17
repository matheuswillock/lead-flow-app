import { resolveAsaasAccount, type AsaasAccountId } from "@/lib/asaas"
import { isValidAsaasWebhookToken } from "./isValidAsaasWebhookToken"

/**
 * M3.1 de [[10 — Fundações Multi-conta — Backend]] (E4). Resolve qual conta
 * enviou o evento comparando o token recebido contra o valor ATUAL de cada
 * conta (via `resolveAsaasAccount`, sempre lido na hora — nunca cacheado),
 * não por nome de env fixo (E7: os valores podem trocar de slot entre as
 * duas topologias da janela dual, ver DA1/E7 §3). Cada comparação passa por
 * `isValidAsaasWebhookToken` (timingSafeEqual, E3) — os dois caminhos, não
 * só o primary.
 *
 * `legacy` pode não estar provisionada ainda (pré-cutover): nesse caso
 * `resolveAsaasAccount("legacy")` lança, e este resolver trata isso como
 * "conta legacy indisponível" em vez de propagar o erro — só `primary` fica
 * aceitável até a conta legacy ser configurada (E2).
 */
export function resolveAsaasWebhookAccount(receivedToken: string): AsaasAccountId | null {
  if (!receivedToken) return null

  const primaryToken = resolveAsaasAccount("primary").webhookToken
  if (isValidAsaasWebhookToken(receivedToken, primaryToken)) {
    return "primary"
  }

  const legacyToken = readLegacyWebhookToken()
  if (legacyToken && isValidAsaasWebhookToken(receivedToken, legacyToken)) {
    return "legacy"
  }

  return null
}

function readLegacyWebhookToken(): string | undefined {
  try {
    return resolveAsaasAccount("legacy").webhookToken
  } catch {
    return undefined
  }
}
