import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { randomUUID } from "crypto"
import type { EmailEventOrigin } from "@/lib/email/email-event-origin-classifier"

/**
 * Clique com origem classificada como BOT não conta (17/09): scanner
 * corporativo que segue os links do e-mail antes do destinatário não pode
 * carimbar `EmailLog.clickedAt` nem subir `totalClicked` — seria a mesma
 * mentira de engajamento que o filtro de robôs existe para desfazer.
 *
 * O contrato travado aqui tem três partes, e as três precisam de Postgres real
 * (o claim é `updateMany` condicional dentro de transação; um fake de Prisma
 * reproduziria o bug com a mesma facilidade que o acerto):
 *   1. clique de robô: `EmailEvent` gravado, `clickedAt` intocado, contador parado;
 *   2. clique humano posterior ainda encontra `clickedAt` nulo e reivindica;
 *   3. clique sem classificação (first-party, histórico) continua contando.
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

const SCANNER_ORIGIN: EmailEventOrigin = {
  classification: "bot",
  botSource: "scanner",
  uaFamily: "scanner",
}

const HUMAN_ORIGIN: EmailEventOrigin = {
  classification: "human",
  uaFamily: "chrome",
}

describeIntegration("EmailLogRepository.applyWebhookEvent — clique de robô não conta", () => {
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

  async function applyClicked(id: string, occurredAt: Date, origin?: EmailEventOrigin) {
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
      eventType: "clicked",
      occurredAt,
      metadata: {
        link: "https://exemplo.com.br/formulario",
        ...(origin ? { origin: { ...origin } } : {}),
      },
      eventId: randomUUID(),
      origin,
    })
  }

  async function readCounters() {
    const campaign = await prisma.emailCampaign.findUniqueOrThrow({
      where: { id: campaignId },
      select: { totalClicked: true },
    })
    const dispatch = await prisma.emailCampaignDispatch.findUniqueOrThrow({
      where: { id: dispatchId },
      select: { totalClicked: true },
    })
    return { campaign, dispatch }
  }

  beforeAll(async () => {
    const profile = await prisma.profile.create({
      data: {
        supabaseId: randomUUID(),
        email: `bot-click-${suffix}@example.com`,
        fullName: "Bot Click Fixture",
        role: "manager",
      },
    })
    profileId = profile.id

    const team = await prisma.team.create({
      data: { name: `Bot Click ${suffix}`, masterId: profileId, isDefault: false },
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
        name: `Campanha bot click ${suffix}`,
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

  it("clique de scanner não carimba clickedAt, não promove status e não sobe totalClicked", async () => {
    const logId = await createDeliveredLog()
    const before = await readCounters()

    await applyClicked(logId, new Date("2026-09-17T16:04:03.000Z"), SCANNER_ORIGIN)

    const log = await prisma.emailLog.findUniqueOrThrow({
      where: { id: logId },
      select: { clickedAt: true, status: true },
    })
    expect(log.clickedAt).toBeNull()
    expect(log.status).toBe("delivered")

    const after = await readCounters()
    expect(after.campaign.totalClicked - before.campaign.totalClicked).toBe(0)
    expect(after.dispatch.totalClicked - before.dispatch.totalClicked).toBe(0)

    // A trilha continua: o clique do robô existe como evento classificado.
    const events = await prisma.emailEvent.findMany({
      where: { logId, type: "clicked" },
      select: { metadata: true },
    })
    expect(events).toHaveLength(1)
    expect(
      (events[0]?.metadata as { origin?: { classification?: string } })?.origin?.classification
    ).toBe("bot")
  })

  it("clique humano depois do scanner ainda reivindica clickedAt e sobe totalClicked uma vez", async () => {
    const logId = await createDeliveredLog()
    const before = await readCounters()

    await applyClicked(logId, new Date("2026-09-17T16:04:03.000Z"), SCANNER_ORIGIN)

    const humanClick = new Date("2026-09-17T18:22:41.000Z")
    await applyClicked(logId, humanClick, HUMAN_ORIGIN)
    await applyClicked(logId, new Date("2026-09-17T18:25:00.000Z"), HUMAN_ORIGIN)

    const log = await prisma.emailLog.findUniqueOrThrow({
      where: { id: logId },
      select: { clickedAt: true, status: true },
    })
    expect(log.clickedAt?.toISOString()).toBe(humanClick.toISOString())
    expect(log.status).toBe("clicked")

    const after = await readCounters()
    expect(after.campaign.totalClicked - before.campaign.totalClicked).toBe(1)
    expect(after.dispatch.totalClicked - before.dispatch.totalClicked).toBe(1)
  })

  it("clique sem classificação de origem (first-party/histórico) continua contando", async () => {
    const logId = await createDeliveredLog()
    const before = await readCounters()

    const click = new Date("2026-09-17T19:00:00.000Z")
    await applyClicked(logId, click)

    const log = await prisma.emailLog.findUniqueOrThrow({
      where: { id: logId },
      select: { clickedAt: true, status: true },
    })
    expect(log.clickedAt?.toISOString()).toBe(click.toISOString())
    expect(log.status).toBe("clicked")

    const after = await readCounters()
    expect(after.campaign.totalClicked - before.campaign.totalClicked).toBe(1)
  })
})
