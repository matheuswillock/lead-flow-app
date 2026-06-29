import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { randomUUID } from "crypto"
import { prisma } from "@/app/api/infra/data/prisma"
import { customerDataPlatformService } from "@/app/api/services/cdp/CustomerDataPlatformService"
import { profileMatchesCdpSegment } from "@/lib/cdp/segment-rules"

const RUN_INTEGRATION = process.env.CDP_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL)

  const scope = {
    teamId: "",
    ctx: { profileId: "", teamMember: { role: "manager", functions: [] as string[] } },
  }
  const otherScope = {
    teamId: "",
    ctx: { profileId: "", teamMember: { role: "manager", functions: [] as string[] } },
  }
let leadId = ""
let profileId = ""

describe.skipIf(!RUN_INTEGRATION)("CustomerDataPlatform integration", () => {
  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8)
    const profile = await prisma.profile.create({
      data: {
        id: randomUUID(),
        email: `cdp-${suffix}@example.com`,
        supabaseId: randomUUID(),
        fullName: "CDP Tester",
        isMaster: true,
      },
    })

    const team = await prisma.team.create({
      data: {
        id: randomUUID(),
        name: `CDP Test ${suffix}`,
        masterId: profile.id,
      },
    })
    const otherTeam = await prisma.team.create({
      data: {
        id: randomUUID(),
        name: `CDP Other ${suffix}`,
        masterId: profile.id,
      },
    })

    await prisma.teamMember.create({
      data: {
        id: randomUUID(),
        teamId: team.id,
        profileId: profile.id,
        role: "manager",
      },
    })

    scope.teamId = team.id
    scope.ctx = {
      profileId: profile.id,
      teamMember: { role: "manager", functions: [] },
    }
    otherScope.teamId = otherTeam.id
    otherScope.ctx = {
      profileId: profile.id,
      teamMember: { role: "manager", functions: [] },
    }

    const lead = await prisma.lead.create({
      data: {
        id: randomUUID(),
        leadCode: `CDP-${suffix}`,
        managerId: profile.id,
        teamId: team.id,
        name: "Lead CDP",
        phone: `1199999${suffix.slice(0, 4)}`,
        email: `lead-${suffix}@example.com`,
        status: "new_opportunity",
      },
    })
    leadId = lead.id
  })

  afterAll(async () => {
    if (!scope.teamId) return
    await prisma.customerEvent.deleteMany({ where: { teamId: scope.teamId } })
    await prisma.customerChannelConsent.deleteMany({ where: { teamId: scope.teamId } })
    await prisma.customerIdentity.deleteMany({ where: { teamId: scope.teamId } })
    await prisma.customerSourceLink.deleteMany({ where: { teamId: scope.teamId } })
    await prisma.customerProfile.deleteMany({ where: { teamId: scope.teamId } })
    await prisma.lead.deleteMany({ where: { teamId: scope.teamId } })
    await prisma.teamMember.deleteMany({ where: { teamId: scope.teamId } })
    await prisma.team.deleteMany({ where: { id: { in: [scope.teamId, otherScope.teamId] } } })
  })

  it("syncFromCrm cria perfil com identity e source link", async () => {
    const first = await customerDataPlatformService.syncFromCrm(scope, { leadId })
    expect(first.created + first.enriched).toBeGreaterThanOrEqual(1)

    const profile = await prisma.customerProfile.findFirst({
      where: { teamId: scope.teamId },
      include: { identities: true, sourceLinks: true },
    })
    expect(profile).not.toBeNull()
    profileId = profile!.id
    expect(profile!.identities.some((item) => item.type === "lead_id")).toBe(true)
    expect(profile!.sourceLinks.some((item) => item.sourceType === "crm_lead")).toBe(true)
  })

  it("re-sync CRM é idempotente", async () => {
    const second = await customerDataPlatformService.syncFromCrm(scope, { leadId })
    expect(second.created).toBe(0)
  })

  it("countSegments reflete opened_not_clicked por campanha", async () => {
    const campaignId = randomUUID()
    await prisma.customerEvent.createMany({
      data: [
        {
          id: randomUUID(),
          profileId,
          teamId: scope.teamId,
          eventType: "email.opened",
          sourceType: "email_log",
          sourceId: randomUUID(),
          occurredAt: new Date(),
          metadata: { campaignId },
        },
      ],
    })

    const segments = await customerDataPlatformService.countSegments(scope)
    const openedNotClicked = segments.find((item) => item.slug === "opened_not_clicked")
    expect(openedNotClicked?.count ?? 0).toBeGreaterThanOrEqual(1)

    expect(
      profileMatchesCdpSegment(
        {
          normalizedPrimaryEmail: "lead@example.com",
          consents: [{ status: "allowed" }],
          sourceLinks: [],
          identities: [{ type: "lead_id", normalizedValue: leadId }],
          events: [
            {
              eventType: "email.opened",
              occurredAt: new Date(),
              metadata: { campaignId },
            },
          ],
        },
        "opened_not_clicked",
        new Map()
      )
    ).toBe(true)
  })

  it("time B não vê perfis do time A", async () => {
    const countA = await prisma.customerProfile.count({ where: { teamId: scope.teamId } })
    const countB = await prisma.customerProfile.count({ where: { teamId: otherScope.teamId } })
    expect(countA).toBeGreaterThan(0)
    expect(countB).toBe(0)
  })
})
