import { describe, expect, it } from "bun:test"
import { buildLeadTransferCopyOrigin, buildLeadTransferCopyRequestKey } from "./lead-transfer-submission-copy"

describe("buildLeadTransferCopyRequestKey", () => {
  it("é determinístico por submission de origem + time destino (idempotência)", () => {
    const key = buildLeadTransferCopyRequestKey("sub-1", "team-2")
    expect(key).toBe("lead-transfer-copy:sub-1:team-2")
    expect(buildLeadTransferCopyRequestKey("sub-1", "team-2")).toBe(key)
  })

  it("gera chaves diferentes para times de destino diferentes", () => {
    expect(buildLeadTransferCopyRequestKey("sub-1", "team-a")).not.toBe(
      buildLeadTransferCopyRequestKey("sub-1", "team-b"),
    )
  })
})

describe("buildLeadTransferCopyOrigin", () => {
  it("preserva o origin original e adiciona metadata de cópia", () => {
    const copiedAt = new Date("2026-08-10T12:00:00.000Z")
    const result = buildLeadTransferCopyOrigin({
      sourceOrigin: { source: "email_campaign", campaignId: "camp-1" },
      sourceSubmissionId: "sub-1",
      sourceFormId: "form-1",
      sourceFormName: "Rede D'Or Guarulhos",
      sourceTeamId: "team-origin",
      targetTeamId: "team-destino",
      copiedAt,
    })

    expect(result).toEqual({
      source: "email_campaign",
      campaignId: "camp-1",
      leadTransferCopy: {
        sourceSubmissionId: "sub-1",
        sourceFormId: "form-1",
        sourceFormName: "Rede D'Or Guarulhos",
        sourceTeamId: "team-origin",
        targetTeamId: "team-destino",
        copiedAt: "2026-08-10T12:00:00.000Z",
      },
    })
  })

  it("não quebra quando o origin de origem é nulo/inválido", () => {
    const result = buildLeadTransferCopyOrigin({
      sourceOrigin: null,
      sourceSubmissionId: "sub-1",
      sourceFormId: "form-1",
      sourceFormName: "Form X",
      sourceTeamId: "team-a",
      targetTeamId: "team-b",
      copiedAt: new Date("2026-08-10T00:00:00.000Z"),
    })

    expect(result.leadTransferCopy).toBeDefined()
    expect(Object.keys(result)).toEqual(["leadTransferCopy"])
  })
})
