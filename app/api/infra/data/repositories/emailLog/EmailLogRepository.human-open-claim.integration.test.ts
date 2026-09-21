import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { randomUUID } from "crypto"
import type { EmailEventOrigin } from "@/lib/email/email-event-origin-classifier"

/**
 * Métrica de abertura em duas camadas (17/09): `openedAt`/`totalOpened`
 * continuam brutos (qualquer open reivindica, inclusive o pré-fetch do
 * provedor), e `humanOpenedAt`/`totalOpenedHuman` só sobem com open
 * classificado como HUMANO — inclusive quando a leitura humana chega DEPOIS
 * de o robô já ter reivindicado o bruto, que é exatamente o cenário medido em
 * produção (proxy do Gmail busca o pixel em segundos; a pessoa abre horas
 * depois).
 *
 * Roda contra Postgres real pelo mesmo motivo do teste de dedupe do
 * `openedAt`: um fake de Prisma reproduziria o bug de contagem dupla com a
 * mesma facilidade que o comportamento correto.
 *
 * Rodar: `bun run test:integration:email-log:local` (Postgres em :55322).
 */
const INTEGRATION_FLAG_SET = process.env.EMAIL_LOG_INTEGRATION_TEST === "1"

if (INTEGRATION_FLAG_SET && !process.env.DATABASE_URL) {
  throw new Error(
    "EMAIL_LOG_INTEGRATION_TEST=1 mas DATABASE_URL não está definido — rode via `bun run test:integration:email-log:local`."
  )
}

const RUN_INTEGRATION = INTEGRATION_FLAG_SET && Boolean(process.env.DATABASE_URL)

let prisma: typeof import("@/app/api/infra/data/prisma").prisma
let emailLogRepository: typeof import("./EmailLogRepository").emailLogRepository

if (RUN_INTEGRATION) {
  ;({ prisma } = await import("@/app/api/infra/data/prisma"))
  ;({ emailLogRepository } = await import("./EmailLogRepository"))
}

const describeIntegration = RUN_INTEGRATION ? describe : describe.skip

const BOT_ORIGIN: EmailEventOrigin = {
  classification: "bot",
  botSource: "gmail-proxy",
  uaFamily: "gmail-image-proxy",
}

const HUMAN_ORIGIN: EmailEventOrigin = {
  classification: "human",
  uaFamily: "outlook",
}

