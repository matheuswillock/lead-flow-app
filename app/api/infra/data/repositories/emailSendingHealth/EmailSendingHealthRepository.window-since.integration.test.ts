import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { randomUUID } from "crypto"

/**
 * `getWindowMetricsSince` é a correção do achado P1 do codex no PR #1204: a
 * janela líquida pós-liberação passou a ser MEDIDA desde `releaseBaseline.at`
 * em vez de subtraída de agregados (a subtração zerava sob churn de volume).
 *
 * O teste do UseCase (`EvaluateTeamSendingHealthUseCase.test.ts`) injeta a
 * contagem por um repositório fake — ele prova a orquestração, não a consulta.
 * Um fake devolveria o número certo mesmo se a query real errasse o recorte de
 * data, o escopo de time, o tipo de bounce ou a deduplicação por `logId`.
 * Por isso as quatro dimensões do recorte são exercitadas aqui contra o
 * Postgres de verdade (achado do codex no PR #1205).
 *
 * Rodar: `bun run test:integration:sending-health:local` (Postgres em :55322).
 */
const INTEGRATION_FLAG_SET = process.env.SENDING_HEALTH_INTEGRATION_TEST === "1"

// Falhar alto, não pular em silêncio: `describe.skip` com o flag ligado mas sem
// `DATABASE_URL` sai verde sem provar nada.
if (INTEGRATION_FLAG_SET && !process.env.DATABASE_URL) {
  throw new Error(
    "SENDING_HEALTH_INTEGRATION_TEST=1 mas DATABASE_URL não está definido — rode via `bun run test:integration:sending-health:local`."
  )
}

const RUN_INTEGRATION = INTEGRATION_FLAG_SET && Boolean(process.env.DATABASE_URL)

let prisma: typeof import("@/app/api/infra/data/prisma").prisma
let emailSendingHealthRepository: typeof import("./EmailSendingHealthRepository").emailSendingHealthRepository

if (RUN_INTEGRATION) {
  ;({ prisma } = await import("@/app/api/infra/data/prisma"))
  ;({ emailSendingHealthRepository } = await import("./EmailSendingHealthRepository"))
}

const describeIntegration = RUN_INTEGRATION ? describe : describe.skip

/** Liberação manual fictícia; tudo antes disso é "o incidente já liberado". */
const RELEASED_AT = new Date("2026-09-10T12:00:00.000Z")
const NOW = new Date("2026-09-12T12:00:00.000Z")
const BEFORE_RELEASE = new Date("2026-09-09T12:00:00.000Z")
const AFTER_RELEASE = new Date("2026-09-11T12:00:00.000Z")
const AFTER_NOW = new Date("2026-09-13T12:00:00.000Z")

