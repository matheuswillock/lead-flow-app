import { beforeEach, describe, expect, it, mock } from "bun:test"

const profileUpdateMock = mock((_args: unknown) => ({ __op: "profile.update", args: _args }))
const pendingOperatorUpdateMock = mock((_args: unknown) => ({ __op: "pendingOperator.update", args: _args }))
const transactionMock = mock(async (ops: unknown[]) => ops)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    profile: { update: profileUpdateMock },
    pendingOperator: { update: pendingOperatorUpdateMock },
    $transaction: transactionMock,
  },
}))

const { PendingOperatorRepository } = await import("./PendingOperatorRepository")

describe("PendingOperatorRepository.finalizeOperatorCreation", () => {
  beforeEach(() => {
    profileUpdateMock.mockClear()
    pendingOperatorUpdateMock.mockClear()
    transactionMock.mockClear()
  })

  // Achado cursor[bot] (PR #1137, P1, round 12): increment de
  // operatorCount e o marcador operatorCreated/operatorId precisam
  // suceder ou falhar juntos — dois awaits sequenciais permitiam um
  // retry duplo-incrementar se o segundo write falhasse depois do
  // primeiro ter sido persistido.
  it("roda o increment do Profile e o marcador do PendingOperator dentro do mesmo prisma.$transaction", async () => {
    const repo = new PendingOperatorRepository()

    await repo.finalizeOperatorCreation("pending-op-1", "operator-1", "manager-1")

    expect(transactionMock).toHaveBeenCalledTimes(1)
    expect(profileUpdateMock).toHaveBeenCalledWith({
      where: { id: "manager-1" },
      data: { operatorCount: { increment: 1 } },
    })
    expect(pendingOperatorUpdateMock).toHaveBeenCalledWith({
      where: { id: "pending-op-1" },
      data: { operatorCreated: true, operatorId: "operator-1" },
    })

    const [ops] = transactionMock.mock.calls[0] as [unknown[]]
    expect(ops).toEqual([
      profileUpdateMock.mock.results[0]!.value,
      pendingOperatorUpdateMock.mock.results[0]!.value,
    ])
  })
})
