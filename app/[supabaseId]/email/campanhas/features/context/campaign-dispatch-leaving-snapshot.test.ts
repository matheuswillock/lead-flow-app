import { describe, expect, it } from "bun:test"
import {
  takeLeavingSendingSnapshot,
  type LeavingSendingCampaign,
} from "./campaign-dispatch-leaving-snapshot"

describe("takeLeavingSendingSnapshot", () => {
  it("lê do Map síncrono mesmo quando o updater de setState ainda não rodou", () => {
    const previousSending = new Map<string, LeavingSendingCampaign>([
      [
        "camp-1",
        {
          id: "camp-1",
          name: "Agro",
          totalRecipients: 100,
          totalSent: 42,
          acceptedCount: 42,
          dispatchId: "dispatch-1",
          status: "sending",
        },
      ],
    ])

    // Simula o bug antigo: snapshot atribuído só dentro do updater, que ainda
    // não executou neste tick → leitura externa ficaria null.
    let leavingSnapshotFromUpdater: LeavingSendingCampaign | null = null
    const updaterRan = false
    if (updaterRan) {
      leavingSnapshotFromUpdater = previousSending.get("camp-1") ?? null
    }
    expect(leavingSnapshotFromUpdater).toBeNull()

    const leavingSnapshot = takeLeavingSendingSnapshot(previousSending, "camp-1", {
      name: "Agro - sul",
      errorMessage: null,
    })

    expect(leavingSnapshot).toMatchObject({
      id: "camp-1",
      name: "Agro - sul",
      totalSent: 42,
      acceptedCount: 42,
      dispatchId: "dispatch-1",
    })
    expect(previousSending.has("camp-1")).toBe(false)
  })

  it("retorna null quando a campanha não estava em sending", () => {
    const previousSending = new Map<string, LeavingSendingCampaign>()
    expect(takeLeavingSendingSnapshot(previousSending, "missing", { name: "X" })).toBeNull()
  })
})
