import { beforeEach, describe, expect, it, mock } from "bun:test"
import type {
  BackofficeDeletionApprovalDecision,
  BackofficeDeletionRequestStatus,
  BackofficeDeletionRequestType,
} from "@prisma/client"
import type {
  BackofficeDeletionRequestListItem,
  IBackofficeDeletionRequestRepository,
} from "@/app/api/infra/data/repositories/backoffice/DeletionRequestRepository/IBackofficeDeletionRequestRepository"
import type { IBackofficeMemberRepository } from "@/app/api/infra/data/repositories/backoffice/MemberRepository/IBackofficeMemberRepository"
import { BackofficeDeletionRequestUseCase } from "./BackofficeDeletionRequestUseCase"

const MATHEUS = "matheuswillock@corretorstudio.com.br"
const BRUNO = "bruno@corretorstudio.com.br"

function baseRequest(
  overrides: Partial<BackofficeDeletionRequestListItem> = {}
): BackofficeDeletionRequestListItem {
  return {
    id: "req-1",
    type: "USER_DELETE",
    targetId: "profile-target",
    requestedByProfileId: "requester-1",
    requestedByEmail: "ops@corretorstudio.com.br",
    requestedByName: "Ops",
    status: "pending",
    reason: "teste",
    snapshot: { email: "alvo@example.com", isMaster: false },
    createdAt: new Date("2026-07-24T12:00:00.000Z"),
    executedAt: null,
    approvals: [],
    ...overrides,
  }
}

function createDeletionRepoMock(
  overrides: Partial<IBackofficeDeletionRequestRepository> = {}
): IBackofficeDeletionRequestRepository {
  return {
    create: async () => ({ id: "req-1" }),
    findById: async () => null,
    list: async () => [],
    findPendingForTarget: async () => null,
    createApproval: async () => undefined,
    updateStatus: async () => undefined,
    findProfileSnapshot: async () => ({
      id: "profile-target",
      email: "alvo@example.com",
      fullName: "Alvo",
      isMaster: false,
      deletedAt: null,
    }),
    findTeamSnapshot: async () => ({
      id: "team-1",
      name: "Salu Seguros",
      masterId: "master-1",
      deletedAt: null,
    }),
    findApproverProfileIdsByEmails: async () => [],
    ...overrides,
  }
}

function createMemberRepoMock(
  overrides: Partial<{
    findMemberForDeletion: IBackofficeMemberRepository["findMemberForDeletion"]
    softDeleteMemberCascade: IBackofficeMemberRepository["softDeleteMemberCascade"]
    softDeleteTeamCascade: IBackofficeMemberRepository["softDeleteTeamCascade"]
  }> = {}
): IBackofficeMemberRepository {
  return {
    findMemberForDeletion: async () => ({
      id: "profile-target",
      supabaseId: null,
      email: "alvo@example.com",
      fullName: "Alvo",
      isMaster: false,
      managerId: "master-1",
      subscriptionAsaasId: null,
    }),
    softDeleteMemberCascade: async () => undefined,
    softDeleteTeamCascade: async () => undefined,
    ...overrides,
  } as unknown as IBackofficeMemberRepository
}