describeIntegration("EmailLogRepository.applyWebhookEvent — claim de abertura humana", () => {
  const suffix = randomUUID().slice(0, 8)
  let profileId = ""
  let teamId = ""
  let templateId = ""
  let campaignId = ""
  let dispatchId = ""

  async function createDeliveredLog(): Promise<string> {
    const log = await prisma.emailLog.create({
      data: {
        id: randomUUID(),
        teamId,
        campaignId,
        dispatchId,
        recipientEmail: `destinatario-${randomUUID().slice(0, 8)}@example.com`,
        recipientName: "Destinatário Teste",
        subject: "Assunto de teste",
        category: "campaign",
        status: "delivered",
        deliveredAt: new Date("2026-09-17T16:04:00.000Z"),
      },
    })
    return log.id
  }

  async function applyOpened(id: string, occurredAt: Date, origin: EmailEventOrigin) {
    const log = await prisma.emailLog.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        teamId: true,
        status: true,
        recipientEmail: true,
        recipientName: true,
        campaignId: true,
        dispatchId: true,
        deliveredAt: true,
        openedAt: true,
        clickedAt: true,
        bouncedAt: true,
        complainedAt: true,
      },
    })

    await emailLogRepository.applyWebhookEvent({
      log,
      eventType: "opened",
      occurredAt,
      metadata: { origin: { ...origin } },
      eventId: randomUUID(),
      origin,
    })
  }

  async function readCounters() {
    const campaign = await prisma.emailCampaign.findUniqueOrThrow({
      where: { id: campaignId },
      select: { totalOpened: true, totalOpenedHuman: true },
    })
    const dispatch = await prisma.emailCampaignDispatch.findUniqueOrThrow({
      where: { id: dispatchId },
      select: { totalOpened: true, totalOpenedHuman: true },
    })
    return { campaign, dispatch }
  }

  beforeAll(async () => {
    const profile = await prisma.profile.create({
      data: {
        supabaseId: randomUUID(),
        email: `human-open-${suffix}@example.com`,
        fullName: "Human Open Fixture",
        role: "manager",
      },
    })
    profileId = profile.id

    const team = await prisma.team.create({
      data: { name: `Human Open ${suffix}`, masterId: profileId, isDefault: false },
    })
    teamId = team.id

    const templateGroupId = randomUUID()
    const template = await prisma.emailTemplate.create({
      data: {
        id: templateGroupId,
        teamId,
        createdBy: profileId,
        name: "Template de teste",
        subject: "Assunto",
        html: "<p>Corpo</p>",
        versionGroupId: templateGroupId,
      },
    })
    templateId = template.id

    const campaign = await prisma.emailCampaign.create({
      data: {
        teamId,
        createdBy: profileId,
        name: `Campanha human open ${suffix}`,
        templateId,
        status: "sent",
      },
    })
    campaignId = campaign.id

    const dispatch = await prisma.emailCampaignDispatch.create({
      data: {
        campaignId,
        teamId,
        dispatchNumber: 1,
        templateId,
        templateVersionNumber: 1,
        templateName: "Template de teste",
        templateSubject: "Assunto",
        templateHtml: "<p>Corpo</p>",
        triggeredBy: profileId,
        status: "completed",
      },
    })
    dispatchId = dispatch.id
  })

  afterAll(async () => {
    if (!teamId) return
    await prisma.emailEvent.deleteMany({ where: { log: { teamId } } })
    await prisma.emailLog.deleteMany({ where: { teamId } })
    await prisma.emailCampaignDispatch.deleteMany({ where: { teamId } })
    await prisma.emailCampaign.deleteMany({ where: { teamId } })
    await prisma.emailTemplate.deleteMany({ where: { teamId } })
    await prisma.team.deleteMany({ where: { id: teamId } })
    await prisma.profile.deleteMany({ where: { id: profileId } })
    await prisma.$disconnect()
  })

  it("pré-fetch bot reivindica o bruto; a leitura humana tardia reivindica humanOpenedAt sem duplicar o bruto", async () => {
    const logId = await createDeliveredLog()
    const before = await readCounters()

    const prefetchBot = new Date("2026-09-17T16:04:05.000Z")
    const humanLate = new Date("2026-09-17T17:39:13.477Z")

    await applyOpened(logId, prefetchBot, BOT_ORIGIN)

    const afterBot = await prisma.emailLog.findUniqueOrThrow({
      where: { id: logId },
      select: { openedAt: true, humanOpenedAt: true },
    })
    expect(afterBot.openedAt?.toISOString()).toBe(prefetchBot.toISOString())
    expect(afterBot.humanOpenedAt).toBeNull()

    await applyOpened(logId, humanLate, HUMAN_ORIGIN)

    const afterHuman = await prisma.emailLog.findUniqueOrThrow({
      where: { id: logId },
      select: { openedAt: true, humanOpenedAt: true },
    })
    // O bruto continua com o timestamp do primeiro open (semântica intocada).
    expect(afterHuman.openedAt?.toISOString()).toBe(prefetchBot.toISOString())
    expect(afterHuman.humanOpenedAt?.toISOString()).toBe(humanLate.toISOString())

    const after = await readCounters()
    expect(after.campaign.totalOpened - before.campaign.totalOpened).toBe(1)
    expect(after.campaign.totalOpenedHuman - before.campaign.totalOpenedHuman).toBe(1)
    expect(after.dispatch.totalOpened - before.dispatch.totalOpened).toBe(1)
    expect(after.dispatch.totalOpenedHuman - before.dispatch.totalOpenedHuman).toBe(1)

    // As DUAS aberturas ficam persistidas como eventos, cada uma com a sua
    // classificação — era exatamente o que o corte de occurredAt escondia.
    const events = await prisma.emailEvent.findMany({
      where: { logId, type: "opened" },
      orderBy: { occurredAt: "asc" },
      select: { metadata: true },
    })
    expect(events).toHaveLength(2)
    expect((events[0]?.metadata as { origin?: { classification?: string } })?.origin?.classification).toBe("bot")
    expect((events[1]?.metadata as { origin?: { classification?: string } })?.origin?.classification).toBe("human")
  })

  it("totalOpenedHuman sobe exatamente 1 por destinatário mesmo com múltiplos opens humanos", async () => {
    const logId = await createDeliveredLog()
    const before = await readCounters()

    await applyOpened(logId, new Date("2026-09-17T18:00:00.000Z"), HUMAN_ORIGIN)
    await applyOpened(logId, new Date("2026-09-17T18:05:00.000Z"), HUMAN_ORIGIN)
    await applyOpened(logId, new Date("2026-09-17T19:12:00.000Z"), HUMAN_ORIGIN)

    const after = await readCounters()
    expect(after.campaign.totalOpenedHuman - before.campaign.totalOpenedHuman).toBe(1)
    expect(after.dispatch.totalOpenedHuman - before.dispatch.totalOpenedHuman).toBe(1)
    // O primeiro open humano também era o primeiro bruto: os dois contadores
    // sobem juntos uma única vez.
    expect(after.campaign.totalOpened - before.campaign.totalOpened).toBe(1)

    const log = await prisma.emailLog.findUniqueOrThrow({
      where: { id: logId },
      select: { humanOpenedAt: true },
    })
    expect(log.humanOpenedAt?.toISOString()).toBe("2026-09-17T18:00:00.000Z")
  })

  it("dois opens humanos concorrentes do MESMO snapshot só reivindicam humanOpenedAt uma vez", async () => {
    const logId = await createDeliveredLog()
    const sharedSnapshot = await prisma.emailLog.findUniqueOrThrow({
      where: { id: logId },
      select: {
        id: true,
        teamId: true,
        status: true,
        recipientEmail: true,
        recipientName: true,
        campaignId: true,
        dispatchId: true,
        deliveredAt: true,
        openedAt: true,
        clickedAt: true,
        bouncedAt: true,
        complainedAt: true,
      },
    })

    const before = await readCounters()

    await Promise.all([
      emailLogRepository.applyWebhookEvent({
        log: sharedSnapshot,
        eventType: "opened",
        occurredAt: new Date("2026-09-17T20:00:00.000Z"),
        metadata: { origin: { ...HUMAN_ORIGIN } },
        eventId: randomUUID(),
        origin: HUMAN_ORIGIN,
      }),
      emailLogRepository.applyWebhookEvent({
        log: sharedSnapshot,
        eventType: "opened",
        occurredAt: new Date("2026-09-17T20:00:00.500Z"),
        metadata: { origin: { ...HUMAN_ORIGIN } },
        eventId: randomUUID(),
        origin: HUMAN_ORIGIN,
      }),
    ])

    const after = await readCounters()
    expect(after.campaign.totalOpenedHuman - before.campaign.totalOpenedHuman).toBe(1)
    expect(after.dispatch.totalOpenedHuman - before.dispatch.totalOpenedHuman).toBe(1)
  })

  it("open bot sozinho nunca toca humanOpenedAt nem totalOpenedHuman", async () => {
    const logId = await createDeliveredLog()
    const before = await readCounters()

    await applyOpened(logId, new Date("2026-09-17T21:00:00.000Z"), BOT_ORIGIN)
    await applyOpened(logId, new Date("2026-09-17T21:00:07.000Z"), {
      classification: "unknown",
    })

    const log = await prisma.emailLog.findUniqueOrThrow({
      where: { id: logId },
      select: { openedAt: true, humanOpenedAt: true },
    })
    expect(log.openedAt).not.toBeNull()
    expect(log.humanOpenedAt).toBeNull()

    const after = await readCounters()
    expect(after.campaign.totalOpened - before.campaign.totalOpened).toBe(1)
    expect(after.campaign.totalOpenedHuman - before.campaign.totalOpenedHuman).toBe(0)
  })
})
