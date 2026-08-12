import { describe, expect, it, mock } from "bun:test"
import { Output } from "@/lib/output"
import { runDispatchScheduledCronTick } from "./run-dispatch-scheduled-cron"

describe("runDispatchScheduledCronTick", () => {
  it("chama recoverStuck antes de resumeOrphan e só então dispatchScheduled", async () => {
    const callOrder: string[] = []
    const now = new Date("2026-08-11T20:00:00.000Z")

    const useCase = {
      recoverStuckSendingCampaigns: mock(async (receivedNow: Date) => {
        callOrder.push("recover")
        expect(receivedNow).toBe(now)
        return 0
      }),
      resumeOrphanSendingDispatches: mock(async (options: { now: Date }) => {
        callOrder.push("resume")
        expect(options.now).toBe(now)
        return 0
      }),
      dispatchScheduledCampaigns: mock(async () => {
        callOrder.push("dispatch")
        return new Output(true, ["ok"], [], { dispatched: 0 })
      }),
    }

    const result = await runDispatchScheduledCronTick(useCase, now)

    expect(callOrder).toEqual(["recover", "resume", "dispatch"])
    expect(useCase.recoverStuckSendingCampaigns).toHaveBeenCalledTimes(1)
    expect(useCase.resumeOrphanSendingDispatches).toHaveBeenCalledTimes(1)
    expect(useCase.dispatchScheduledCampaigns).toHaveBeenCalledTimes(1)
    expect(result.isValid).toBe(true)
  })
})
