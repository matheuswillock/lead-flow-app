import { createBethaniaWebhookServer } from "./BethaniaWebhookServer"
import { createHermesWhatsAppSender } from "./HermesWhatsAppSender"

const secret = process.env.BETHANIA_WEBHOOK_SECRET
if (!secret) throw new Error("Set BETHANIA_WEBHOOK_SECRET before starting the Bethânia sender")

const port = Number(process.env.BETHANIA_WEBHOOK_PORT ?? "8787")
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("BETHANIA_WEBHOOK_PORT must be a valid TCP port")

const server = createBethaniaWebhookServer({
  secret,
  sender: createHermesWhatsAppSender(process.env.BETHANIA_HERMES_PROFILE ?? "bethania-local"),
})

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Bethânia sender listening on 127.0.0.1:${port}\n`)
})

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => server.close(() => process.exit(0)))
}
