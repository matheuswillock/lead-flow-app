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
    submissionIds: string[]
  } = { leadIds: [], submissionIds: [] }

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

    // Funil dentro do range: 3 views, 2 starts, 1 completes (D3/T-10.3 — só o funil de
    // visualização/interação continua vindo dos metric events; leadCreated/leadAttached
    // migraram para a derivação por submissão+lead, v1.1 do contrato — ver T-10.3 abaixo).
    const events: { eventType: string; visitorSessionId: string }[] = [
      { eventType: "form_viewed", visitorSessionId: "s1" },
      { eventType: "form_viewed", visitorSessionId: "s2" },
      { eventType: "form_viewed", visitorSessionId: "s3" },
      { eventType: "form_started", visitorSessionId: "s1" },
      { eventType: "form_started", visitorSessionId: "s2" },
      { eventType: "form_completed", visitorSessionId: "s1" },
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

    // Submissões completas + leads (T-10.3 — derivação criado×anexado, v1.1 do contrato
    // de 01/09: leadCreated/leadAttached deixam de vir de metric events e passam a
    // comparar lead."createdAt" com submission."createdAt").
    async function createCompletedSubmissionWithLead(options: {
      key: string
      submissionCreatedAt: Date
      leadCreatedAt: Date
      leadCode: string
      leadName: string
    }) {
      const lead = await prisma.lead.create({
        data: {
          name: options.leadName,
          leadCode: options.leadCode,
          team: { connect: { id: teamA.id } },
          manager: { connect: { id: master.id } },
          originChannel: "public_form",
          createdAt: options.leadCreatedAt,
        },
      })
      scope.leadIds.push(lead.id)

      const submission = await prisma.publicFormSubmission.create({
        data: {
          form: { connect: { id: form.id } },
          publication: { connect: { id: publication.id } },
          lead: { connect: { id: lead.id } },
          requestKey: options.key,
          completionStatus: "complete",
          status: "completed",
          createdAt: options.submissionCreatedAt,
        },
      })
      scope.submissionIds.push(submission.id)
      return { lead, submission }
    }

    const SUBMITTED_AT = new Date("2026-08-29T10:00:00.000Z")

    // Caso CRIADO: o lead nasceu 2 min depois da submissão (dentro da janela de 5 min).
    await createCompletedSubmissionWithLead({
      key: `ca-${suffix}-sub-created`,
      submissionCreatedAt: SUBMITTED_AT,
      leadCreatedAt: new Date(SUBMITTED_AT.getTime() + 2 * 60_000),
      leadCode: `ca-${suffix}-sub-created`,
      leadName: "Lead Criado Junto",
    })

    // Caso ANEXADO: o lead já existia dias antes da submissão.
    await createCompletedSubmissionWithLead({
      key: `ca-${suffix}-sub-attached`,
      submissionCreatedAt: new Date("2026-08-29T11:00:00.000Z"),
      leadCreatedAt: new Date("2026-08-01T00:00:00.000Z"),
      leadCode: `ca-${suffix}-sub-attached`,
      leadName: "Lead Anexado Antigo",
    })

    // Caso-armadilha (bug real de produção — adenda 01/09 do bug do gate, card "PEDRO
    // TESTE"): o lead nasceu 1 min depois da submissão (é uma CRIAÇÃO real), mas o fluxo
    // legado também emitiu um evento lead_attached mislabeled para essa mesma sessão.
    // A derivação nova NÃO pode se contaminar com o evento errado — só olha
    // submissão+lead. Este é o teste que nasce vermelho na implementação por metric event.
    await createCompletedSubmissionWithLead({
      key: `ca-${suffix}-sub-trap`,
      submissionCreatedAt: new Date("2026-08-29T12:00:00.000Z"),
      leadCreatedAt: new Date("2026-08-29T12:01:00.000Z"),
      leadCode: `ca-${suffix}-sub-trap`,
      leadName: "PEDRO TESTE (armadilha)",
    })
    await prisma.publicFormMetricEvent.create({
      data: {
        form: { connect: { id: form.id } },
        publication: { connect: { id: publication.id } },
        visitorSessionId: "s-trap",
        eventType: "lead_attached",
        eventKey: `ca-${suffix}-trap-event`,
        createdAt: new Date("2026-08-29T12:01:30.000Z"),
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
    scope.leadIds.push(leadInsideEmail.id, leadInsideForm.id, leadDeleted.id, leadOutsideRange.id, leadOtherTeam.id)
  })

  afterAll(async () => {
    if (scope.submissionIds.length) {
      // PublicForm -> PublicFormSubmission é onDelete: Restrict — as submissões
      // MUST sair antes do form, senão o deleteMany do form abaixo falha.
      await prisma.publicFormSubmission.deleteMany({ where: { id: { in: scope.submissionIds } } })
    }
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
    // leadInsideEmail + leadInsideForm + os 2 leads do fixture de T-10.3 (criado/armadilha,
    // ambos public_form, dentro do range) — exclui deletado, o anexado (fora do range),
    // fora do range e do outro time.
    expect(total).toBe(4)
    const byChannel = Object.fromEntries(rows.map((row) => [row.originChannel, row.count]))
    expect(byChannel.email_campaign).toBe(1)
    expect(byChannel.public_form).toBe(3)
  })

  it("T-10.3 — formFunnel deriva leadCreated/leadAttached de submissão+lead (v1.1), NUNCA de metric events, e não se contamina com o evento mislabeled (armadilha PEDRO TESTE, adenda 01/09)", async () => {
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
    // Evento fora do range não deve inflar "viewed"
    expect(row?.viewed).not.toBe(4)

    // 2 CRIADOS (caso normal + o caso-armadilha, cujo evento lead_attached mislabeled
    // NÃO pode contaminar a contagem) + 1 ANEXADO — a implementação por metric event
    // reportaria leadCreated=0, leadAttached=1 aqui (o evento real emitido é só o
    // lead_attached da armadilha); esta é a asserção que prova a correção.
    expect(row?.leadCreated).toBe(2)
    expect(row?.leadAttached).toBe(1)
  })

  it("T-10.3c — trava o limiar de 5 minutos: lead 4 min antes da submissão conta como CRIADO, 6 min antes conta como ANEXADO", async () => {
    const submittedAt = new Date("2026-08-30T09:00:00.000Z")

    const created4min = await prisma.lead.create({
      data: {
        name: "Lead 4 min antes",
        leadCode: `ca-${suffix}-threshold-4min`,
        team: { connect: { id: scope.teamAId! } },
        manager: { connect: { id: scope.masterId! } },
        originChannel: "public_form",
        createdAt: new Date(submittedAt.getTime() - 4 * 60_000),
      },
    })
    scope.leadIds.push(created4min.id)
    const submissionCreated4min = await prisma.publicFormSubmission.create({
      data: {
        form: { connect: { id: scope.formId! } },
        publication: { connect: { id: scope.publicationId! } },
        lead: { connect: { id: created4min.id } },
        requestKey: `ca-${suffix}-threshold-4min`,
        completionStatus: "complete",
        status: "completed",
        createdAt: submittedAt,
      },
    })
    scope.submissionIds.push(submissionCreated4min.id)

    const attached6min = await prisma.lead.create({
      data: {
        name: "Lead 6 min antes",
        leadCode: `ca-${suffix}-threshold-6min`,
        team: { connect: { id: scope.teamAId! } },
        manager: { connect: { id: scope.masterId! } },
        originChannel: "public_form",
        createdAt: new Date(submittedAt.getTime() - 6 * 60_000),
      },
    })
    scope.leadIds.push(attached6min.id)
    const submissionAttached6min = await prisma.publicFormSubmission.create({
      data: {
        form: { connect: { id: scope.formId! } },
        publication: { connect: { id: scope.publicationId! } },
        lead: { connect: { id: attached6min.id } },
        requestKey: `ca-${suffix}-threshold-6min`,
        completionStatus: "complete",
        status: "completed",
        createdAt: submittedAt,
      },
    })
    scope.submissionIds.push(submissionAttached6min.id)

    const rows = await backofficeCampaignAnalyticsRepository.formFunnel({
      from: FROM,
      to: TO,
      teamIds: [scope.teamAId!],
    })
    const row = rows.find((entry) => entry.formId === scope.formId)
    expect(row).toBeDefined()
    // base do T-10.3 (2 criados/1 anexado) + 1 criado (4min) + 1 anexado (6min)
    expect(row?.leadCreated).toBe(3)
    expect(row?.leadAttached).toBe(2)
  })

  it("T-10.3d — conta sessões DISTINTAS, não linhas (review #1111: backfill de atribuição pode gravar mais de um form_viewed/form_started para a mesma sessão)", async () => {
    // Mesma sessão "s1" da base do T-10.3, linha extra simulando o backfill de
    // atribuição (lib/public-forms/origin.ts / backfill-form-viewed-attribution.ts) —
    // não pode inflar a contagem de "viewed".
    await prisma.publicFormMetricEvent.create({
      data: {
        form: { connect: { id: scope.formId! } },
        publication: { connect: { id: scope.publicationId! } },
        visitorSessionId: "s1",
        eventType: "form_viewed",
        eventKey: `ca-${suffix}-s1-attribution-backfill`,
        createdAt: new Date("2026-08-29T10:05:00.000Z"),
      },
    })

    const rows = await backofficeCampaignAnalyticsRepository.formFunnel({
      from: FROM,
      to: TO,
      teamIds: [scope.teamAId!],
    })
    const row = rows.find((entry) => entry.formId === scope.formId)
    expect(row).toBeDefined()
    // s1, s2, s3 — 3 sessões distintas, mesmo com a linha duplicada de s1.
    expect(row?.viewed).toBe(3)
  })

  it("T-10.3b — ancora o período no fato (occurredAt), não no drenar da fila (createdAt), e exclui eventos fabricados pelo dispatcher", async () => {
    // Ocorreu DENTRO do período mas só drenou (createdAt) DEPOIS do fim do range — deve contar.
    await prisma.publicFormMetricEvent.create({
      data: {
        form: { connect: { id: scope.formId! } },
        publication: { connect: { id: scope.publicationId! } },
        visitorSessionId: "s-late-drain",
        eventType: "form_viewed",
        eventKey: `ca-${suffix}-late-drain`,
        occurredAt: new Date("2026-08-29T23:00:00.000Z"),
        createdAt: new Date("2026-09-02T00:00:00.000Z"),
      },
    })

    // Drenou (createdAt) DENTRO do período mas ocorreu ANTES do início — não deve contar.
    await prisma.publicFormMetricEvent.create({
      data: {
        form: { connect: { id: scope.formId! } },
        publication: { connect: { id: scope.publicationId! } },
        visitorSessionId: "s-early-occurred",
        eventType: "form_viewed",
        eventKey: `ca-${suffix}-early-occurred`,
        occurredAt: new Date("2026-08-01T00:00:00.000Z"),
        createdAt: new Date("2026-08-29T10:00:00.000Z"),
      },
    })

    // Fabricado pelo dispatcher (SPEC 40 E0) — nunca deve contar, mesmo dentro do range.
    await prisma.publicFormMetricEvent.create({
      data: {
        form: { connect: { id: scope.formId! } },
        publication: { connect: { id: scope.publicationId! } },
        visitorSessionId: "s-fabricated",
        eventType: "form_completed",
        eventKey: `ca-${suffix}-fabricated`,
        createdAt: new Date("2026-08-29T10:00:00.000Z"),
        origin: { fabricatedByDispatcher: true },
      },
    })

    const rows = await backofficeCampaignAnalyticsRepository.formFunnel({
      from: FROM,
      to: TO,
      teamIds: [scope.teamAId!],
    })
    const row = rows.find((entry) => entry.formId === scope.formId)
    expect(row).toBeDefined()
    // base (T-10.3) era 3; +1 do late-drain (âncora por occurredAt); early-occurred NÃO soma
    expect(row?.viewed).toBe(4)
    // base era 1; o completed fabricado NÃO soma
    expect(row?.completed).toBe(1)
  })
})
