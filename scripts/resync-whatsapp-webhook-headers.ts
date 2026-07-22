/**
 * Reaplica webhook Evolution com header `apikey` para configs product existentes.
 *
 * Dry-run (default):
 *   bunx tsx scripts/resync-whatsapp-webhook-headers.ts
 *
 * Aplicar:
 *   bunx tsx scripts/resync-whatsapp-webhook-headers.ts --confirm
 *
 * Requer `.env` com DATABASE_URL. Opcionalmente lê `.env.evolution`
 * (AUTHENTICATION_API_KEY / SERVER_URL) quando EVO_API_* não está no `.env`.
 */
import "dotenv/config"
import { config as loadDotenv } from "dotenv"
import { resolve } from "node:path"
import { prisma } from "@/app/api/infra/data/prisma"
import { evoApiService } from "@/app/api/services/whatsapp/evo/EvoApiService"

loadDotenv({ path: resolve(process.cwd(), ".env.evolution") })

if (!process.env.EVO_API_KEY?.trim() && process.env.AUTHENTICATION_API_KEY?.trim()) {
  process.env.EVO_API_KEY = process.env.AUTHENTICATION_API_KEY.trim()
}
if (!process.env.EVO_API_BASE_URL?.trim() && process.env.SERVER_URL?.trim()) {
  process.env.EVO_API_BASE_URL = process.env.SERVER_URL.trim().replace(/\/$/, "")
}

const shouldApply = process.argv.includes("--confirm")

function resolveWebhookBaseUrl(): string {
  const webhookPublic = process.env.EVO_WEBHOOK_PUBLIC_URL?.replace(/\/$/, "")
  if (webhookPublic) return webhookPublic
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL (ou EVO_WEBHOOK_PUBLIC_URL) é obrigatório")
  return appUrl.replace(/\/$/, "")
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      "DATABASE_URL ausente. Confirme que o arquivo .env existe na raiz do projeto."
    )
  }

  const configs = await prisma.teamWhatsAppConfig.findMany({
    where: {
      primaryConfigId: null,
    },
    select: {
      id: true,
      teamId: true,
      instanceName: true,
      webhookSecret: true,
      hostBaseUrl: true,
      status: true,
    },
    orderBy: { createdAt: "asc" },
  })

  console.info(
    `[resync-whatsapp-webhook-headers] ${configs.length} config(s) candidata(s). mode=${shouldApply ? "apply" : "dry-run"}`
  )

  let ok = 0
  let failed = 0

  for (const config of configs) {
    if (!config.webhookSecret || !config.instanceName) {
      continue
    }

    const webhookUrl = `${resolveWebhookBaseUrl()}/api/webhooks/whatsapp/evolution/${config.webhookSecret}`
    console.info(`[resync] ${config.instanceName} (${config.id}) status=${config.status}`)

    if (!shouldApply) {
      ok += 1
      continue
    }

    try {
      await evoApiService.setWebhook({
        instanceName: config.instanceName,
        webhookUrl,
        hostBaseUrl: config.hostBaseUrl ?? undefined,
      })
      ok += 1
    } catch (error) {
      failed += 1
      console.error(`[resync] falhou ${config.instanceName}`, error)
    }
  }

  console.info(`[resync-whatsapp-webhook-headers] ok=${ok} failed=${failed}`)
  if (!shouldApply) {
    console.info("Dry-run. Reexecute com --confirm para aplicar.")
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
