import { describe, expect, it } from "bun:test"

/**
 * Contrato de polling/force para CampanhasHook — exercita a lógica pura de assinatura
 * e a regra de fila pendente sem montar o hook completo (depende de muitos providers).
 */

function buildDispatchProgressKey(params: {
  campaignId: string
  dispatchId: string
  status: string
  completionKind: string
  acceptedCount: number
  failedCount: number
  updatedAt: string
}) {
  return `${params.campaignId}:${params.dispatchId}:${params.status}:${params.completionKind}:${params.acceptedCount}:${params.failedCount}:${params.updatedAt}`
}

describe("campaign dispatch progress refresh contract", () => {
  it("assinatura muda quando acceptedCount avança sem realtime de campanha", () => {
    const before = buildDispatchProgressKey({
      campaignId: "c1",
      dispatchId: "d1",
      status: "sending",
      completionKind: "pending",
      acceptedCount: 0,
      failedCount: 0,
      updatedAt: "t1",
    })
    const after = buildDispatchProgressKey({
      campaignId: "c1",
      dispatchId: "d1",
      status: "sending",
      completionKind: "pending",
      acceptedCount: 100,
      failedCount: 0,
      updatedAt: "t2",
    })
    expect(before).not.toBe(after)
  })

  it("fila pendente: force durante fetch marca pending e reexecuta ao final", () => {
    let fetching = false
    let pendingForce = false
    let calls = 0

    function fetchCampaigns(options?: { force?: boolean }) {
      if (fetching) {
        if (options?.force) pendingForce = true
        return
      }
      fetching = true
      calls += 1
      // simula finally
      fetching = false
      if (pendingForce) {
        pendingForce = false
        fetchCampaigns({ force: true })
      }
    }

    fetching = true
    fetchCampaigns({ force: true })
    expect(pendingForce).toBe(true)
    expect(calls).toBe(0)

    fetching = false
    if (pendingForce) {
      pendingForce = false
      fetchCampaigns({ force: true })
    }
    expect(calls).toBe(1)
    expect(pendingForce).toBe(false)
  })
})
