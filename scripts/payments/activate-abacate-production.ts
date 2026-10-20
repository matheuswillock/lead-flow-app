/**
 * Ativa a linha ABACATE_PAY/PRODUCTION de payment_provider_configs, um passo de rollout
 * por vez (DISABLED -> SANDBOX_VALIDATED -> APPROVED -> ACTIVE), com enabled e isDefault.
 *
 * Dry-run por padrão; só escreve com --apply. Exige a revisão atual (--expected-revision)
 * e health HEALTHY (rode antes POST /api/v1/backoffice/payment-providers/config/health-check).
 * Aponta para o banco do DATABASE_URL atual: só rode contra o remoto com autorização explícita.
 *
 * Uso:
 *   bun run scripts/payments/activate-abacate-production.ts --expected-revision=4
 *   bun run scripts/payments/activate-abacate-production.ts --expected-revision=4 --apply
 */
import { paymentProviderConfigRepository } from "@/app/api/infra/data/repositories/paymentProviderConfig/PaymentProviderConfigRepository"
import {
  parseActivationArgs,
  runAbacateProductionActivation,
  type ActivationDependencies,
} from "./lib/abacateProductionActivation"

const dependencies: ActivationDependencies = {
  getConfig: async () => {
    const records = await paymentProviderConfigRepository.list("PRODUCTION")
    return records.find((record) => record.provider === "ABACATE_PAY") ?? null
  },
  applyPatch: (patch) =>
    paymentProviderConfigRepository.update({
      provider: "ABACATE_PAY",
      environment: "PRODUCTION",
      patch,
    }),
}

async function main(): Promise<number> {
  const args = parseActivationArgs(process.argv.slice(2))
  const result = await runAbacateProductionActivation(args, dependencies)
  process.stdout.write(`${JSON.stringify({ mode: args.apply ? "apply" : "dry-run", ...result }, null, 2)}\n`)
  return result.ok ? 0 : 1
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Falha inesperada"}\n`)
    process.exit(1)
  })
