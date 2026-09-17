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
const INTEGRATION_FLAG_SET = process.env.EMAIL_LOG_INTEGRATION_TEST === "1"

// Falhar alto, não pular em silêncio: `describe.skip` com o flag ligado mas
// sem `DATABASE_URL` sai "0 pass, 2 skip" — verde, mas sem provar nada.
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

  it("duas entregas concorrentes do webhook a partir do MESMO snapshot (openedAt null) só uma reivindica a abertura", async () => {
    // Chamar `applyOpened` (que refaz o SELECT antes de cada escrita) em
    // sequência não exercita a corrida de verdade: quando a segunda chamada
    // lê o log, a primeira já commitou e `openedAt` não é mais null. Este
    // teste captura o snapshot UMA vez com `openedAt: null` e usa o MESMO
    // objeto nas duas chamadas concorrentes — exatamente como dois workers
    // processando o mesmo webhook em paralelo (ou o prefetch do Apple Mail
    // Privacy Protection colidindo com a abertura real) veriam o log antes de
    // qualquer transação começar. Se a trava atômica no banco regredir para a
    // comparação antiga em memória (`log.openedAt` lido antes da transação),
    // as duas chamadas veem `null` e as duas reivindicam — este teste fica
    // vermelho onde o sequencial acima ficaria verde.
    const raceLogId = await createOpenedLog()
    const sharedSnapshot = await prisma.emailLog.findUniqueOrThrow({
      where: { id: raceLogId },
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
    expect(sharedSnapshot.openedAt).toBeNull()

    const campaignBefore = await prisma.emailCampaign.findUniqueOrThrow({
      where: { id: campaignId },
      select: { totalOpened: true },
    })

    const primeiraAbertura = new Date("2026-09-01T12:00:00.000Z")
    const segundaAbertura = new Date("2026-09-01T12:00:00.500Z")

    await Promise.all([
      emailLogRepository.applyWebhookEvent({
        log: sharedSnapshot,
        eventType: "opened",
        occurredAt: primeiraAbertura,
        metadata: {},
        eventId: randomUUID(),
      }),
      emailLogRepository.applyWebhookEvent({
        log: sharedSnapshot,
        eventType: "opened",
        occurredAt: segundaAbertura,
        metadata: {},
        eventId: randomUUID(),
      }),
    ])

    const campaignAfter = await prisma.emailCampaign.findUniqueOrThrow({
      where: { id: campaignId },
      select: { totalOpened: true },
    })
    expect(campaignAfter.totalOpened - campaignBefore.totalOpened).toBe(1)

    const log = await prisma.emailLog.findUniqueOrThrow({
      where: { id: raceLogId },
      select: { openedAt: true },
    })
    expect(log.openedAt).not.toBeNull()
    expect([primeiraAbertura.toISOString(), segundaAbertura.toISOString()]).toContain(
      log.openedAt!.toISOString()
    )
  })
})
