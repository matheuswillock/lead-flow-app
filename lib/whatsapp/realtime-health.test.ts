import { describe, expect, it } from "bun:test"
import { computeWhatsAppRealtimeHealth } from "./realtime-health"

describe("computeWhatsAppRealtimeHealth", () => {
  it("saudável com conversas SUBSCRIBED sem conversa aberta", () => {
    expect(
      computeWhatsAppRealtimeHealth({
        convsStatus: "SUBSCRIBED",
        msgsStatus: null,
        hasSelectedConversation: false,
        msgsInitializing: false,
      })
    ).toBe(true)
  })

  it("degradado quando conversas não SUBSCRIBED", () => {
    expect(
      computeWhatsAppRealtimeHealth({
        convsStatus: "TIMED_OUT",
        msgsStatus: "SUBSCRIBED",
        hasSelectedConversation: true,
        msgsInitializing: false,
      })
    ).toBe(false)
  })

  it("tolera msgsInitializing com msgsStatus null", () => {
    expect(
      computeWhatsAppRealtimeHealth({
        convsStatus: "SUBSCRIBED",
        msgsStatus: null,
        hasSelectedConversation: true,
        msgsInitializing: true,
      })
    ).toBe(true)
  })
})
