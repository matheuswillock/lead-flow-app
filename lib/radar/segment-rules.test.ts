import { describe, expect, it } from "bun:test"
import {
  isHumanEmailEngagementEvent,
  profileClickedNotClosedInWindow,
  profileEngagedNoLeadInWindow,
  profileMatchesRadarSegment,
  profileOpenedNotClickedInWindow,
} from "@/lib/radar/segment-rules"

const NOW = new Date("2026-06-01T12:00:00.000Z").getTime()
const RECENT_MS = 60 * 24 * 60 * 60 * 1000

/** Engajamento de e-mail só conta com origem humana (17/09). */
const HUMAN_ORIGIN = { origin: { classification: "human" } }
const BOT_ORIGIN = { origin: { classification: "bot", botSource: "gmail-proxy" } }

function daysAgo(days: number): Date {
  return new Date(NOW - days * 24 * 60 * 60 * 1000)
}

describe("profileOpenedNotClickedInWindow", () => {
  it("entra quando abriu campanha A sem clicar na mesma campanha", () => {
    const events = [
      {
        eventType: "email.opened",
        occurredAt: daysAgo(5),
        metadata: { campaignId: "camp-a", ...HUMAN_ORIGIN },
      },
    ]

    expect(profileOpenedNotClickedInWindow(events, NOW, RECENT_MS)).toBe(true)
  })

  it("abertura de robô (proxy do provedor) não coloca o perfil no segmento", () => {
    const events = [
      {
        eventType: "email.opened",
        occurredAt: daysAgo(5),
        metadata: { campaignId: "camp-a", ...BOT_ORIGIN },
      },
    ]

    expect(profileOpenedNotClickedInWindow(events, NOW, RECENT_MS)).toBe(false)
  })

  it("abertura sem classificação de origem (histórico) não conta como engajamento", () => {
    const events = [
      {
        eventType: "email.opened",
        occurredAt: daysAgo(5),
        metadata: { campaignId: "camp-a" },
      },
    ]

    expect(profileOpenedNotClickedInWindow(events, NOW, RECENT_MS)).toBe(false)
  })

  it("clique de scanner não 'apaga' a abertura humana do segmento abriu-sem-clicar", () => {
    const events = [
      {
        eventType: "email.opened",
        occurredAt: daysAgo(5),
        metadata: { campaignId: "camp-a", ...HUMAN_ORIGIN },
      },
      {
        eventType: "email.clicked",
        occurredAt: daysAgo(4),
        metadata: {
          campaignId: "camp-a",
          origin: { classification: "bot", botSource: "scanner" },
        },
      },
    ]

    expect(profileOpenedNotClickedInWindow(events, NOW, RECENT_MS)).toBe(true)
  })

  it("não entra quando abriu e clicou na mesma campanha", () => {
    const events = [
      {
        eventType: "email.opened",
        occurredAt: daysAgo(5),
        metadata: { campaignId: "camp-a", ...HUMAN_ORIGIN },
      },
      {
        eventType: "email.clicked",
        occurredAt: daysAgo(4),
        metadata: { campaignId: "camp-a", ...HUMAN_ORIGIN },
      },
    ]

    expect(profileOpenedNotClickedInWindow(events, NOW, RECENT_MS)).toBe(false)
  })

  it("entra quando abriu A sem clicar em A, mesmo tendo clicado em B", () => {
    const events = [
      {
        eventType: "email.opened",
        occurredAt: daysAgo(10),
        metadata: { campaignId: "camp-a", ...HUMAN_ORIGIN },
      },
      {
        eventType: "email.clicked",
        occurredAt: daysAgo(8),
        metadata: { campaignId: "camp-b", ...HUMAN_ORIGIN },
      },
    ]

    expect(profileOpenedNotClickedInWindow(events, NOW, RECENT_MS)).toBe(true)
  })

  it("ignora eventos fora da janela de 60 dias", () => {
    const events = [
      {
        eventType: "email.opened",
        occurredAt: daysAgo(90),
        metadata: { campaignId: "camp-a", ...HUMAN_ORIGIN },
      },
    ]

    expect(profileOpenedNotClickedInWindow(events, NOW, RECENT_MS)).toBe(false)
  })

  it("ignora eventos sem campaignId", () => {
    const events = [
      { eventType: "email.opened", occurredAt: daysAgo(5), metadata: {} },
      { eventType: "email.clicked", occurredAt: daysAgo(4) },
    ]

    expect(profileOpenedNotClickedInWindow(events, NOW, RECENT_MS)).toBe(false)
  })
})

describe("profileClickedNotClosedInWindow", () => {
  it("entra com clique recente em campanha e perfil não fechado", () => {
    const events = [
      {
        eventType: "email.clicked",
        occurredAt: daysAgo(3),
        metadata: { campaignId: "camp-a", ...HUMAN_ORIGIN },
      },
    ]

    expect(profileClickedNotClosedInWindow(events, false, NOW, RECENT_MS)).toBe(true)
  })

  it("clique de robô/scanner não conta como clique de campanha", () => {
    const events = [
      {
        eventType: "email.clicked",
        occurredAt: daysAgo(3),
        metadata: {
          campaignId: "camp-a",
          origin: { classification: "bot", botSource: "scanner" },
        },
      },
    ]

    expect(profileClickedNotClosedInWindow(events, false, NOW, RECENT_MS)).toBe(false)
  })

  it("não entra quando perfil está fechado", () => {
    const events = [
      {
        eventType: "email.clicked",
        occurredAt: daysAgo(3),
        metadata: { campaignId: "camp-a", ...HUMAN_ORIGIN },
      },
    ]

    expect(profileClickedNotClosedInWindow(events, true, NOW, RECENT_MS)).toBe(false)
  })
})

