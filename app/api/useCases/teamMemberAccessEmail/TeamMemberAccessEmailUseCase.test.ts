import { beforeEach, describe, expect, it, mock } from "bun:test"
import type {
  BackofficeMemberAccessProfileRecord,
  IBackofficeMemberAccessRepository,
} from "@/app/api/infra/data/repositories/backoffice/MemberAccessRepository/IBackofficeMemberAccessRepository"
import type { BackofficeMemberAccessSnapshot } from "@/lib/backoffice-member-access"
import type { AccessHistoryEmail } from "@/lib/team-member-access/access-history"
import { TeamMemberAccessEmailUseCase } from "./TeamMemberAccessEmailUseCase"

const PROFILE: BackofficeMemberAccessProfileRecord = {
  profileId: "operator-1",
  supabaseId: "sb-operator-1",
  email: "ana@corretora.com.br",
  fullName: "Ana Souza",
  role: "operator",
  isMaster: false,
  managerName: "Corretora Exemplo",
}

const pending = { accessStatus: "pending_first_access" } as BackofficeMemberAccessSnapshot
const active = { accessStatus: "active" } as BackofficeMemberAccessSnapshot

const findTeamMember = mock(async (_teamId: string, profileId: string) => ({ profileId }))
const findProfileAccessRecord = mock(async (_input: { profileId: string; accountMasterId: string }) => PROFILE as BackofficeMemberAccessProfileRecord | null)
const runWithInviteLock = mock(async <T,>(_profileId: string, work: () => Promise<T>) => ({ acquired: true as const, result: await work() }))
const resolveAccess = mock(async (_profile: BackofficeMemberAccessProfileRecord) => pending)
const sendEmail = mock(async (_input: { profile: BackofficeMemberAccessProfileRecord; mode: string }) => ({ dispatchId: "dispatch-new" as string | null }))
const ACCESS_EMAIL: AccessHistoryEmail = {
  id: "dispatch-1",
  category: "access_invite",
  recipientEmail: "ana@corretora.com.br",
  status: "delivered",
  createdAt: "2026-11-07T12:00:00.000Z",
  deliveredAt: "2026-11-07T12:00:05.000Z",
  openedAt: null,
  bouncedAt: null,
}
const listAccessEmails = mock(async (_input: { accountId: string; profileId: string; limit: number }) => [ACCESS_EMAIL])
const recordAccessEmail = mock(async (_input: unknown) => undefined)
const listTeamMemberIdentities = mock(async (_input: { teamId: string; accountId: string }) => [
  { profileId: "operator-1", supabaseId: "sb-1", email: "ana@corretora.com.br", fullName: "Ana", role: "operator" as const },
  { profileId: "operator-2", supabaseId: "sb-2", email: "caio@corretora.com.br", fullName: "Caio", role: "manager" as const },
])
const listLatestAccessEmails = mock(async (_input: { accountId: string; profileIds: string[] }) =>
  new Map([["operator-2", { status: "bounced" as const, createdAt: "2026-11-05T12:00:00.000Z" }]])
)
const resolveAccessMany = mock(async (_profiles: unknown) =>
  new Map([["operator-1", { ...active, lastSignInAt: "2026-11-06T10:00:00.000Z" } as BackofficeMemberAccessSnapshot]])
)

const useCase = new TeamMemberAccessEmailUseCase({
  memberAccess: { findProfileAccessRecord, runWithInviteLock: runWithInviteLock as unknown as IBackofficeMemberAccessRepository["runWithInviteLock"] },
  findTeamMember,
  resolveAccess,
  resolveAccessMany,
  sendEmail,
  history: { listAccessEmails, recordAccessEmail, listTeamMemberIdentities, listLatestAccessEmails },
})
const input = { teamId: "team-1", accountMasterId: "master-1", targetProfileId: "operator-1", requesterProfileId: "manager-1" }

beforeEach(() => {
  for (const fn of [findTeamMember, findProfileAccessRecord, runWithInviteLock, resolveAccess, sendEmail, listAccessEmails, recordAccessEmail]) fn.mockClear()
  sendEmail.mockImplementation(async () => ({ dispatchId: "dispatch-new" }))
  recordAccessEmail.mockImplementation(async () => undefined)
  findTeamMember.mockImplementation(async (_teamId, profileId) => ({ profileId }))
  findProfileAccessRecord.mockImplementation(async () => PROFILE)
  resolveAccess.mockImplementation(async () => pending)
  runWithInviteLock.mockImplementation(async (_profileId, work) => ({ acquired: true as const, result: await work() }))
})

