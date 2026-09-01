import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { randomUUID } from "crypto"

/**
 * SPEC `30 — Motor de Métricas — Backend` (E2) registra o P1 de `openRate >
 * 100%`: o Resend pode entregar mais de um `email.opened` para o mesmo
 * destinatário (prefetch do Apple Mail Privacy Protection + abertura real do
 * cliente, ou reentrega do webhook), e cada `EmailEvent` tem `occurredAt`
 * diferente — a unique `[logId, type, occurredAt]` não segura duplicata
 * nenhuma nesse caso, só reentrega exata do mesmo timestamp.
 *
 * `EmailLogRepository.applyWebhookEvent` conta com uma segunda trava: o
 * `updateMany({ where: { id, openedAt: null } })` só reivindica o PRIMEIRO
 * evento de cada tipo, atomicamente, no banco. Um fake de Prisma reproduziria
 * o bug (dois "opened" com timestamps diferentes incrementando `totalOpened`
 * duas vezes) com a mesma facilidade que reproduziria o comportamento
 * correto — por isso este teste roda contra o Postgres de verdade.
 *
 * Rodar: `bun run test:integration:email-log:local` (Postgres em :55322).
 */
const RUN_INTEGRATION =
  process.env.EMAIL_LOG_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL)

let prisma: typeof import("@/app/api/infra/data/prisma").prisma
let emailLogRepository: typeof import("./EmailLogRepository").emailLogRepository

if (RUN_INTEGRATION) {
  ;({ prisma } = await import("@/app/api/infra/data/prisma"))
  ;({ emailLogRepository } = await import("./EmailLogRepository"))
}

const describeIntegration = RUN_INTEGRATION ? describe : describe.skip

describeIntegration("EmailLogRepository.applyWebhookEvent — dedupe de 'opened'", () => {
  const suffix = randomUUID().slice(0, 8)
  let profileId = ""
  let teamId = ""
  let templateId = ""
  let campaignId = ""
  let dispatchId = ""
  let logId = ""

  async function createOpenedLog(): Promise<string> {
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
      },
    })
    return log.id
  }

  async function applyOpened(id: string, occurredAt: Date) {
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
      metadata: {},
      eventId: randomUUID(),
    })
  }

  beforeAll(async () => {
    const profile = await prisma.profile.create({
      data: {
        supabaseId: randomUUID(),
        email: `opened-dedupe-${suffix}@example.com`,
        fullName: "Opened Dedupe Fixture",
        role: "manager",
      },
    })
    profileId = profile.id

    const team = await prisma.team.create({
      data: { name: `Opened Dedupe ${suffix}`, masterId: profileId, isDefault: false },
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
        name: `Campanha opened dedupe ${suffix}`,
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

  it("duas aberturas do mesmo destinatário em timestamps diferentes gravam openedAt uma vez só", async () => {
    logId = await createOpenedLog()
    const primeiraAbertura = new Date("2026-09-01T10:00:00.000Z")
    const segundaAbertura = new Date("2026-09-01T10:05:00.000Z")

    await applyOpened(logId, primeiraAbertura)
    await applyOpened(logId, segundaAbertura)

    const log = await prisma.emailLog.findUniqueOrThrow({
      where: { id: logId },
      select: { openedAt: true },
    })
    expect(log.openedAt?.toISOString()).toBe(primeiraAbertura.toISOString())

    const events = await prisma.emailEvent.findMany({
      where: { logId, type: "opened" },
    })
    expect(events).toHaveLength(2)
  })

  it("totalOpened da campanha e do disparo sobe exatamente 1 por destinatário, não por evento", async () => {
    const campaignBefore = await prisma.emailCampaign.findUniqueOrThrow({
      where: { id: campaignId },
      select: { totalOpened: true },
    })
    const dispatchBefore = await prisma.emailCampaignDispatch.findUniqueOrThrow({
      where: { id: dispatchId },
      select: { totalOpened: true },
    })

    const outroLogId = await createOpenedLog()
    await applyOpened(outroLogId, new Date("2026-09-01T11:00:00.000Z"))
    await applyOpened(outroLogId, new Date("2026-09-01T11:00:07.000Z"))
    await applyOpened(outroLogId, new Date("2026-09-01T11:00:13.000Z"))

    const campaignAfter = await prisma.emailCampaign.findUniqueOrThrow({
      where: { id: campaignId },
      select: { totalOpened: true },
    })
    const dispatchAfter = await prisma.emailCampaignDispatch.findUniqueOrThrow({
      where: { id: dispatchId },
      select: { totalOpened: true },
    })

    expect(campaignAfter.totalOpened - campaignBefore.totalOpened).toBe(1)
    expect(dispatchAfter.totalOpened - dispatchBefore.totalOpened).toBe(1)
  })
})
