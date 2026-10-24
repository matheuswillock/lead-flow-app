import { CredentialReadError } from "@/lib/payment-provider/credential-resolver"
import { loadCredentialRuntime } from "@/lib/payment-provider/credential-runtime-loader"
import { asaasInstanceSelector, type AsaasAccountId } from "./asaas-account"

/**
 * Hidrata, de forma assíncrona, as credenciais Asaas gravadas no backoffice (cache curto) para que
 * `resolveAsaasAccount` (síncrono) as enxergue. Sem chave-mestra não existe credencial no banco
 * e o comportamento é o do ambiente, sem tocar o banco.
 *
 * ESTRITA: lança `CredentialReadError` se o banco não puder ser lido e não houver entrada stale
 * válida. Use-a onde falhar fechado é obrigatório (autenticação do webhook).
 */
export async function hydrateAsaasCredentials(accountId: AsaasAccountId): Promise<void> {
  if (!process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY?.trim()) return
  const runtime = await loadCredentialRuntime()
  await runtime.hydrateProviderCredentials(asaasInstanceSelector(accountId))
}

type FallbackLog = (event: string, fields: Record<string, unknown>) => void

/**
 * Para CHAMADAS DE SAÍDA: banco indisponível sem entrada stale degrada para as credenciais do
 * ambiente (disponibilidade) com log estruturado, sem valores. Credencial gravada e ilegível
 * continua lançando (não é indisponibilidade do banco).
 */
export async function hydrateAsaasCredentialsOrEnvFallback(
  accountId: AsaasAccountId,
  log: FallbackLog = (event, fields) => console.warn(`[Asaas] ${event}`, fields),
): Promise<void> {
  try {
    await hydrateAsaasCredentials(accountId)
  } catch (error) {
    if (!(error instanceof CredentialReadError)) throw error
    log("asaas-credentials-fallback-env", { asaasAccount: accountId, cause: error.cause })
  }
}
