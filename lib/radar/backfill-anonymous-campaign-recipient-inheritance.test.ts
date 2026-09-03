import { describe, expect, it } from "bun:test"
import {
  planAnonymousCampaignRecipientInheritance,
  type AnonymousProfileEmailTrace,
  type EmailLogRecipient,
} from "@/lib/radar/backfill-anonymous-campaign-recipient-inheritance"

/**
 * Bug 2026-09-03 — passivo: ~2.700 perfis "Visitante Anônimo" dos últimos 30
 * dias têm rastro `cs_el`→`EmailLog` nos eventos (Kathrein 359, GPS 383,
 * MultiSkill 768…), mas a herança de identidade do destinatário (E6b, PR
 * #1148) só roda para eventos NOVOS. Este planner decide, por perfil
 * anônimo com um ou mais `emailLogId` capturados dos seus eventos, se é
 * seguro herdar retroativamente o nome/e-mail do destinatário — mesma guarda
 * de divergência do E6b: rastro ambíguo (destinatários diferentes) ou e-mail
 * já pertencente a outro perfil nunca herda.
 */

function trace(overrides: Partial<AnonymousProfileEmailTrace> = {}): AnonymousProfileEmailTrace {
  return { profileId: "profile-anonimo-1", teamId: "team-1", emailLogIds: ["log-1"], ...overrides }
}

function log(overrides: Partial<EmailLogRecipient> = {}): EmailLogRecipient {
  return { id: "log-1", recipientEmail: "leonardo@example.com", recipientName: "Leonardo Reinvent", ...overrides }
}

describe("planAnonymousCampaignRecipientInheritance", () => {
  it("um único emailLogId, e-mail livre → herda nome + e-mail do destinatário", () => {
    const plan = planAnonymousCampaignRecipientInheritance(
      [trace()],
      new Map([["log-1", log()]]),
      new Map()
    )

    expect(plan.items).toEqual([
      {
        profileId: "profile-anonimo-1",
        teamId: "team-1",
        recipientEmail: "leonardo@example.com",
        recipientName: "Leonardo Reinvent",
        emailLogId: "log-1",
      },
    ])
    expect(plan.skipped).toEqual([])
  })

  it("múltiplos emailLogIds mas TODOS apontam para o MESMO destinatário → herda normalmente (não é ambíguo)", () => {
    const plan = planAnonymousCampaignRecipientInheritance(
      [trace({ emailLogIds: ["log-1", "log-2"] })],
      new Map([
        ["log-1", log({ id: "log-1" })],
        ["log-2", log({ id: "log-2", recipientName: "Leonardo Reinvent" })],
      ]),
      new Map()
    )

    expect(plan.items).toHaveLength(1)
    expect(plan.items[0]?.recipientEmail).toBe("leonardo@example.com")
    expect(plan.skipped).toEqual([])
  })

  it("múltiplos emailLogIds com destinatários DIFERENTES → pula, conta 'multiplos_destinatarios_divergentes' (ambíguo)", () => {
    const plan = planAnonymousCampaignRecipientInheritance(
      [trace({ emailLogIds: ["log-1", "log-2"] })],
      new Map([
        ["log-1", log({ id: "log-1", recipientEmail: "leonardo@example.com" })],
        ["log-2", log({ id: "log-2", recipientEmail: "outra.pessoa@example.com" })],
      ]),
      new Map()
    )

    expect(plan.items).toEqual([])
    expect(plan.skipped).toEqual([
      { profileId: "profile-anonimo-1", reason: "multiplos_destinatarios_divergentes" },
    ])
  })

  it("emailLogId sem EmailLog correspondente (registro removido/inacessível) → pula, conta 'sem_emaillog_correspondente'", () => {
    const plan = planAnonymousCampaignRecipientInheritance([trace()], new Map(), new Map())

    expect(plan.items).toEqual([])
    expect(plan.skipped).toEqual([
      { profileId: "profile-anonimo-1", reason: "sem_emaillog_correspondente" },
    ])
  })

  it("e-mail do destinatário JÁ pertence a outro perfil (RadarIdentity já reivindicada) → pula, conta 'email_ja_pertence_a_outro_perfil' (é caso de merge, não de herança)", () => {
    const plan = planAnonymousCampaignRecipientInheritance(
      [trace()],
      new Map([["log-1", log()]]),
      new Map([["leonardo@example.com", "profile-outro-dono"]])
    )

    expect(plan.items).toEqual([])
    expect(plan.skipped).toEqual([
      { profileId: "profile-anonimo-1", reason: "email_ja_pertence_a_outro_perfil" },
    ])
  })

  it("recipientName do EmailLog é o próprio e-mail (placeholder, não nome real) → herda o e-mail mas NÃO usa o e-mail como nome exibido", () => {
    const plan = planAnonymousCampaignRecipientInheritance(
      [trace()],
      new Map([["log-1", log({ recipientName: "leonardo@example.com" })]]),
      new Map()
    )

    expect(plan.items).toHaveLength(1)
    expect(plan.items[0]?.recipientEmail).toBe("leonardo@example.com")
    expect(plan.items[0]?.recipientName).toBeNull()
  })

  it("recipientName do EmailLog ausente (null) → herda o e-mail com recipientName null (comportamento original)", () => {
    const plan = planAnonymousCampaignRecipientInheritance(
      [trace()],
      new Map([["log-1", log({ recipientName: null })]]),
      new Map()
    )

    expect(plan.items[0]?.recipientName).toBeNull()
  })

  it("e-mail do destinatário pertence ao MESMO perfil anônimo (já reivindicado antes) → herda normalmente", () => {
    const plan = planAnonymousCampaignRecipientInheritance(
      [trace()],
      new Map([["log-1", log()]]),
      new Map([["leonardo@example.com", "profile-anonimo-1"]])
    )

    expect(plan.items).toHaveLength(1)
  })

  it("múltiplos perfis → cada um decidido independentemente", () => {
    const plan = planAnonymousCampaignRecipientInheritance(
      [
        trace({ profileId: "profile-1", emailLogIds: ["log-1"] }),
        trace({ profileId: "profile-2", emailLogIds: ["log-x"] }),
      ],
      new Map([["log-1", log({ id: "log-1" })]]),
      new Map()
    )

    expect(plan.items).toHaveLength(1)
    expect(plan.items[0]?.profileId).toBe("profile-1")
    expect(plan.skipped).toEqual([{ profileId: "profile-2", reason: "sem_emaillog_correspondente" }])
  })

  it("nenhum perfil → plano vazio", () => {
    const plan = planAnonymousCampaignRecipientInheritance([], new Map(), new Map())
    expect(plan).toEqual({ items: [], skipped: [] })
  })
})