describe("BackofficeDeletionRequestUseCase", () => {
  beforeEach(() => {
    mock.restore()
  })

  describe("createRequest", () => {
    it("cria USER_DELETE com snapshot e mensagem de 2 aprovações", async () => {
      const createdPayload: Array<{
        reason: string | null
        snapshot: { email: string; isMaster: boolean }
      }> = []
      const useCase = new BackofficeDeletionRequestUseCase(
        createDeletionRepoMock({
          create: async (input) => {
            createdPayload.push(input as (typeof createdPayload)[number])
            return { id: "req-new" }
          },
        }),
        createMemberRepoMock()
      )

      const output = await useCase.createRequest({
        type: "USER_DELETE",
        targetId: "profile-target",
        reason: "  zona de perigo  ",
        requestedByProfileId: "requester-1",
      })

      expect(output.isValid).toBe(true)
      expect(output.successMessages[0]).toContain("2 aprovações")
      expect(createdPayload[0]?.reason).toBe("zona de perigo")
      expect(createdPayload[0]?.snapshot.email).toBe("alvo@example.com")
      expect(createdPayload[0]?.snapshot.isMaster).toBe(false)
    })

    it("cria TEAM_DELETE com snapshot do time", async () => {
      const createdPayload: Array<{
        type: BackofficeDeletionRequestType
        snapshot: { name: string; masterId: string }
      }> = []
      const useCase = new BackofficeDeletionRequestUseCase(
        createDeletionRepoMock({
          create: async (input) => {
            createdPayload.push(input as (typeof createdPayload)[number])
            return { id: "req-team" }
          },
        }),
        createMemberRepoMock()
      )

      const output = await useCase.createRequest({
        type: "TEAM_DELETE",
        targetId: "team-1",
        requestedByProfileId: "requester-1",
      })

      expect(output.isValid).toBe(true)
      expect(createdPayload[0]?.type).toBe("TEAM_DELETE")
      expect(createdPayload[0]?.snapshot.name).toBe("Salu Seguros")
      expect(createdPayload[0]?.snapshot.masterId).toBe("master-1")
    })

    it("bloqueia quando já existe pending para o alvo", async () => {
      const useCase = new BackofficeDeletionRequestUseCase(
        createDeletionRepoMock({
          findPendingForTarget: async () => ({ id: "req-existing" }),
        }),
        createMemberRepoMock()
      )

      const output = await useCase.createRequest({
        type: "USER_DELETE",
        targetId: "profile-target",
        requestedByProfileId: "requester-1",
      })

      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toContain("Já existe uma solicitação pendente")
      expect((output.result as { id: string }).id).toBe("req-existing")
    })

    it("bloqueia usuário já soft-deleted", async () => {
      const useCase = new BackofficeDeletionRequestUseCase(
        createDeletionRepoMock({
          findProfileSnapshot: async () => ({
            id: "profile-target",
            email: "alvo@example.com",
            fullName: "Alvo",
            isMaster: false,
            deletedAt: new Date(),
          }),
        }),
        createMemberRepoMock()
      )

      const output = await useCase.createRequest({
        type: "USER_DELETE",
        targetId: "profile-target",
        requestedByProfileId: "requester-1",
      })

      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toContain("já excluído")
    })

    it("bloqueia time já soft-deleted", async () => {
      const useCase = new BackofficeDeletionRequestUseCase(
        createDeletionRepoMock({
          findTeamSnapshot: async () => ({
            id: "team-1",
            name: "Salu",
            masterId: "master-1",
            deletedAt: new Date(),
          }),
        }),
        createMemberRepoMock()
      )

      const output = await useCase.createRequest({
        type: "TEAM_DELETE",
        targetId: "team-1",
        requestedByProfileId: "requester-1",
      })

      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toContain("Time não encontrado ou já excluído")
    })
  })

  describe("decide", () => {
    it("rejeita decisores não autorizados", async () => {
      const useCase = new BackofficeDeletionRequestUseCase(
        createDeletionRepoMock({
          findById: async () => baseRequest(),
        }),
        createMemberRepoMock()
      )

      const output = await useCase.decide({
        requestId: "req-1",
        decision: "approved",
        approverProfileId: "other",
        approverEmail: "outro@corretorstudio.com.br",
      })

      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toContain("aprovadores autorizados")
    })

    it("rejeita decisão duplicada do mesmo aprovador", async () => {
      const useCase = new BackofficeDeletionRequestUseCase(
        createDeletionRepoMock({
          findById: async () =>
            baseRequest({
              approvals: [
                {
                  id: "a1",
                  approverProfileId: "matheus-id",
                  approverEmail: MATHEUS,
                  decision: "approved",
                  createdAt: new Date(),
                },
              ],
            }),
        }),
        createMemberRepoMock()
      )

      const output = await useCase.decide({
        requestId: "req-1",
        decision: "approved",
        approverProfileId: "matheus-id",
        approverEmail: MATHEUS,
      })

      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toContain("já registrou uma decisão")
    })

    it("retenta a execução quando ambas as aprovações já existem e a solicitação segue pending", async () => {
      const softDeleteMemberCascade = mock(async () => undefined)
      const updateStatus = mock(async () => undefined)
      const bothApprovals: BackofficeDeletionRequestListItem["approvals"] = [
        {
          id: "a1",
          approverProfileId: "matheus-id",
          approverEmail: MATHEUS,
          decision: "approved",
          createdAt: new Date(),
        },
        {
          id: "a2",
          approverProfileId: "bruno-id",
          approverEmail: BRUNO,
          decision: "approved",
          createdAt: new Date(),
        },
      ]

      const useCase = new BackofficeDeletionRequestUseCase(
        createDeletionRepoMock({
          findById: async () => baseRequest({ approvals: bothApprovals }),
          updateStatus,
        }),
        createMemberRepoMock({ softDeleteMemberCascade })
      )

      const output = await useCase.decide({
        requestId: "req-1",
        decision: "approved",
        approverProfileId: "bruno-id",
        approverEmail: BRUNO,
      })

      expect(output.isValid).toBe(true)
      expect(output.successMessages[0]).toContain("exclusão lógica executada")
      expect(softDeleteMemberCascade).toHaveBeenCalledWith(
        "profile-target",
        "bruno-id",
        "req-1"
      )
      expect(updateStatus).toHaveBeenCalledWith("req-1", "approved", expect.any(Date))
    })

    it("marca rejected ao receber rejeição de um aprovador", async () => {
      const updateStatus = mock(async () => undefined)
      const createApproval = mock(async () => undefined)
      const softDeleteMemberCascade = mock(async () => undefined)

      const useCase = new BackofficeDeletionRequestUseCase(
        createDeletionRepoMock({
          findById: async () => baseRequest(),
          createApproval,
          updateStatus,
        }),
        createMemberRepoMock({ softDeleteMemberCascade })
      )

      const output = await useCase.decide({
        requestId: "req-1",
        decision: "rejected",
        approverProfileId: "bruno-id",
        approverEmail: BRUNO,
      })

      expect(output.isValid).toBe(true)
      expect((output.result as { status: string }).status).toBe("rejected")
      expect(updateStatus).toHaveBeenCalledWith("req-1", "rejected")
      expect(softDeleteMemberCascade).not.toHaveBeenCalled()
    })

    it("aguarda segundo aprovador após a primeira aprovação", async () => {
      let approvals: BackofficeDeletionRequestListItem["approvals"] = []
      const createApproval = mock(
        async (input: {
          requestId: string
          approverProfileId: string
          decision: BackofficeDeletionApprovalDecision
        }) => {
          approvals = [
            ...approvals,
            {
              id: "a-new",
              approverProfileId: input.approverProfileId,
              approverEmail: MATHEUS,
              decision: input.decision,
              createdAt: new Date(),
            },
          ]
        }
      )
      const softDeleteMemberCascade = mock(async () => undefined)
      const updateStatus = mock(async () => undefined)

      const useCase = new BackofficeDeletionRequestUseCase(
        createDeletionRepoMock({
          findById: async () => baseRequest({ approvals }),
          createApproval,
          updateStatus,
        }),
        createMemberRepoMock({ softDeleteMemberCascade })
      )

      const output = await useCase.decide({
        requestId: "req-1",
        decision: "approved",
        approverProfileId: "matheus-id",
        approverEmail: MATHEUS,
      })

      expect(output.isValid).toBe(true)
      expect(output.successMessages[0]).toContain("segundo aprovador")
      expect(softDeleteMemberCascade).not.toHaveBeenCalled()
      expect(updateStatus).not.toHaveBeenCalled()
    })

    it("executa soft-delete de usuário ao atingir 2 aprovações distintas", async () => {
      const softDeleteCalls: Array<[string, string, string]> = []
      const softDeleteTeamCascade = mock(async () => undefined)
      const statusUpdates: Array<[string, string]> = []

      const approvalsAfter: BackofficeDeletionRequestListItem["approvals"] = [
        {
          id: "a1",
          approverProfileId: "matheus-id",
          approverEmail: MATHEUS,
          decision: "approved",
          createdAt: new Date(),
        },
        {
          id: "a2",
          approverProfileId: "bruno-id",
          approverEmail: BRUNO,
          decision: "approved",
          createdAt: new Date(),
        },
      ]

      let call = 0
      const useCase = new BackofficeDeletionRequestUseCase(
        createDeletionRepoMock({
          findById: async () => {
            call += 1
            if (call === 1) {
              return baseRequest({
                approvals: [approvalsAfter[0]!],
              })
            }
            return baseRequest({ approvals: approvalsAfter })
          },
          createApproval: async () => undefined,
          updateStatus: async (id, status) => {
            statusUpdates.push([id, status])
          },
        }),
        createMemberRepoMock({
          softDeleteMemberCascade: async (memberId, actorProfileId, requestId) => {
            softDeleteCalls.push([memberId, actorProfileId, requestId ?? ""])
          },
          softDeleteTeamCascade,
        })
      )

      const output = await useCase.decide({
        requestId: "req-1",
        decision: "approved",
        approverProfileId: "bruno-id",
        approverEmail: BRUNO,
      })

      expect(output.isValid).toBe(true)
      expect(output.successMessages[0]).toContain("exclusão lógica executada")
      expect(softDeleteCalls).toEqual([["profile-target", "bruno-id", "req-1"]])
      expect(softDeleteTeamCascade).not.toHaveBeenCalled()
      expect(statusUpdates[0]?.[0]).toBe("req-1")
      expect(statusUpdates[0]?.[1]).toBe("approved")
    })

    it("executa soft-delete de time ao atingir 2 aprovações", async () => {
      const softDeleteTeamCascade = mock(async () => undefined)
      const softDeleteMemberCascade = mock(async () => undefined)

      const approvalsAfter: BackofficeDeletionRequestListItem["approvals"] = [
        {
          id: "a1",
          approverProfileId: "matheus-id",
          approverEmail: MATHEUS,
          decision: "approved",
          createdAt: new Date(),
        },
        {
          id: "a2",
          approverProfileId: "bruno-id",
          approverEmail: BRUNO,
          decision: "approved",
          createdAt: new Date(),
        },
      ]

      let call = 0
      const useCase = new BackofficeDeletionRequestUseCase(
        createDeletionRepoMock({
          findById: async () => {
            call += 1
            if (call === 1) {
              return baseRequest({
                type: "TEAM_DELETE",
                targetId: "team-salu",
                approvals: [approvalsAfter[0]!],
              })
            }
            return baseRequest({
              type: "TEAM_DELETE",
              targetId: "team-salu",
              approvals: approvalsAfter,
            })
          },
          createApproval: async () => undefined,
          updateStatus: async () => undefined,
        }),
        createMemberRepoMock({ softDeleteMemberCascade, softDeleteTeamCascade })
      )

      const output = await useCase.decide({
        requestId: "req-1",
        decision: "approved",
        approverProfileId: "bruno-id",
        approverEmail: BRUNO,
      })

      expect(output.isValid).toBe(true)
      expect(softDeleteTeamCascade).toHaveBeenCalledWith("team-salu", "bruno-id", "req-1")
      expect(softDeleteMemberCascade).not.toHaveBeenCalled()
    })

    it("não executa soft-delete se a solicitação já foi finalizada", async () => {
      const softDeleteMemberCascade = mock(async () => undefined)
      const useCase = new BackofficeDeletionRequestUseCase(
        createDeletionRepoMock({
          findById: async () =>
            baseRequest({ status: "approved" as BackofficeDeletionRequestStatus }),
        }),
        createMemberRepoMock({ softDeleteMemberCascade })
      )

      const output = await useCase.decide({
        requestId: "req-1",
        decision: "approved",
        approverProfileId: "matheus-id",
        approverEmail: MATHEUS,
      })

      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toContain("já foi finalizada")
      expect(softDeleteMemberCascade).not.toHaveBeenCalled()
    })
  })

  describe("listRequests", () => {
    it("lista itens e ignora status inválido", async () => {
      const list = mock(async () => [baseRequest()])
      const useCase = new BackofficeDeletionRequestUseCase(
        createDeletionRepoMock({ list }),
        createMemberRepoMock()
      )

      const output = await useCase.listRequests({ status: "not-a-status" })
      expect(output.isValid).toBe(true)
      expect(list).toHaveBeenCalledWith({ status: undefined })
      expect((output.result as { items: unknown[] }).items).toHaveLength(1)
    })
  })
})
