import { isGoogleConnectionActive } from "./connection"

export type GoogleConnectNotifyInput = {
  source: "login" | "account"
  hadConnectionId: boolean
  connection: { refreshToken: string | null; revokedAt: Date | null } | null
  previousGoogleEmail: string | null
  nextGoogleEmail: string | null
}

export function shouldNotifyGoogleConnected(input: GoogleConnectNotifyInput): boolean {
  const wasAlreadyConnected =
    input.hadConnectionId &&
    !!input.connection &&
    isGoogleConnectionActive(input.connection) &&
    input.previousGoogleEmail === input.nextGoogleEmail

  return (
    input.source === "account" &&
    !wasAlreadyConnected &&
    (input.previousGoogleEmail !== input.nextGoogleEmail || !input.hadConnectionId)
  )
}
