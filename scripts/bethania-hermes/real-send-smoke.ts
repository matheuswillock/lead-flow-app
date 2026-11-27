import { randomBytes, randomUUID } from "node:crypto"
import { once } from "node:events"
import { createBethaniaWebhookServer } from "./BethaniaWebhookServer"
import { createHermesWhatsAppSender } from "./HermesWhatsAppSender"
import { assertRealSendSmokeAuthorization } from "./real-send-smoke.guard"
import { sendBethaniaTransportEvent } from "../../lib/bethania/signed-sender-client"

const BRIDGE_HEALTH_URL = "http://127.0.0.1:3012/health"
const TEST_MESSAGE = "Teste E2E da Bethânia: se você recebeu esta mensagem, o envio pelo perfil dedicado está funcionando."

async function assertBridgeHealthy(): Promise<void> {
  const response = await fetch(BRIDGE_HEALTH_URL, { signal: AbortSignal.timeout(5_000) })
  if (!response.ok) throw new Error("WhatsApp bridge health check failed.")
  const body = (await response.json()) as { status?: string }
  if (body.status !== "connected") throw new Error("WhatsApp bridge is not connected.")
}

async function closeServer(server: ReturnType<typeof createBethaniaWebhookServer>): Promise<void> {
  if (!server.listening) return
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

export async function runRealSendSmoke(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const { recipient, profile } = assertRealSendSmokeAuthorization(env)
  await assertBridgeHealthy()

  const secret = randomBytes(32).toString("hex")
  const server = createBethaniaWebhookServer({
    secret,
    sender: createHermesWhatsAppSender(profile),
  })

  try {
    server.listen(0, "127.0.0.1")
    await once(server, "listening")
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("Local sender did not bind to an ephemeral port.")

    await sendBethaniaTransportEvent(
      {
        eventId: `real-send-smoke-${randomUUID()}`,
        eventType: "schedule.created_or_rescheduled",
        phone: recipient,
        message: TEST_MESSAGE,
      },
      {
        baseUrl: `http://127.0.0.1:${address.port}`,
        secret,
      },
    )
  } finally {
    await closeServer(server)
  }
}

if (import.meta.main) {
  void runRealSendSmoke().then(
    () => {
      process.stdout.write("Bethânia smoke: Hermes CLI aceitou uma mensagem. Confirme o recebimento no aparelho; a entrega não é comprovada pelo aceite do CLI.\n")
    },
    () => {
      process.stderr.write("Bethânia smoke falhou antes de confirmar o handoff; detalhes de transporte foram omitidos.\n")
      process.exitCode = 1
    },
  )
}
