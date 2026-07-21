import { describe, expect, it } from "bun:test"
import {
  attachUnsubscribeSourceToContacts,
  mapUnsubscribeSourcesByEmail,
  type UnsubscribeSourceCandidate,
} from "./resolve-contact-unsubscribe-source"

describe("mapUnsubscribeSourcesByEmail", () => {
  it("mapeia o evento unsubscribed mais recente por e-mail com campanha e assunto", () => {
    const candidates: UnsubscribeSourceCandidate[] = [
      {
        recipientEmail: "maria@exemplo.com",
        campaignId: "camp-old",
        campaignName: "Campanha Antiga",
        subject: "Assunto antigo",
        occurredAt: new Date("2026-07-01T10:00:00.000Z"),
      },
      {
        recipientEmail: "maria@exemplo.com",
        campaignId: "camp-new",
        campaignName: "LISTA FRIA - BRUNO",
        subject: "Corretor, receba LEADS PME sem Gastar com Anúncio",
        occurredAt: new Date("2026-07-21T16:24:00.000Z"),
      },
      {
        recipientEmail: "joao@exemplo.com",
        campaignId: "camp-2",
        campaignName: "LEADS PME CORRETOR",
        subject: "Uma ideia para otimizar sua corretora",
        occurredAt: new Date("2026-07-21T15:00:00.000Z"),
      },
    ]

    const byEmail = mapUnsubscribeSourcesByEmail(candidates)

    expect(byEmail.get("maria@exemplo.com")).toEqual({
      campaignId: "camp-new",
      campaignName: "LISTA FRIA - BRUNO",
      subject: "Corretor, receba LEADS PME sem Gastar com Anúncio",
      unsubscribedAt: "2026-07-21T16:24:00.000Z",
    })
    expect(byEmail.get("joao@exemplo.com")).toEqual({
      campaignId: "camp-2",
      campaignName: "LEADS PME CORRETOR",
      subject: "Uma ideia para otimizar sua corretora",
      unsubscribedAt: "2026-07-21T15:00:00.000Z",
    })
  })

  it("normaliza e-mail para lowercase ao agrupar", () => {
    const byEmail = mapUnsubscribeSourcesByEmail([
      {
        recipientEmail: "Maria@Exemplo.COM",
        campaignId: "camp-1",
        campaignName: "Campanha",
        subject: "Assunto",
        occurredAt: new Date("2026-07-21T12:00:00.000Z"),
      },
    ])

    expect(byEmail.get("maria@exemplo.com")?.campaignName).toBe("Campanha")
  })

  it("aceita campanha nula (webhook sem campaignId) mantendo o assunto do e-mail", () => {
    const byEmail = mapUnsubscribeSourcesByEmail([
      {
        recipientEmail: "sem-campanha@exemplo.com",
        campaignId: null,
        campaignName: null,
        subject: "E-mail avulso",
        occurredAt: new Date("2026-07-21T12:00:00.000Z"),
      },
    ])

    expect(byEmail.get("sem-campanha@exemplo.com")).toEqual({
      campaignId: null,
      campaignName: null,
      subject: "E-mail avulso",
      unsubscribedAt: "2026-07-21T12:00:00.000Z",
    })
  })
})

describe("attachUnsubscribeSourceToContacts", () => {
  it("anexa origem do descadastro aos contatos da blocklist", () => {
    const sources = mapUnsubscribeSourcesByEmail([
      {
        recipientEmail: "carol.ocipriani@gmail.com",
        campaignId: "camp-bruno",
        campaignName: "LISTA FRIA - BRUNO",
        subject: "Corretor, receba LEADS PME sem Gastar com Anúncio",
        occurredAt: new Date("2026-07-21T18:00:00.000Z"),
      },
    ])

    const enriched = attachUnsubscribeSourceToContacts(
      [
        { id: "c1", email: "carol.ocipriani@gmail.com", name: "Carol" },
        { id: "c2", email: "sem-evento@exemplo.com", name: null },
      ],
      sources
    )

    expect(enriched[0]?.unsubscribeSource).toEqual({
      campaignId: "camp-bruno",
      campaignName: "LISTA FRIA - BRUNO",
      subject: "Corretor, receba LEADS PME sem Gastar com Anúncio",
      unsubscribedAt: "2026-07-21T18:00:00.000Z",
    })
    expect(enriched[1]?.unsubscribeSource).toBeNull()
  })
})
