import { describe, expect, it } from "bun:test"
import { shouldNotifyGoogleConnected } from "./should-notify-google-connect"

describe("shouldNotifyGoogleConnected", () => {
  const activeConnection = { refreshToken: "rt", revokedAt: null }

  it("does not notify on login when already connected with same email", () => {
    expect(
      shouldNotifyGoogleConnected({
        source: "login",
        hadConnectionId: true,
        connection: activeConnection,
        previousGoogleEmail: "user@gmail.com",
        nextGoogleEmail: "user@gmail.com",
      })
    ).toBe(false)
  })

  it("does not notify on login for first-time token refresh", () => {
    expect(
      shouldNotifyGoogleConnected({
        source: "login",
        hadConnectionId: false,
        connection: null,
        previousGoogleEmail: null,
        nextGoogleEmail: "user@gmail.com",
      })
    ).toBe(false)
  })

  it("notifies on account reconnect when calendar was disconnected", () => {
    expect(
      shouldNotifyGoogleConnected({
        source: "account",
        hadConnectionId: false,
        connection: null,
        previousGoogleEmail: null,
        nextGoogleEmail: "user@gmail.com",
      })
    ).toBe(true)
  })

  it("does not notify on account when connection is still active", () => {
    expect(
      shouldNotifyGoogleConnected({
        source: "account",
        hadConnectionId: true,
        connection: activeConnection,
        previousGoogleEmail: "user@gmail.com",
        nextGoogleEmail: "user@gmail.com",
      })
    ).toBe(false)
  })
})