describe("TeamMemberAccessEmailUseCase", () => {
  it("quem ainda não entrou recebe o e-mail de primeiro acesso", async () => {
    const { output, status } = await useCase.sendAccessEmail(input)

    expect(status).toBe(200)
    expect(sendEmail).toHaveBeenCalledWith({ profile: PROFILE, mode: "invite" })
    expect(output.successMessages[0]).toBe("E-mail de primeiro acesso enviado para ana@corretora.com.br.")
    expect(output.successMessages[1]).toContain("até 5 minutos")
    expect(output.successMessages[1]).toContain("spam")
    expect(findProfileAccessRecord).toHaveBeenCalledWith({ profileId: "operator-1", accountMasterId: "master-1" })
  })

  it("quem já entrou recebe o link de nova senha, não um convite", async () => {
    resolveAccess.mockImplementation(async () => active)

    await useCase.sendAccessEmail(input)

    expect(sendEmail).toHaveBeenCalledWith({ profile: PROFILE, mode: "reset_password" })
  })

  it("não envia para quem não é do time de quem pede", async () => {
    findTeamMember.mockImplementation(async () => null as unknown as { profileId: string })

    const { status } = await useCase.sendAccessEmail(input)

    expect(status).toBe(404)
    expect(findProfileAccessRecord).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("não envia para membro de outra conta", async () => {
    findProfileAccessRecord.mockImplementation(async () => null)

    const { status } = await useCase.sendAccessEmail(input)

    expect(status).toBe(404)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("não envia para o próprio master da conta", async () => {
    const { status } = await useCase.sendAccessEmail({ ...input, targetProfileId: "master-1" })

    expect(status).toBe(400)
    expect(findTeamMember).not.toHaveBeenCalled()
  })

  it("um envio em andamento para a mesma pessoa bloqueia o segundo", async () => {
    runWithInviteLock.mockImplementation(async () => ({ acquired: false as const }) as never)

    const { status } = await useCase.sendAccessEmail(input)

    expect(status).toBe(409)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("histórico traz último acesso e e-mails de acesso da pessoa", async () => {
    resolveAccess.mockImplementation(async () => ({ ...active, lastSignInAt: "2026-11-06T10:00:00.000Z" }))

    const { output, status } = await useCase.getAccessHistory(input)

    expect(status).toBe(200)
    expect(output.result).toEqual({
      email: "ana@corretora.com.br",
      name: "Ana Souza",
      lastSignInAt: "2026-11-06T10:00:00.000Z",
      emails: [ACCESS_EMAIL],
    })
    expect(listAccessEmails).toHaveBeenCalledWith({ accountId: "master-1", profileId: "operator-1", limit: 10 })
  })

  it("histórico é por conta: quem pede vê só os envios da própria conta", async () => {
    await useCase.getAccessHistory({ ...input, accountMasterId: "master-corretor-b" })

    expect(listAccessEmails).toHaveBeenCalledWith(expect.objectContaining({ accountId: "master-corretor-b" }))
  })

  it("cada envio fica ligado à conta, ao time e a quem pediu", async () => {
    await useCase.sendAccessEmail(input)

    expect(recordAccessEmail).toHaveBeenCalledWith({
      accountId: "master-1",
      teamId: "team-1",
      profileId: "operator-1",
      dispatchId: "dispatch-new",
      requestedByProfileId: "manager-1",
    })
  })

  it("falha ao registrar não vira erro para quem pediu: o e-mail já saiu", async () => {
    recordAccessEmail.mockImplementation(async () => {
      throw new Error("db fora")
    })

    const { status } = await useCase.sendAccessEmail(input)

    expect(status).toBe(200)
  })

  it("histórico de quem não é do time não é consultado", async () => {
    findTeamMember.mockImplementation(async () => null as unknown as { profileId: string })

    const { status } = await useCase.getAccessHistory(input)

    expect(status).toBe(404)
    expect(listAccessEmails).not.toHaveBeenCalled()
    expect(resolveAccess).not.toHaveBeenCalled()
  })

  it("resumo do time traz último login e último e-mail desta conta por pessoa", async () => {
    const { output, status } = await useCase.getTeamAccessSummary({ teamId: "team-1", accountMasterId: "master-1" })

    expect(status).toBe(200)
    expect(output.result).toEqual([
      { profileId: "operator-1", lastSignInAt: "2026-11-06T10:00:00.000Z", lastEmail: null },
      { profileId: "operator-2", lastSignInAt: null, lastEmail: { status: "bounced", createdAt: "2026-11-05T12:00:00.000Z" } },
    ])
    expect(listTeamMemberIdentities).toHaveBeenCalledWith({ teamId: "team-1", accountId: "master-1" })
    expect(listLatestAccessEmails).toHaveBeenCalledWith({ accountId: "master-1", profileIds: ["operator-1", "operator-2"] })
  })

  it("falha no envio volta como erro, sem sucesso falso", async () => {
    sendEmail.mockImplementation(async () => {
      throw new Error("Reenvio duplicado — aguarde alguns segundos e tente novamente.")
    })

    const { output, status } = await useCase.sendAccessEmail(input)

    expect(status).toBe(500)
    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("Reenvio duplicado")
  })
})
