export const REAL_SEND_ACK = "I_ACKNOWLEDGE_REAL_WHATSAPP_SEND"
export const AUTHORIZED_TEST_RECIPIENT = "+15550123456"
export const BETHANIA_PROFILE = "bethania-local"

type RealSendSmokeEnvironment = {
  [key: string]: string | undefined
  BETHANIA_REAL_SEND_CONFIRM?: string
  BETHANIA_TEST_RECIPIENT?: string
  BETHANIA_HERMES_PROFILE?: string
}

export function assertRealSendSmokeAuthorization(env: RealSendSmokeEnvironment): {
  recipient: string
  profile: typeof BETHANIA_PROFILE
} {
  if (env.BETHANIA_REAL_SEND_CONFIRM !== REAL_SEND_ACK) {
    throw new Error("Set BETHANIA_REAL_SEND_CONFIRM to the explicit authorization value before sending.")
  }
  if (env.BETHANIA_TEST_RECIPIENT !== AUTHORIZED_TEST_RECIPIENT) {
    throw new Error("BETHANIA_TEST_RECIPIENT must match the authorized test recipient.")
  }
  const profile = env.BETHANIA_HERMES_PROFILE || BETHANIA_PROFILE
  if (profile !== BETHANIA_PROFILE) {
    throw new Error("Real-send smoke requires the dedicated Bethânia profile.")
  }
  return { recipient: AUTHORIZED_TEST_RECIPIENT, profile: BETHANIA_PROFILE }
}
