import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { randomUUID } from "node:crypto"

// Fixture de paridade (T-10.11, D4) com os números medidos no artefato de
// 31/08 (Janela B: 26/08 18:00 -> 31/08 UTC — aqui reproduzida dentro de um
// range de dias fechados [27/08, 30/08], já que o contrato DA5 trabalha em
// dias UTC inteiros, não em timestamp de corte). Números fixados AO
// ARTEFATO (não inventados): 40 disparos, ~57,5 mil enviados, Liber
// finalScore 3,70 (6 leads / 1.623 enviados), Kathrein "v2 médicos" 37,0% de
// abertura (2.494 aberturas / 6.739 enviados). Os 38 disparos restantes são
// preenchimento sintético só para fechar a contagem de 40 disparos e o total
// de ~57,5 mil enviados — não representam times/valores nomeados no artefato.
const RUN_INTEGRATION =
  process.env.CAMPAIGN_ANALYTICS_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL)

let prisma: typeof import("@/app/api/infra/data/prisma").prisma
let backofficeCampaignAnalyticsRepository: typeof import("./BackofficeCampaignAnalyticsRepository").backofficeCampaignAnalyticsRepository
let finalScoreFn: typeof import("@/lib/backoffice-campaign-analytics/metrics").finalScore
let openRateFn: typeof import("@/lib/backoffice-campaign-analytics/metrics").openRate

if (RUN_INTEGRATION) {
  ;({ prisma } = await import("@/app/api/infra/data/prisma"))
  ;({ backofficeCampaignAnalyticsRepository } = await import("./BackofficeCampaignAnalyticsRepository"))
  ;({ finalScore: finalScoreFn, openRate: openRateFn } = await import("@/lib/backoffice-campaign-analytics/metrics"))
}