describe("isHumanEmailEngagementEvent", () => {
  it("form.* não passa pelo filtro de origem (first-party por construção)", () => {
    expect(
      isHumanEmailEngagementEvent({ eventType: "form.viewed", occurredAt: daysAgo(1) })
    ).toBe(true)
  })

  it("email.* exige classificação humana; unknown e ausente não contam", () => {
    expect(
      isHumanEmailEngagementEvent({
        eventType: "email.opened",
        occurredAt: daysAgo(1),
        metadata: HUMAN_ORIGIN,
      })
    ).toBe(true)
    expect(
      isHumanEmailEngagementEvent({
        eventType: "email.opened",
        occurredAt: daysAgo(1),
        metadata: { origin: { classification: "unknown" } },
      })
    ).toBe(false)
    expect(
      isHumanEmailEngagementEvent({ eventType: "email.opened", occurredAt: daysAgo(1) })
    ).toBe(false)
  })
})

describe("profileMatchesRadarSegment", () => {
  const baseProfile = {
    normalizedPrimaryEmail: "lead@example.com",
    consents: [{ status: "allowed" }],
    sourceLinks: [],
    identities: [{ type: "lead_id", normalizedValue: "lead-1" }],
    events: [] as { eventType: string; occurredAt: Date; metadata?: unknown }[],
  }

  it("opened_not_clicked usa regra por campanha", () => {
    const profile = {
      ...baseProfile,
      events: [
        {
          eventType: "email.opened",
          occurredAt: daysAgo(2),
          metadata: { campaignId: "camp-a", ...HUMAN_ORIGIN },
        },
      ],
    }

    expect(
      profileMatchesRadarSegment(profile, "opened_not_clicked", new Map(), NOW, RECENT_MS)
    ).toBe(true)
  })

  it("clicked_not_closed exige clique com campaignId na janela", () => {
    const profile = {
      ...baseProfile,
      events: [
        {
          eventType: "email.clicked",
          occurredAt: daysAgo(2),
          metadata: { campaignId: "camp-a", ...HUMAN_ORIGIN },
        },
      ],
    }

    expect(
      profileMatchesRadarSegment(profile, "clicked_not_closed", new Map(), NOW, RECENT_MS)
    ).toBe(true)
  })

  it("portfolio_clients entra com sourceLink portfolio", () => {
    const profile = {
      ...baseProfile,
      sourceLinks: [{ sourceType: "portfolio" }],
    }
    expect(
      profileMatchesRadarSegment(profile, "portfolio_clients", new Map(), NOW, RECENT_MS)
    ).toBe(true)
  })

  it("portfolio_clients não entra sem vínculo de carteira", () => {
    expect(
      profileMatchesRadarSegment(baseProfile, "portfolio_clients", new Map(), NOW, RECENT_MS)
    ).toBe(false)
  })

  it("crm_clients entra com identidade lead_id", () => {
    expect(profileMatchesRadarSegment(baseProfile, "crm_clients", new Map(), NOW, RECENT_MS)).toBe(
      true
    )
  })

  it("crm_clients não entra sem identidade lead_id", () => {
    const profile = {
      ...baseProfile,
      identities: [{ type: "email", normalizedValue: "lead@example.com" }],
    }
    expect(profileMatchesRadarSegment(profile, "crm_clients", new Map(), NOW, RECENT_MS)).toBe(
      false
    )
  })
})

describe("profileEngagedNoLeadInWindow (G1)", () => {
  const baseProfile = {
    identities: [] as { type?: string; normalizedValue: string }[],
    events: [] as { eventType: string; occurredAt: Date; metadata?: unknown }[],
  }

  it("inclui perfil com evento de engajamento e sem lead_id", () => {
    const profile = {
      ...baseProfile,
      events: [
        { eventType: "email.opened", occurredAt: daysAgo(2), metadata: HUMAN_ORIGIN },
      ],
    }

    expect(profileEngagedNoLeadInWindow(profile, NOW, RECENT_MS)).toBe(true)
    expect(
      profileMatchesRadarSegment(
        { ...profile, consents: [], sourceLinks: [], normalizedPrimaryEmail: "a@b.com" },
        "engaged_no_lead",
        new Map(),
        NOW,
        RECENT_MS
      )
    ).toBe(true)
  })

  it("exclui perfil com evento de engajamento e lead_id preenchido", () => {
    const profile = {
      identities: [{ type: "lead_id", normalizedValue: "lead-1" }],
      events: [{ eventType: "email.clicked", occurredAt: daysAgo(2) }],
    }

    expect(profileEngagedNoLeadInWindow(profile, NOW, RECENT_MS)).toBe(false)
  })

  it("exclui perfil sem eventos mesmo com lead_id null", () => {
    expect(profileEngagedNoLeadInWindow(baseProfile, NOW, RECENT_MS)).toBe(false)
  })

  it("conta form.viewed como engajamento", () => {
    const profile = {
      ...baseProfile,
      events: [{ eventType: "form.viewed", occurredAt: daysAgo(1) }],
    }

    expect(profileEngagedNoLeadInWindow(profile, NOW, RECENT_MS)).toBe(true)
  })
})
