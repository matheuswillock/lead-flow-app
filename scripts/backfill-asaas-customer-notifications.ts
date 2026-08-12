/**
 * Backfill idempotente: desabilita notificações Asaas ao pagador (D8/D9).
 *
 * Uso:
 *   bun scripts/backfill-asaas-customer-notifications.ts
 *   bun scripts/backfill-asaas-customer-notifications.ts --limit=50
 *   bun scripts/backfill-asaas-customer-notifications.ts --customer=cus_xxx
 */

import { prisma } from "@/app/api/infra/data/prisma"
import { asaasNotificationBackfillUseCase } from "@/app/api/useCases/asaasNotifications/AsaasNotificationBackfillUseCase"

function readArg(name: string): string | null {
  const prefix = `--${name}=`
  const hit = process.argv.find((arg) => arg.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : null
}

async function main() {
  const singleCustomer = readArg("customer")
  const limit = Number(readArg("limit") ?? "100")

  if (singleCustomer) {
    const output = await asaasNotificationBackfillUseCase.processCustomer(singleCustomer)
    console.info("[backfill-asaas-customer-notifications] single", {
      isValid: output.isValid,
      result: output.result,
      errorMessages: output.errorMessages,
    })
    if (!output.isValid) process.exitCode = 1
    return
  }

  const output = await asaasNotificationBackfillUseCase.processPending(
    Number.isFinite(limit) ? limit : 100
  )
  console.info("[backfill-asaas-customer-notifications] batch", {
    isValid: output.isValid,
    result: output.result,
    errorMessages: output.errorMessages,
  })
  if (!output.isValid) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error("[backfill-asaas-customer-notifications] fatal", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
