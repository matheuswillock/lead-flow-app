import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { randomUUID } from "node:crypto"

const RUN_INTEGRATION =
  process.env.CAMPAIGN_ANALYTICS_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL)

let prisma: typeof import("@/app/api/infra/data/prisma").prisma
let backofficeCampaignAnalyticsRepository: typeof import("./BackofficeCampaignAnalyticsRepository").backofficeCampaignAnalyticsRepository

if (RUN_INTEGRATION) {
  ;({ prisma } = await import("@/app/api/infra/data/prisma"))
  ;({ backofficeCampaignAnalyticsRepository } = await import("./BackofficeCampaignAnalyticsRepository"))
}

describe.skipIf(!RUN_INTEGRATION)("BackofficeCampaignAnalyticsRepository (Postgres local)", () => {
  const suffix = randomUUID().slice(0, 8)
  const scope: {
    masterId?: string
    teamAId?: string
    teamBId?: string
    templateId?: string
    campaignId?: string
    dispatchInsideId?: string
    dispatchOutsideId?: string
    formId?: string
    publicationId?: string
    leadIds: string[]
  } = { leadIds: [] }

  const FROM = new Date("2026-08-26T18:00:00.000Z")
  const TO = new Date("2026-08-31T00:00:00.000Z") // limite superior exclusivo (DA5)

  beforeAll(async () => {
    const master = await prisma.profile.create({
      data: {
        id: randomUUID(),
        email: `ca-master-${suffix}@test.local`,
        supabaseId: randomUUID(),
        fullName: "CA Master",
        isMaster: true,
      },
    })
    scope.masterId = master.id

    const teamA = await prisma.team.create({ data: { name: `CA Time A ${suffix}`, masterId: master.id } })
    const teamB = await prisma.team.create({ data: { name: `CA Time B ${suffix}`, masterId: master.id } })
    scope.teamAId = teamA.id
    scope.teamBId = teamB.id

    const templateId = randomUUID()
    const template = await prisma.emailTemplate.create({
      data: {
        id: templateId,
        teamId: teamA.id,
        createdBy: master.id,
        name: `Template ${suffix}`,
        subject: "Assunto",
        html: "<p>Oi</p>",
        versionGroupId: templateId,
      },
    })
    scope.templateId = template.id

    const campaign = await prisma.emailCampaign.create({
      data: {
        team: { connect: { id: teamA.id } },
        creator: { connect: { id: master.id } },
        template: { connect: { id: template.id } },
        name: `Campanha ${suffix}`,
      },
    })
    scope.campaignId = campaign.id

    // Disparo DENTRO do range (teamA) — deve aparecer nos agregados
    const dispatchInside = await prisma.emailCampaignDispatch.create({
      data: {
        campaign: { connect: { id: campaign.id } },
        team: { connect: { id: teamA.id } },
        dispatchNumber: 1,
        template: { connect: { id: template.id } },
        templateVersionNumber: 1,
        templateName: "v2 médicos",
        templateSubject: "Assunto",
        templateHtml: "<p>Oi</p>",
        dispatchedAt: new Date("2026-08-28T03:00:00.000Z"),
        triggerer: { connect: { id: master.id } },
        totalRecipients: 1180,
        totalSent: 1180,
        totalDelivered: 1167,
        totalOpened: 320,
        totalClicked: 0,
        totalBounced: 16,
        status: "completed",
      },
    })
    scope.dispatchInsideId = dispatchInside.id

    // Disparo FORA do range (antes de `from`) — não deve aparecer nos agregados do período
    const dispatchOutside = await prisma.emailCampaignDispatch.create({
      data: {
        campaign: { connect: { id: campaign.id } },
        team: { connect: { id: teamA.id } },
        dispatchNumber: 2,
        template: { connect: { id: template.id } },
        templateVersionNumber: 1,
        templateName: "v2 médicos",
        templateSubject: "Assunto",
        templateHtml: "<p>Oi</p>",
        dispatchedAt: new Date("2026-08-20T03:00:00.000Z"),
        triggerer: { connect: { id: master.id } },
        totalRecipients: 500,
        totalSent: 500,
        totalDelivered: 490,
        totalOpened: 100,
        totalClicked: 0,
        totalBounced: 5,
        status: "completed",
      },
    })
    scope.dispatchOutsideId = dispatchOutside.id

    const form = await prisma.publicForm.create({
      data: {
        team: { connect: { id: teamA.id } },
        creator: { connect: { id: master.id } },
        publicId: randomUUID(),
        name: `Formulário básico ${suffix}`,
        status: "published",
        approvalStatus: "approved",
      },
    })
    scope.formId = form.id

    const publication = await prisma.publicFormPublication.create({
      data: {
        form: { connect: { id: form.id } },
        publishedBy: { connect: { id: master.id } },
        version: 1,
        snapshot: {},
      },
    })
    scope.publicationId = publication.id

    // Funil dentro do range: 3 views, 2 starts, 1 completes, 1 lead_created, 1 lead_attached (SEPARADOS — D3/T-10.3)
    const events: { eventType: string; visitorSessionId: string }[] = [
      { eventType: "form_viewed", visitorSessionId: "s1" },
      { eventType: "form_viewed", visitorSessionId: "s2" },
      { eventType: "form_viewed", visitorSessionId: "s3" },
      { eventType: "form_started", visitorSessionId: "s1" },
      { eventType: "form_started", visitorSessionId: "s2" },
      { eventType: "form_completed", visitorSessionId: "s1" },
      { eventType: "lead_created", visitorSessionId: "s1" },
      { eventType: "lead_attached", visitorSessionId: "s2" },
    ]
    for (const [index, event] of events.entries()) {
      await prisma.publicFormMetricEvent.create({
        data: {
          form: { connect: { id: form.id } },
          publication: { connect: { id: publication.id } },
          visitorSessionId: event.visitorSessionId,
          eventType: event.eventType as never,
          eventKey: `ca-${suffix}-${index}`,
          createdAt: new Date("2026-08-29T10:00:00.000Z"),
        },
      })
    }
    // Evento fora do range — não deve contar
    await prisma.publicFormMetricEvent.create({
      data: {
        form: { connect: { id: form.id } },
        publication: { connect: { id: publication.id } },
        visitorSessionId: "s-outside",
        eventType: "form_viewed",
        eventKey: `ca-${suffix}-outside`,
        createdAt: new Date("2026-08-20T10:00:00.000Z"),
      },
    })

    // Leads: 2 dentro do range (teamA, um email_campaign outro public_form), 1 deletado (deve ser excluído), 1 fora do range
    const leadInsideEmail = await prisma.lead.create({
      data: {
        name: "Lead Email",
        leadCode: `ca-${suffix}-1`,
        team: { connect: { id: teamA.id } },
        manager: { connect: { id: master.id } },
        originChannel: "email_campaign",
        createdAt: new Date("2026-08-29T12:00:00.000Z"),
      },
    })
    const leadInsideForm = await prisma.lead.create({
      data: {
        name: "Lead Form",
        leadCode: `ca-${suffix}-2`,
        team: { connect: { id: teamA.id } },
        manager: { connect: { id: master.id } },
        originChannel: "public_form",
        createdAt: new Date("2026-08-29T13:00:00.000Z"),
      },
    })
    const leadDeleted = await prisma.lead.create({
      data: {
        name: "Lead Deletado",
        leadCode: `ca-${suffix}-3`,
        team: { connect: { id: teamA.id } },
        manager: { connect: { id: master.id } },
        originChannel: "public_form",
        createdAt: new Date("2026-08-29T14:00:00.000Z"),
        deletedAt: new Date("2026-08-29T15:00:00.000Z"),
      },
    })
    const leadOutsideRange = await prisma.lead.create({
      data: {
        name: "Lead Fora do Range",
        leadCode: `ca-${suffix}-4`,
        team: { connect: { id: teamA.id } },
        manager: { connect: { id: master.id } },
        originChannel: "email_campaign",
        createdAt: new Date("2026-08-20T12:00:00.000Z"),
      },
    })
    const leadOtherTeam = await prisma.lead.create({
      data: {
        name: "Lead Time B",
        leadCode: `ca-${suffix}-5`,
        team: { connect: { id: teamB.id } },
        manager: { connect: { id: master.id } },
        originChannel: "public_form",
        createdAt: new Date("2026-08-29T12:00:00.000Z"),
      },
    })
    scope.leadIds = [leadInsideEmail.id, leadInsideForm.id, leadDeleted.id, leadOutsideRange.id, leadOtherTeam.id]
  })

  afterAll(async () => {
    if (scope.leadIds.length) {
      await prisma.lead.deleteMany({ where: { id: { in: scope.leadIds } } })
    }
    if (scope.formId) {
      await prisma.publicFormMetricEvent.deleteMany({ where: { formId: scope.formId } })
      await prisma.publicFormPublication.deleteMany({ where: { formId: scope.formId } })
      await prisma.publicForm.deleteMany({ where: { id: scope.formId } })
    }
    if (scope.campaignId) {
      await prisma.emailCampaignDispatch.deleteMany({ where: { campaignId: scope.campaignId } })
      await prisma.emailCampaign.deleteMany({ where: { id: scope.campaignId } })
    }
    if (scope.templateId) {
      await prisma.emailTemplate.deleteMany({ where: { id: scope.templateId } })
    }
    if (scope.teamAId) await prisma.team.deleteMany({ where: { id: scope.teamAId } })
    if (scope.teamBId) await prisma.team.deleteMany({ where: { id: scope.teamBId } })
    if (scope.masterId) await prisma.profile.deleteMany({ where: { id: scope.masterId } })
  })

  it("T-10.2 — aggregateDispatches filtra pelo período fechado [from,to) e por teamIds", async () => {
    const page = await backofficeCampaignAnalyticsRepository.aggregateDispatches(
      { from: FROM, to: TO, teamIds: [scope.teamAId!] },
      { page: 1, pageSize: 100 }
    )
    const ids = page.rows.map((row) => row.id)
    expect(ids).toContain(scope.dispatchInsideId!)
    expect(ids).not.toContain(scope.dispatchOutsideId!)
  })

  it("T-10.2 — aggregateByTemplate soma os totais do período por teamId+templateName", async () => {
    const rows = await backofficeCampaignAnalyticsRepository.aggregateByTemplate({
      from: FROM,
      to: TO,
      teamIds: [scope.teamAId!],
    })
    const row = rows.find((entry) => entry.templateName === "v2 médicos")
    expect(row).toBeDefined()
    expect(row?.sent).toBe(1180)
    expect(row?.opened).toBe(320)
    expect(row?.dispatches).toBe(1)
  })

  it("T-10.2 — dailySeries agrega por dia via date_trunc, só dentro do período", async () => {
    const rows = await backofficeCampaignAnalyticsRepository.dailySeries({
      from: FROM,
      to: TO,
      teamIds: [scope.teamAId!],
    })
    const totalSent = rows.reduce((sum, row) => sum + row.sent, 0)
    expect(totalSent).toBe(1180)
    expect(rows.every((row) => row.day.startsWith("2026-08-28"))).toBe(true)
  })

  it("T-10.2 — leadsByOrigin exclui leads deletados e fora do período, filtra por teamIds", async () => {
    const rows = await backofficeCampaignAnalyticsRepository.leadsByOrigin({
      from: FROM,
      to: TO,
      teamIds: [scope.teamAId!],
    })
    const total = rows.reduce((sum, row) => sum + row.count, 0)
    expect(total).toBe(2) // leadInsideEmail + leadInsideForm; exclui deletado, fora do range e do outro time
    const byChannel = Object.fromEntries(rows.map((row) => [row.originChannel, row.count]))
    expect(byChannel.email_campaign).toBe(1)
    expect(byChannel.public_form).toBe(1)
  })

  it("T-10.3 — formFunnel conta lead_created e lead_attached SEPARADOS (nunca somados)", async () => {
    const rows = await backofficeCampaignAnalyticsRepository.formFunnel({
      from: FROM,
      to: TO,
      teamIds: [scope.teamAId!],
    })
    const row = rows.find((entry) => entry.formId === scope.formId)
    expect(row).toBeDefined()
    expect(row?.viewed).toBe(3)
    expect(row?.started).toBe(2)
    expect(row?.completed).toBe(1)
    expect(row?.leadCreated).toBe(1)
    expect(row?.leadAttached).toBe(1)
    // Evento fora do range não deve inflar "viewed"
    expect(row?.viewed).not.toBe(4)
  })
})
