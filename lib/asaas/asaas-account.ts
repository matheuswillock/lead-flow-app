/**
 * Resolução de conta Asaas — E1 de [[10 — Fundações Multi-conta — Backend]].
 *
 * O código passa a conhecer duas contas: `primary` (conta nova, CNPJ correto)
 * e `legacy` (conta antiga, somente leitura — opt-in explícito). DA1: os nomes
 * de env atuais (`ASAAS_API_KEY`/`ASAAS_WALLET_ID`/`ASAAS_WEBHOOK_TOKEN`)
 * continuam significando a conta `primary`; a legacy vive em
 * `ASAAS_LEGACY_API_KEY`/`ASAAS_LEGACY_WEBHOOK_TOKEN`.
 *
 * C30: a resolução de ambiente (sandbox/produção) é uma dimensão só, via
 * `ASAAS_ENV` — as duas contas compartilham a mesma baseUrl efetiva.
 */

export type AsaasAccountId = "primary" | "legacy"

export type ResolvedAsaasAccount = {
  accountId: AsaasAccountId
  /**
   * `primary` pode vir `undefined` pré-configuração — os call-sites que
   * fazem requisição de fato (`asaasFetch`, `createAsaasClient().request`)
   * validam a presença e lançam com a mensagem histórica
   * ("ASAAS_API_KEY não configurada"). Isso preserva o comportamento dos
   * getters legados de `lib/asaas.ts`, que nunca lançavam ao montar URL.
   * `legacy` nunca chega aqui undefined: lança direto em `resolveAsaasAccount`.
   */
  apiKey: string | undefined
  baseUrl: string
  walletId?: string
  webhookToken?: string
}

function detectAsaasEnvironment(): "production" | "sandbox" {
  if (process.env.ASAAS_ENV) {
    return process.env.ASAAS_ENV === "production" ? "production" : "sandbox"
  }
  if (process.env.NODE_ENV === "production") {
    return "production"
  }
  return "sandbox"
}

/** Host bare (sem `/api/v3`) — mesma resolução para as duas contas (C30). */
function resolveAsaasBaseUrl(): string {
  const isProduction = detectAsaasEnvironment() === "production"
  if (isProduction) {
    return process.env.ASAAS_URL || "https://www.asaas.com"
  }
  return process.env.ASAAS_URL_sandbox || "https://sandbox.asaas.com"
}

export function resolveAsaasAccount(accountId: AsaasAccountId): ResolvedAsaasAccount {
  const baseUrl = resolveAsaasBaseUrl()

  if (accountId === "legacy") {
    const apiKey = process.env.ASAAS_LEGACY_API_KEY
    if (!apiKey) {
      throw new Error(
        "Conta Asaas 'legacy' solicitada, mas ASAAS_LEGACY_API_KEY não está configurada " +
          "(pré-cutover: a conta legacy ainda não existe — ver [[10 — Fundações Multi-conta — Backend]] E2)."
      )
    }
    return {
      accountId: "legacy",
      apiKey,
      baseUrl,
      webhookToken: process.env.ASAAS_LEGACY_WEBHOOK_TOKEN,
    }
  }

  return {
    accountId: "primary",
    apiKey: process.env.ASAAS_API_KEY,
    baseUrl,
    walletId: process.env.ASAAS_WALLET_ID,
    webhookToken: process.env.ASAAS_WEBHOOK_TOKEN,
  }
}
