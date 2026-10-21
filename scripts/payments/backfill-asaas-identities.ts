/**
 * Backfill das identidades Asaas (cliente e assinatura, por conta primary/legacy) em
 * payment_provider_identities. Dry-run por padrão (contagem + checksum); só grava com --apply.
 * Aponta para o banco do DATABASE_URL atual: só rode contra o remoto com autorização explícita.
 *
 * Uso:
 *   bun run scripts/payments/backfill-asaas-identities.ts
 *   bun run scripts/payments/backfill-asaas-identities.ts --apply --batch-size=200
 */
import { asaasIdentityBackfillRepository } from "@/app/api/infra/data/repositories/paymentCharge/AsaasIdentityBackfillRepository"
import { paymentProviderIdentityRepository } from "@/app/api/infra/data/repositories/paymentProviderIdentity/PaymentProviderIdentityRepository"
import {
  parseBackfillArgs,
  runAsaasIdentityBackfill,
  type BackfillDependencies,
} from "./lib/asaasIdentityBackfill"

const environment = process.env.ASAAS_ENV === "sandbox" ? "DEV" : "PRODUCTION"

const dependencies: BackfillDependencies = {
  environment,
  listProfiles: (input) => asaasIdentityBackfillRepository.listProfiles(input),
  isBound: async (candidate) =>
    (await paymentProviderIdentityRepository.find({
      tenantId: candidate.tenantId,
      provider: "ASAAS",
      environment,
      externalAccountContext: candidate.account,
      identityType: candidate.kind,
      externalId: candidate.externalId,
    })) !== null,
  bind: (binding) => paymentProviderIdentityRepository.bind(binding),
}

async function main(): Promise<number> {
  const args = parseBackfillArgs(process.argv.slice(2))
  const result = await runAsaasIdentityBackfill(args, dependencies)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  return result.conflicts > 0 ? 1 : 0
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Falha inesperada"}\n`)
    process.exit(1)
  })