describe.skipIf(!RUN_INTEGRATION)("BackofficeCampaignAnalyticsRepository — fixture de paridade 31/08 (T-10.11)", () => {
  const suffix = randomUUID().slice(0, 8)
  const FROM = new Date("2026-08-27T00:00:00.000Z")
  const TO = new Date("2026-08-31T00:00:00.000Z")

  const scope: {
    masterId?: string
    teamLiberId?: string
    teamKathreinId?: string
    teamFillerId?: string
    teamTrapId?: string
    dispatchIds: string[]
    leadIds: string[]
    trapFormId?: string
    trapPublicationId?: string
    submissionIds: string[]
  } = { dispatchIds: [], leadIds: [], submissionIds: [] }

  beforeAll(async () => {
    const master = await prisma.profile.create({
      data: { id: randomUUID(), email: `parity-${suffix}@test.local`, supabaseId: randomUUID(), fullName: "Parity Master", isMaster: true },
    })
    scope.masterId = master.id

    const teamLiber = await prisma.team.create({ data: { name: `Liber Corretora ${suffix}`, masterId: master.id } })
    const teamKathrein = await prisma.team.create({ data: { name: `Kathrein ${suffix}`, masterId: master.id } })
    const teamFiller = await prisma.team.create({ data: { name: `Filler ${suffix}`, masterId: master.id } })
    scope.teamLiberId = teamLiber.id
    scope.teamKathreinId = teamKathrein.id
    scope.teamFillerId = teamFiller.id

    async function createTemplateAndCampaign(teamId: string, name: string) {
      const templateId = randomUUID()
      await prisma.emailTemplate.create({
        data: { id: templateId, teamId, createdBy: master.id, name, subject: "Assunto", html: "<p>Oi</p>", versionGroupId: templateId },
      })
      const campaign = await prisma.emailCampaign.create({
        data: { teamId, createdBy: master.id, templateId, name: `Campanha ${name}` },
      })
      return { templateId, campaignId: campaign.id }
    }

    const liberTpl = await createTemplateAndCampaign(teamLiber.id, "Rede D'Or e Hosp. São Luiz")
    const kathreinTpl = await createTemplateAndCampaign(teamKathrein.id, "v2 médicos")
    const fillerTpl = await createTemplateAndCampaign(teamFiller.id, "Filler")

    async function createDispatch(options: {
      teamId: string
      campaignId: string
      templateId: string
      dispatchNumber: number
      templateName: string
      sent: number
      opened: number
    }) {
      const dispatch = await prisma.emailCampaignDispatch.create({
        data: {
          campaignId: options.campaignId,
          teamId: options.teamId,
          dispatchNumber: options.dispatchNumber,
          templateId: options.templateId,
          templateVersionNumber: 1,
          templateName: options.templateName,
          templateSubject: "Assunto",
          templateHtml: "<p>Oi</p>",
          dispatchedAt: new Date("2026-08-29T10:00:00.000Z"),
          triggeredBy: master.id,
          totalRecipients: options.sent,
          totalSent: options.sent,
          totalDelivered: Math.round(options.sent * 0.97),
          totalOpened: options.opened,
          totalClicked: 0,
          totalBounced: Math.round(options.sent * 0.02),
          status: "completed",
        },
      })
      scope.dispatchIds.push(dispatch.id)
    }

    // Liber Corretora — sent=1.623, leads=6 -> finalScore 3,70 (número do artefato)
    await createDispatch({
      teamId: teamLiber.id,
      campaignId: liberTpl.campaignId,
      templateId: liberTpl.templateId,
      dispatchNumber: 1,
      templateName: "Rede D'Or e Hosp. São Luiz",
      sent: 1623,
      opened: 452,
    })

    // Kathrein "v2 médicos" — sent=6.739, opened=2.494 -> openRate 37,0% (número do artefato)
    await createDispatch({
      teamId: teamKathrein.id,
      campaignId: kathreinTpl.campaignId,
      templateId: kathreinTpl.templateId,
      dispatchNumber: 1,
      templateName: "v2 médicos",
      sent: 6739,
      opened: 2494,
    })

    // 38 disparos de preenchimento — só para fechar a contagem de 40 disparos
    // e o total de ~57,5 mil enviados; nenhum valor aqui é nomeado no artefato.
    const FILLER_COUNT = 38
    const FILLER_SENT_EACH = 1293
    for (let i = 0; i < FILLER_COUNT; i++) {
      await createDispatch({
        teamId: teamFiller.id,
        campaignId: fillerTpl.campaignId,
        templateId: fillerTpl.templateId,
        dispatchNumber: i + 2,
        templateName: "Filler",
        sent: FILLER_SENT_EACH,
        opened: Math.round(FILLER_SENT_EACH * 0.1),
      })
    }

    // Leads da Liber: 6 no período (2 email_campaign + 4 public_form)
    const leadChannels: Array<"email_campaign" | "public_form"> = [
      "email_campaign",
      "email_campaign",
      "public_form",
      "public_form",
      "public_form",
      "public_form",
    ]
    for (const [index, channel] of leadChannels.entries()) {
      const lead = await prisma.lead.create({
        data: {
          name: `Lead Liber ${index}`,
          leadCode: `parity-${suffix}-${index}`,
          team: { connect: { id: teamLiber.id } },
          manager: { connect: { id: master.id } },
          originChannel: channel,
          createdAt: new Date("2026-08-29T12:00:00.000Z"),
        },
      })
      scope.leadIds.push(lead.id)
    }

    // Prova viva do bug documentado na adenda de 01/09 (bugs/2026-08-31-formulario-anexa-
    // ...md): o card "PEDRO TESTE" nasceu 01/09 11:20 (1 min após a submissão) e o
    // fluxo legado emitiu um evento lead_attached mislabeled 11:21 — mesmo assim é uma
    // CRIAÇÃO real. Time isolado (não Liber/Kathrein/Filler) para não alterar os números
    // do artefato acima. O artefato de 31/08 não tem um total leadsCreated/leadsAttached
    // medido sob a derivação nova para a janela inteira (ele foi montado com a métrica
    // antiga, que é exatamente o que este bug corrige) — por isso este teste prova a
    // derivação contra o caso documentado, em vez de fixar um agregado não medido.
    const teamTrap = await prisma.team.create({ data: { name: `Trap ${suffix}`, masterId: master.id } })
    scope.teamTrapId = teamTrap.id

    const trapForm = await prisma.publicForm.create({
      data: {
        team: { connect: { id: teamTrap.id } },
        creator: { connect: { id: master.id } },
        publicId: randomUUID(),
        name: `Formulário Armadilha ${suffix}`,
        status: "published",
        approvalStatus: "approved",
      },
    })
    scope.trapFormId = trapForm.id

    const trapPublication = await prisma.publicFormPublication.create({
      data: { form: { connect: { id: trapForm.id } }, publishedBy: { connect: { id: master.id } }, version: 1, snapshot: {} },
    })
    scope.trapPublicationId = trapPublication.id

    const trapSubmittedAt = new Date("2026-08-29T11:20:00.000Z")
    const trapLead = await prisma.lead.create({
      data: {
        name: "PEDRO TESTE",
        leadCode: `parity-${suffix}-pedro-teste`,
        team: { connect: { id: teamTrap.id } },
        manager: { connect: { id: master.id } },
        originChannel: "public_form",
        createdAt: new Date("2026-08-29T11:21:00.000Z"), // 1 min depois — criação real
      },
    })
    scope.leadIds.push(trapLead.id)

    const trapSubmission = await prisma.publicFormSubmission.create({
      data: {
        form: { connect: { id: trapForm.id } },
        publication: { connect: { id: trapPublication.id } },
        lead: { connect: { id: trapLead.id } },
        requestKey: `parity-${suffix}-pedro-teste`,
        completionStatus: "complete",
        status: "completed",
        createdAt: trapSubmittedAt,
      },
    })
    scope.submissionIds.push(trapSubmission.id)

    await prisma.publicFormMetricEvent.create({
      data: {
        form: { connect: { id: trapForm.id } },
        publication: { connect: { id: trapPublication.id } },
        visitorSessionId: "pedro-teste-session",
        eventType: "lead_attached", // mislabel confirmado em produção — não pode contaminar
        eventKey: `parity-${suffix}-pedro-teste-event`,
        createdAt: new Date("2026-08-29T11:21:30.000Z"),
      },
    })
  })

  afterAll(async () => {
    if (scope.submissionIds.length) {
      await prisma.publicFormSubmission.deleteMany({ where: { id: { in: scope.submissionIds } } })
    }
    if (scope.trapFormId) {
      await prisma.publicFormMetricEvent.deleteMany({ where: { formId: scope.trapFormId } })
      await prisma.publicFormPublication.deleteMany({ where: { formId: scope.trapFormId } })
      await prisma.publicForm.deleteMany({ where: { id: scope.trapFormId } })
    }
    if (scope.leadIds.length) await prisma.lead.deleteMany({ where: { id: { in: scope.leadIds } } })
    if (scope.dispatchIds.length) await prisma.emailCampaignDispatch.deleteMany({ where: { id: { in: scope.dispatchIds } } })
    await prisma.emailCampaign.deleteMany({
      where: { teamId: { in: [scope.teamLiberId, scope.teamKathreinId, scope.teamFillerId].filter((id): id is string => Boolean(id)) } },
    })
    await prisma.emailTemplate.deleteMany({
      where: { teamId: { in: [scope.teamLiberId, scope.teamKathreinId, scope.teamFillerId].filter((id): id is string => Boolean(id)) } },
    })
    for (const teamId of [scope.teamLiberId, scope.teamKathreinId, scope.teamFillerId, scope.teamTrapId]) {
      if (teamId) await prisma.team.deleteMany({ where: { id: teamId } })
    }
    if (scope.masterId) await prisma.profile.deleteMany({ where: { id: scope.masterId } })
  })

  const teamFilter = () => ({
    from: FROM,
    to: TO,
    teamIds: [scope.teamLiberId!, scope.teamKathreinId!, scope.teamFillerId!],
  })

  it("bate com o total de disparos e enviados do artefato (40 disparos / ~57,5 mil enviados)", async () => {
    const templates = await backofficeCampaignAnalyticsRepository.aggregateByTemplate(teamFilter())
    const totalDispatches = templates.reduce((sum, row) => sum + row.dispatches, 0)
    const totalSent = templates.reduce((sum, row) => sum + row.sent, 0)

    expect(totalDispatches).toBe(40)
    expect(totalSent).toBeGreaterThanOrEqual(57000)
    expect(totalSent).toBeLessThanOrEqual(58000)
  })

  it("bate com o finalScore da Liber Corretora do artefato (3,70)", async () => {
    const templates = await backofficeCampaignAnalyticsRepository.aggregateByTemplate({
      from: FROM,
      to: TO,
      teamIds: [scope.teamLiberId!],
    })
    const liberSent = templates.reduce((sum, row) => sum + row.sent, 0)

    const leads = await backofficeCampaignAnalyticsRepository.leadsByOrigin({
      from: FROM,
      to: TO,
      teamIds: [scope.teamLiberId!],
    })
    const liberLeads = leads.reduce((sum, row) => sum + row.count, 0)

    expect(liberSent).toBe(1623)
    expect(liberLeads).toBe(6)
    expect(Math.round((finalScoreFn(liberLeads, liberSent) ?? 0) * 100) / 100).toBe(3.7)
  })

  it("bate com a abertura do template Kathrein v2 médicos do artefato (37,0%)", async () => {
    const templates = await backofficeCampaignAnalyticsRepository.aggregateByTemplate({
      from: FROM,
      to: TO,
      teamIds: [scope.teamKathreinId!],
    })
    const row = templates.find((entry) => entry.templateName === "v2 médicos")
    expect(row).toBeDefined()
    expect(row?.sent).toBe(6739)
    expect(row?.opened).toBe(2494)
    expect(Math.round((openRateFn(row?.opened ?? 0, row?.sent ?? 0) ?? 0) * 1000) / 1000).toBeCloseTo(0.37, 2)
  })

  it("v1.1 do contrato (01/09) — reproduz o caso documentado 'PEDRO TESTE': lead nascido 1 min após a submissão conta CRIADO, mesmo com o evento lead_attached mislabeled emitido pelo fluxo legado", async () => {
    const rows = await backofficeCampaignAnalyticsRepository.formFunnel({
      from: FROM,
      to: TO,
      teamIds: [scope.teamTrapId!],
    })
    const row = rows.find((entry) => entry.formId === scope.trapFormId)
    expect(row).toBeDefined()
    expect(row?.leadCreated).toBe(1)
    expect(row?.leadAttached).toBe(0)
  })
})
