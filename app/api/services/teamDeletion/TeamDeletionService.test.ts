import { describe, expect, it, mock } from "bun:test"
import { Output } from "@/lib/output"
import { TeamDeletionService } from "./TeamDeletionService"

function build(order: string[] = [], overrides: { deleteOutput?: Output } = {}) {
  const repository = {
    snapshot: mock(async (_teamId: string) => ({
      memberProfileIds: ["m-1", "m-2"],
      leadCount: 40,
      memberCount: 2,
      storagePaths: [
        { bucket: "lead-attachments", path: "a/1.pdf" },
        { bucket: "lead-attachments", path: "a/2.pdf" },
      ],
    })),
  }
  const teamRemover = {
    deleteTeam: mock(async (_teamId: string, _actor: string, _details: unknown) => {
      order.push("deleteTeam")
      return overrides.deleteOutput ?? new Output(true, ["ok"], [], { teamId: "team-1" })
    }),
  }
  const memberFollowUp = {
    handleTeamDeleted: mock(async (_input: { teamId: string; memberProfileIds: string[] }) => {
      order.push("followUp")
    }),
  }
  const storageCleaner = {
    removeFiles: mock(async (_items: { bucket: string; path: string }[]) => {
      order.push("cleanStorage")
    }),
  }
  const billing = {
    syncBillingAfterUsageChange: mock(async (_owner: string, _reason: string) => {
      order.push("billing")
    }),
  }
  const service = new TeamDeletionService(repository, teamRemover, memberFollowUp, storageCleaner, billing)
  return { service, repository, teamRemover, memberFollowUp, storageCleaner, billing }
}

const input = { teamId: "team-1", actorProfileId: "actor-1", billingOwnerId: "master-1" }

describe("TeamDeletionService.deleteNow", () => {
  it("exclui o time, trata os usuários, apaga os arquivos e recalcula a cobrança, nessa ordem", async () => {
    const order: string[] = []
    const { service } = build(order)

    const result = await service.deleteNow(input)

    expect(order).toEqual(["deleteTeam", "followUp", "cleanStorage", "billing"])
    expect(result).toEqual({ leads: 40, members: 2 })
  })

  it("a auditoria recebe quantos leads e membros foram apagados", async () => {
    const { service, teamRemover } = build()

    await service.deleteNow(input)

    expect(teamRemover.deleteTeam).toHaveBeenCalledWith("team-1", "actor-1", { leads: 40, members: 2 })
  })

  it("quem estava no time é tratado depois da exclusão (sessão cai se não tiver outro time)", async () => {
    const { service, memberFollowUp } = build()

    await service.deleteNow(input)

    expect(memberFollowUp.handleTeamDeleted).toHaveBeenCalledWith({ teamId: "team-1", memberProfileIds: ["m-1", "m-2"] })
  })

  it("apaga os arquivos que o time tinha no armazenamento", async () => {
    const { service, storageCleaner } = build()

    await service.deleteNow(input)

    expect(storageCleaner.removeFiles).toHaveBeenCalledWith([
      { bucket: "lead-attachments", path: "a/1.pdf" },
      { bucket: "lead-attachments", path: "a/2.pdf" },
    ])
  })

  it("se o banco não exclui o time, lança erro e não mexe em usuários, arquivos nem cobrança", async () => {
    const order: string[] = []
    const { service, memberFollowUp, storageCleaner, billing } = build(order, {
      deleteOutput: new Output(false, [], ["Erro interno ao deletar time"], null),
    })

    await expect(service.deleteNow(input)).rejects.toThrow("Erro interno ao deletar time")

    expect(memberFollowUp.handleTeamDeleted).not.toHaveBeenCalled()
    expect(storageCleaner.removeFiles).not.toHaveBeenCalled()
    expect(billing.syncBillingAfterUsageChange).not.toHaveBeenCalled()
  })

  it("falha em usuários, arquivos ou cobrança não desfaz a exclusão nem impede as outras etapas", async () => {
    const order: string[] = []
    const { service, memberFollowUp, storageCleaner, billing } = build(order)
    memberFollowUp.handleTeamDeleted.mockRejectedValue(new Error("sessão"))
    storageCleaner.removeFiles.mockRejectedValue(new Error("storage"))
    billing.syncBillingAfterUsageChange.mockRejectedValue(new Error("asaas"))

    const result = await service.deleteNow(input)

    expect(result).toEqual({ leads: 40, members: 2 })
    expect(billing.syncBillingAfterUsageChange).toHaveBeenCalledWith("master-1", "remove_team")
  })
})
