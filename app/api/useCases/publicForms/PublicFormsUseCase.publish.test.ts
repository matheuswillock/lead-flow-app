import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { ITeamFormDomainRepository } from "@/app/api/infra/data/repositories/teamFormDomain/ITeamFormDomainRepository"

const getForm = mock(async () => ({ id: "form-1" }))
const getSettings = mock(async () => ({ approvalRequired: false, approverRoles: [] }))
const transition = mock(async () => ({ id: "form-1" }))
const publish = mock(async () => ({ id: "publication-1", version: 1 }))

mock.module("@/app/api/services/PublicForms/PublicFormsService", () => ({
  publicFormsService: { get: getForm, getSettings, transition, publish },
  buildPublicFormPreviewSnapshot: mock(() => ({})),
  mapPublicFormDraft: mock(() => ({})),
}))

mock.module("@/lib/public-forms/validate-public-form-draft", () => ({
  validatePublicFormDraft: mock(() => []),
}))

mock.module("@/app/api/infra/data/prisma", () => ({
  withPrismaRetry: async <T>(operation: () => Promise<T>) => operation(),
  default: {},
  prisma: {},
}))

const { PublicFormsUseCase } = await import("./PublicFormsUseCase")

const access = {
  teamId: "team-1",
  profileId: "profile-1",
  isMaster: true,
  teamMember: { role: "manager" },
} as never

function makeRepository(status: "verified" | "pending" | "failed" | null) {
  return {
    findByTeamId: mock(async () => (status ? { status } : null)),
  } as unknown as ITeamFormDomainRepository
}

describe("PublicFormsUseCase.publish", () => {
  beforeEach(() => {
    getForm.mockClear()
    getSettings.mockClear()
    transition.mockClear()
    publish.mockClear()
  })

  it("recusa a publicação sem subdomínio e não altera o formulário", async () => {
    const useCase = new PublicFormsUseCase(makeRepository(null))

    const output = await useCase.publish(access, "form-1")

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual([
      "Configure o subdomínio dos formulários antes de publicar. Depois que ele for verificado, você poderá publicar este formulário.",
    ])
    expect(getForm).not.toHaveBeenCalled()
    expect(transition).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
  })

  it.each(["pending", "failed"] as const)(
    "recusa a publicação quando o subdomínio está %s",
    async (status) => {
      const useCase = new PublicFormsUseCase(makeRepository(status))

      const output = await useCase.publish(access, "form-1")

      expect(output.isValid).toBe(false)
      expect(getForm).not.toHaveBeenCalled()
      expect(transition).not.toHaveBeenCalled()
      expect(publish).not.toHaveBeenCalled()
    },
  )

  it("publica normalmente quando o subdomínio está verificado", async () => {
    const useCase = new PublicFormsUseCase(makeRepository("verified"))

    const output = await useCase.publish(access, "form-1")

    expect(output.isValid).toBe(true)
    expect(publish).toHaveBeenCalledWith("team-1", "form-1", "profile-1")
  })
})
