import type { Output } from "@/lib/output"

export type DispatchScheduledCronUseCase = {
  recoverStuckSendingCampaigns: (now: Date) => Promise<number>
  resumeOrphanSendingDispatches: (options: { now: Date }) => Promise<number>
  dispatchScheduledCampaigns: () => Promise<Output>
}

/**
 * Orquestra um tick do cron `dispatch-scheduled`.
 *
 * `recoverStuck` roda **antes** de `resumeOrphan` para que campanhas
 * `sending` sem dispatch voltem a `draft` e o restante dos lotes (>= 30 min)
 * seja acordado na fila overflow — o timeout não marca `failed`.
 */
export async function runDispatchScheduledCronTick(
  useCase: DispatchScheduledCronUseCase,
  now = new Date()
): Promise<Output> {
  await useCase.recoverStuckSendingCampaigns(now)
  await useCase.resumeOrphanSendingDispatches({ now })
  return useCase.dispatchScheduledCampaigns()
}
