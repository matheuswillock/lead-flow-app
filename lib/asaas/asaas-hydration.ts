import { asaasInstanceSelector, type AsaasAccountId } from "./asaas-account"

/**
 * Hidrata, de forma assíncrona, as credenciais Asaas gravadas no backoffice (cache curto) para que
 * `resolveAsaasAccount` (síncrono) as enxergue. Sem chave-mestra não existe credencial no banco
 * e o comportamento é o do ambiente, sem tocar o banco.
 */
export async function hydrateAsaasCredentials(accountId: AsaasAccountId): Promise<void> {
  if (!process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY?.trim()) return
  const runtime = await import(
    "@/app/api/useCases/paymentProviderPayment/providerCredentialRuntime"
  )
  await runtime.hydrateProviderCredentials(asaasInstanceSelector(accountId))
}
