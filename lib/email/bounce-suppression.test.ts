import { describe, expect, it } from "bun:test"
import {
  CONTENT_REJECTED_BOUNCE_SUBTYPE,
  isMailboxFullBounce,
  isPermanentBounce,
  shouldStampIsBouncedFromEventMetadata,
  shouldSuppressContactOnBounce,
} from "./bounce-suppression"

describe("shouldSuppressContactOnBounce", () => {
  it("não stamp em MailboxFull", () => {
    expect(
      shouldSuppressContactOnBounce({
        type: "Transient",
        subType: "MailboxFull",
        message: "The recipient's email provider sent a bounce message because the recipient's inbox was full.",
      })
    ).toBe(false)
  })

  it("não stamp no fallback legado da mensagem de caixa cheia", () => {
    expect(
      shouldSuppressContactOnBounce({
        type: "Transient",
        message: "The recipient's inbox was full.",
      })
    ).toBe(false)
    expect(isMailboxFullBounce({ message: "inbox was full" })).toBe(true)
  })

  it("stamp só Permanent — ContentRejected (Terra) não stamp", () => {
    expect(
      shouldSuppressContactOnBounce({
        type: "Permanent",
        subType: "General",
        message: "hard bounce",
      })
    ).toBe(true)
    expect(isPermanentBounce({ type: "Permanent" })).toBe(true)
    expect(
      shouldSuppressContactOnBounce({
        type: "Transient",
        subType: CONTENT_REJECTED_BOUNCE_SUBTYPE,
        message: "content that the provider doesn't allow",
      })
    ).toBe(false)
  })

  it("não stamp sem bounceType", () => {
    expect(
      shouldSuppressContactOnBounce({
        subType: "General",
        message: "hard bounce",
      })
    ).toBe(false)
  })

  it("lê bounceType Permanent do metadata do evento", () => {
    expect(
      shouldStampIsBouncedFromEventMetadata({
        bounceType: "Transient",
        bounceSubType: CONTENT_REJECTED_BOUNCE_SUBTYPE,
        bounceMessage: "content that the provider doesn't allow",
        bounceDiagnosticCode: ["smtp; 554 5.7.1"],
      })
    ).toBe(false)
    expect(
      shouldStampIsBouncedFromEventMetadata({
        bounceType: "Permanent",
        bounceSubType: "General",
        bounceMessage: "user unknown",
      })
    ).toBe(true)
    expect(
      shouldStampIsBouncedFromEventMetadata({
        bounceType: "Transient",
        bounceSubType: "MailboxFull",
        bounceMessage: "The recipient's inbox was full.",
      })
    ).toBe(false)
  })
})

/**
 * Trava de decisão de produto, não teste de comportamento.
 *
 * A supressão por bounce é intencionalmente GLOBAL: não filtra por time. Já
 * houve tentativa de "corrigir" isso como se fosse falta de escopo. Estes
 * testes falham se alguém adicionar `teamId` às consultas, forçando a leitura
 * do racional antes de mudar.
 */
describe("escopo da supressão por bounce (decisão de produto)", () => {
  it("findBouncedEmails não filtra por time", async () => {
    const source = await Bun.file(
      "app/api/infra/data/repositories/emailContactList/EmailContactListRepository.ts",
    ).text()
    const body = source.slice(
      source.indexOf("async findBouncedEmails"),
      source.indexOf("async createContacts"),
    )

    expect(body).not.toContain("teamId")
    expect(body).toContain("isBounced: true")
  })

  it("o stamp de bounce é global, ao contrário do de reclamação", async () => {
    const source = await Bun.file(
      "app/api/infra/data/repositories/emailLog/EmailLogRepository.ts",
    ).text()
    const bouncedBranch = source.slice(
      source.indexOf('if (eventType === "bounced")'),
      source.indexOf('if (eventType === "complained")'),
    )
    const complainedBranch = source.slice(
      source.indexOf('if (eventType === "complained")'),
      source.indexOf("if (log.campaignId)"),
    )

    // Bounce: propriedade do endereço, vale para qualquer remetente.
    expect(bouncedBranch).not.toContain("teamId")
    // Reclamação: relação destinatário-remetente, por time.
    expect(complainedBranch).toContain("teamId")
  })

  it("o stamp casa e-mail sem depender de caixa (contatos não são normalizados na escrita)", async () => {
    const source = await Bun.file(
      "app/api/infra/data/repositories/emailLog/EmailLogRepository.ts",
    ).text()
    const bouncedBranch = source.slice(
      source.indexOf('if (eventType === "bounced")'),
      source.indexOf('if (eventType === "complained")'),
    )

    expect(bouncedBranch).toContain('mode: "insensitive"')
  })
})
