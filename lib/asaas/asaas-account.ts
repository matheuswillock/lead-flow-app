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

import { credentialCache, type InstanceSelector } from "@/lib/payment-provider/credential-cache"

export type AsaasAccountId = "primary" | "legacy"

/**
 * Instância de credenciais da conta Asaas no backoffice (M11): o contexto da conta é o próprio
 * `accountId` e o ambiente Asaas (`production`/`sandbox`) mapeia para `PRODUCTION`/`DEV`.
 */
export function asaasInstanceSelector(accountId: AsaasAccountId): InstanceSelector {
  return {
    provider: "ASAAS",
    environment: detectAsaasEnvironment() === "production" ? "PRODUCTION" : "DEV",
    externalAccountContext: accountId,
  }
}

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
  /** Dimensão única de ambiente (C30), a mesma que resolveu `baseUrl`. */
  environment: "production" | "sandbox"
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

/** Valor vindo do banco (cache hidratado), se existir; o ambiente continua sendo a reserva. */
function readStoredCredential(accountId: AsaasAccountId, key: string): string | undefined {
  const cached = credentialCache.peekAndRefresh(asaasInstanceSelector(accountId))
  return cached?.sources[key] === "db" ? cached.values[key] : undefined
}

export function resolveAsaasAccount(accountId: AsaasAccountId): ResolvedAsaasAccount {
  // A URL base vem SOMENTE de ASAAS_ENV/ASAAS_URL*: nunca de credencial editável (SSRF).
  const baseUrl = resolveAsaasBaseUrl()
  const environment = detectAsaasEnvironment()

  if (accountId === "legacy") {
    const apiKey = readStoredCredential("legacy", "API_KEY") ?? process.env.ASAAS_LEGACY_API_KEY
    if (!apiKey) {
      throw new Error(
        "Conta Asaas 'legacy' solicitada, mas ASAAS_LEGACY_API_KEY não está configurada " +
          "(pré-cutover: a conta legacy ainda não existe — ver [[10 — Fundações Multi-conta — Backend]] E2).",
      )
    }
    return {
      accountId: "legacy",
      apiKey,
      baseUrl,
      environment,
      webhookToken:
        readStoredCredential("legacy", "WEBHOOK_TOKEN") ?? process.env.ASAAS_LEGACY_WEBHOOK_TOKEN,
    }
  }

  return {
    accountId: "primary",
    apiKey: readStoredCredential("primary", "API_KEY") ?? process.env.ASAAS_API_KEY,
    baseUrl,
    environment,
    walletId: readStoredCredential("primary", "WALLET_ID") ?? process.env.ASAAS_WALLET_ID,
    webhookToken: readStoredCredential("primary", "WEBHOOK_TOKEN") ?? process.env.ASAAS_WEBHOOK_TOKEN,
  }
}
