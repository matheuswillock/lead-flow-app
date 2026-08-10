import { describe, expect, it } from "bun:test"
import {
  buildLeadTransferCopyOrigin,
  buildLeadTransferCopyRequestKey,
  mergeLeadTransferListSubmissions,
  resolveLeadTransferCopySourceSubmissionId,
  shouldSkipLeadTransferCopyForRootInTarget,
} from "./lead-transfer-submission-copy"

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

describe("shouldSkipLeadTransferCopyForRootInTarget", () => {
  it("pula cópia quando a submission raiz já está no time destino (A→B→A)", () => {
    expect(
      shouldSkipLeadTransferCopyForRootInTarget({
        rootSubmissionTeamId: "team-a",
        targetTeamId: "team-a",
      }),
    ).toBe(true)
  })

  it("não pula quando a raiz está em outro time", () => {
    expect(
      shouldSkipLeadTransferCopyForRootInTarget({
        rootSubmissionTeamId: "team-a",
        targetTeamId: "team-b",
      }),
    ).toBe(false)
  })
})

describe("mergeLeadTransferListSubmissions", () => {
  it("prefere a cópia scoped e omite a submission raiz duplicada do legado", () => {
    const copyOrigin = buildLeadTransferCopyOrigin({
      sourceOrigin: null,
      sourceSubmissionId: "sub-root",
      sourceFormId: "form-a",
      sourceFormName: "Form A",
      sourceTeamId: "team-a",
      targetTeamId: "team-b",
      copiedAt: new Date("2026-08-10T12:00:00.000Z"),
    })

    const scoped = [
      {
        id: "sub-copy-b",
        origin: copyOrigin,
        createdAt: new Date("2026-08-10T12:00:00.000Z"),
        label: "copy",
      },
    ]
    const legacy = [
      {
        id: "sub-root",
        origin: { source: "web" },
        createdAt: new Date("2026-08-09T12:00:00.000Z"),
        label: "root",
      },
    ]

    const merged = mergeLeadTransferListSubmissions(scoped, legacy)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.id).toBe("sub-copy-b")
    expect(merged[0]?.label).toBe("copy")
  })

  it("mantém submissions legado sem cópia correspondente no time atual", () => {
    const scoped = [
      {
        id: "sub-local",
        origin: { source: "local" },
        createdAt: new Date("2026-08-10T15:00:00.000Z"),
      },
    ]
    const legacy = [
      {
        id: "sub-old",
        origin: { source: "web" },
        createdAt: new Date("2026-08-08T12:00:00.000Z"),
      },
    ]

    const merged = mergeLeadTransferListSubmissions(scoped, legacy)
    expect(merged.map((row) => row.id)).toEqual(["sub-local", "sub-old"])
  })
})

describe("resolveLeadTransferCopySourceSubmissionId", () => {
  it("usa a submission raiz quando a origem já é uma cópia de transferência", () => {
    const origin = buildLeadTransferCopyOrigin({
      sourceOrigin: null,
      sourceSubmissionId: "sub-root",
      sourceFormId: "form-1",
      sourceFormName: "Form",
      sourceTeamId: "team-a",
      targetTeamId: "team-b",
      copiedAt: new Date("2026-08-10T00:00:00.000Z"),
    })

    expect(resolveLeadTransferCopySourceSubmissionId(origin, "sub-copy-b")).toBe("sub-root")
  })

  it("mantém o id da submission quando não há metadata de cópia", () => {
    expect(resolveLeadTransferCopySourceSubmissionId({ source: "web" }, "sub-original")).toBe(
      "sub-original",
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