describeIntegration("EmailSendingHealthRepository.getWindowMetricsSince", () => {
  const suffix = randomUUID().slice(0, 8)
  let profileId = ""
  /** Time sob medição. */
  let teamId = ""
  /** Time vizinho — nada dele pode vazar para a contagem. */
  let otherTeamId = ""
  let otherProfileId = ""

  async function createLog(params: {
    teamId: string
    sentAt: Date | null
  }): Promise<string> {
    const log = await prisma.emailLog.create({
      data: {
        id: randomUUID(),
        teamId: params.teamId,
        recipientEmail: `destinatario-${randomUUID().slice(0, 8)}@example.com`,
        recipientName: "Destinatário Teste",
        subject: "Assunto de teste",
        category: "campaign",
        status: "sent",
        sentAt: params.sentAt,
      },
    })
    return log.id
  }

  async function addEvent(params: {
    logId: string
    type: "bounced" | "complained"
    occurredAt: Date
    bounceType?: string
  }) {
    await prisma.emailEvent.create({
      data: {
        id: randomUUID(),
        logId: params.logId,
        type: params.type,
        occurredAt: params.occurredAt,
        metadata: params.bounceType ? { bounceType: params.bounceType } : undefined,
      },
    })
  }

  beforeAll(async () => {
    const profile = await prisma.profile.create({
      data: {
        supabaseId: randomUUID(),
        email: `sending-health-window-${suffix}@example.com`,
        fullName: "Sending Health Window Fixture",
        role: "manager",
      },
    })
    profileId = profile.id
    teamId = (
      await prisma.team.create({
        data: { name: `Sending Health Window ${suffix}`, masterId: profileId, isDefault: false },
      })
    ).id

    const otherProfile = await prisma.profile.create({
      data: {
        supabaseId: randomUUID(),
        email: `sending-health-window-other-${suffix}@example.com`,
        fullName: "Sending Health Window Other Fixture",
        role: "manager",
      },
    })
    otherProfileId = otherProfile.id
    otherTeamId = (
      await prisma.team.create({
        data: {
          name: `Sending Health Window Other ${suffix}`,
          masterId: otherProfileId,
          isDefault: false,
        },
      })
    ).id

    // --- Dentro do recorte (devem contar) ---
    // 2 envios depois da liberação; um deles com hard bounce, outro com reclamação.
    const hardBouncedLog = await createLog({ teamId, sentAt: AFTER_RELEASE })
    await addEvent({
      logId: hardBouncedLog,
      type: "bounced",
      occurredAt: AFTER_RELEASE,
      bounceType: "Permanent",
    })
    // Reentrega do MESMO bounce em outro timestamp: dedupe por logId tem que
    // contar 1, não 2.
    await addEvent({
      logId: hardBouncedLog,
      type: "bounced",
      occurredAt: new Date(AFTER_RELEASE.getTime() + 60_000),
      bounceType: "Permanent",
    })

    const complainedLog = await createLog({ teamId, sentAt: AFTER_RELEASE })
    await addEvent({ logId: complainedLog, type: "complained", occurredAt: AFTER_RELEASE })

    // --- Fora do recorte (NÃO podem contar) ---
    // (a) recorte de data — anterior à liberação
    const preReleaseLog = await createLog({ teamId, sentAt: BEFORE_RELEASE })
    await addEvent({
      logId: preReleaseLog,
      type: "bounced",
      occurredAt: BEFORE_RELEASE,
      bounceType: "Permanent",
    })
    await addEvent({ logId: preReleaseLog, type: "complained", occurredAt: BEFORE_RELEASE })

    // (b) recorte de data — posterior a `now`
    const futureLog = await createLog({ teamId, sentAt: AFTER_NOW })
    await addEvent({
      logId: futureLog,
      type: "bounced",
      occurredAt: AFTER_NOW,
      bounceType: "Permanent",
    })

    // (c) tipo de bounce — soft bounce não entra na taxa
    const softBouncedLog = await createLog({ teamId, sentAt: AFTER_RELEASE })
    await addEvent({
      logId: softBouncedLog,
      type: "bounced",
      occurredAt: AFTER_RELEASE,
      bounceType: "Transient",
    })

    // (d) escopo de time — tudo do vizinho, dentro da janela
    const otherTeamLog = await createLog({ teamId: otherTeamId, sentAt: AFTER_RELEASE })
    await addEvent({
      logId: otherTeamLog,
      type: "bounced",
      occurredAt: AFTER_RELEASE,
      bounceType: "Permanent",
    })
    await addEvent({ logId: otherTeamLog, type: "complained", occurredAt: AFTER_RELEASE })
  })

  afterAll(async () => {
    for (const id of [teamId, otherTeamId].filter(Boolean)) {
      await prisma.emailEvent.deleteMany({ where: { log: { teamId: id } } })
      await prisma.emailLog.deleteMany({ where: { teamId: id } })
      await prisma.team.deleteMany({ where: { id } })
    }
    await prisma.profile.deleteMany({
      where: { id: { in: [profileId, otherProfileId].filter(Boolean) } },
    })
    await prisma.$disconnect()
  })

  it("conta apenas envios do time no intervalo [since, now]", async () => {
    const metrics = await emailSendingHealthRepository.getWindowMetricsSince(
      teamId,
      RELEASED_AT,
      NOW
    )
    // 3 envios do time depois da liberação e até `now`: hard bounce, reclamação
    // e soft bounce. Ficam de fora o pré-liberação, o futuro e o do outro time.
    expect(metrics.sent7d).toBe(3)
  })

  it("hard bounce: dedupe por logId, ignora soft bounce, respeita data e time", async () => {
    const metrics = await emailSendingHealthRepository.getWindowMetricsSince(
      teamId,
      RELEASED_AT,
      NOW
    )
    // 1 = só o log com bounce Permanent no intervalo, contado UMA vez apesar
    // dos dois eventos. Soft bounce, pré-liberação, futuro e outro time fora.
    expect(metrics.hardBounced7d).toBe(1)
  })

  it("reclamação: respeita data e escopo de time", async () => {
    const metrics = await emailSendingHealthRepository.getWindowMetricsSince(
      teamId,
      RELEASED_AT,
      NOW
    )
    expect(metrics.complained7d).toBe(1)
  })

  it("o time vizinho é medido por si só — nada do time sob teste vaza", async () => {
    const metrics = await emailSendingHealthRepository.getWindowMetricsSince(
      otherTeamId,
      RELEASED_AT,
      NOW
    )
    expect(metrics).toEqual({ sent7d: 1, hardBounced7d: 1, complained7d: 1 })
  })

  it("janela que começa depois de todos os eventos devolve zero", async () => {
    const metrics = await emailSendingHealthRepository.getWindowMetricsSince(
      teamId,
      new Date(AFTER_RELEASE.getTime() + 24 * 60 * 60 * 1000),
      NOW
    )
    expect(metrics).toEqual({ sent7d: 0, hardBounced7d: 0, complained7d: 0 })
  })
})
