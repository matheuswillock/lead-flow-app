import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Output } from "@/lib/output"
import { ProcessRadarProfileSyncUseCase } from "@/app/api/useCases/radar/ProcessRadarProfileSyncUseCase"

describe("ProcessRadarProfileSyncUseCase", () => {
  const syncLead = { execute: mock(async () => new Output(true, [], [], { crm: true })) }
  const syncPortfolio = { execute: mock(async () => new Output(true, [], [], { port: true })) }
  const syncFinalized = { execute: mock(async () => new Output(true, [], [], { fin: true })) }
  const syncProfileData = { execute: mock(async () => new Output(true, [], [], { data: true })) }

  beforeEach(() => {
    syncLead.execute.mockClear()
    syncPortfolio.execute.mockClear()
    syncFinalized.execute.mockClear()
    syncProfileData.execute.mockClear()
  })

  const useCase = () =>
    new ProcessRadarProfileSyncUseCase({
      syncLead,
      syncPortfolio,
      syncFinalized,
      syncProfileData,
    })

  it("crm roteia para SyncLeadToRadarUseCase", async () => {
    const result = await useCase().execute({ source: "crm", teamId: "t1", sourceId: "lead-1" })
    expect(result.isValid).toBe(true)
    expect(syncLead.execute).toHaveBeenCalledWith({ leadId: "lead-1", teamId: "t1" })
  })

  it("portfolio roteia para SyncPortfolioToRadarUseCase", async () => {
    await useCase().execute({ source: "portfolio", teamId: "t1", sourceId: "p1" })
    expect(syncPortfolio.execute).toHaveBeenCalledWith({ portfolioId: "p1", teamId: "t1" })
  })

  it("finalized roteia finalizedId e leadId", async () => {
    await useCase().execute({
      source: "finalized",
      teamId: "t1",
      sourceId: "fin-1",
      leadId: "lead-9",
    })
    expect(syncFinalized.execute).toHaveBeenCalledWith({
      teamId: "t1",
      finalizedId: "fin-1",
      leadId: "lead-9",
      leadIds: undefined,
    })
  })

  it("email_settings e bulk_import_finalize roteiam para profileData", async () => {
    await useCase().execute({ source: "email_settings", teamId: "t1", sourceId: "t1" })
    await useCase().execute({ source: "bulk_import_finalize", teamId: "t1" })
    expect(syncProfileData.execute).toHaveBeenCalledTimes(2)
  })

  it("crm sem sourceId é inválido", async () => {
    const result = await useCase().execute({ source: "crm", teamId: "t1" })
    expect(result.isValid).toBe(false)
    expect(syncLead.execute).not.toHaveBeenCalled()
  })
})
