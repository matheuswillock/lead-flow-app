import { describe, expect, test } from "bun:test"
import { getConversationDisplayName, getConversationSubtitle } from "./whatsappDisplay"

describe("WhatsApp conversation identity", () => {
  test("uses formatted phone then a clear fallback", () => {
    expect(getConversationDisplayName({ contactName: null, contactPhone: "5511999999999" })).not.toBe("Contato")
    expect(getConversationDisplayName({ contactName: null, contactPhone: "", externalChatId: "unknown" })).toBe("Número não disponível")
  })

  test("does not expose the legacy linked-contact label", () => {
    expect(getConversationSubtitle({ contactPhone: "", externalChatId: "123@lid" })).toBeNull()
  })
})
