import { describe, expect, it } from "bun:test"
import { assertRealSendSmokeAuthorization } from "./real-send-smoke.guard"

const authorized = {
  BETHANIA_REAL_SEND_CONFIRM: "I_ACKNOWLEDGE_REAL_WHATSAPP_SEND",
  BETHANIA_TEST_RECIPIENT: "+15550123456",
  BETHANIA_HERMES_PROFILE: "bethania-local",
}

describe("Bethânia real-send smoke guard", () => {
  it("allows only the explicitly approved recipient and dedicated profile", () => {
    expect(assertRealSendSmokeAuthorization(authorized)).toEqual({
      recipient: "+15550123456",
      profile: "bethania-local",
    })
  })

  it("requires an explicit real-send acknowledgement", () => {
    expect(() => assertRealSendSmokeAuthorization({ ...authorized, BETHANIA_REAL_SEND_CONFIRM: "" })).toThrow("explicit authorization")
  })

  it("refuses a different recipient", () => {
    expect(() => assertRealSendSmokeAuthorization({ ...authorized, BETHANIA_TEST_RECIPIENT: "+5511999999999" })).toThrow("authorized test recipient")
  })

  it("refuses another Hermes profile", () => {
    expect(() => assertRealSendSmokeAuthorization({ ...authorized, BETHANIA_HERMES_PROFILE: "zap" })).toThrow("dedicated Bethânia profile")
  })
})
