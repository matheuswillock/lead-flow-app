import { describe, expect, mock, test } from "bun:test"
import { resolveParticipantDispatchGroups } from "./participantDispatch"
import type { ITeamMembersRepository } from "@/app/api/infra/data/repositories/teamMembers/ITeamMembersRepository"

/**
 * SPEC 13 (Agenda na Criação de Lead), A-E3 — "participantDispatch passa a
 * ler membros por repositório" (DA9). `resolveParticipantDispatchGroups`
 * agora recebe `ITeamMembersRepository` via parâmetro (DI), com o singleton
 * concreto só como valor padrão — testável com um dublê, sem `prisma` real.
 */
describe("resolveParticipantDispatchGroups — A-E3 (DA9)", () => {
  test("classifica e-mails de membros do time conectados ao Google como googleEligible", async () => {
    const repo: ITeamMembersRepository = {
      findGoogleConnectionStatusByEmails: mock(async () => [
        { email: "closer@example.com", googleCalendarConnected: true },
      ]),
    } as any

    const result = await resolveParticipantDispatchGroups(
      { teamId: "team-1", emails: ["closer@example.com", "lead@example.com"] },
      repo
    )

    expect(result.googleEligible).toEqual(["closer@example.com"])
    expect(result.internalConnected).toEqual(["closer@example.com"])
    expect(result.resendRequired).toEqual(["lead@example.com"])
    expect(result.externalOrUnknown).toEqual(["lead@example.com"])
  })

  test("membro do time sem Google conectado vai para resendRequired/internalDisconnected", async () => {
    const repo: ITeamMembersRepository = {
      findGoogleConnectionStatusByEmails: mock(async () => [
        { email: "closer@example.com", googleCalendarConnected: false },
      ]),
    } as any

    const result = await resolveParticipantDispatchGroups(
      { teamId: "team-1", emails: ["closer@example.com"] },
      repo
    )

    expect(result.resendRequired).toEqual(["closer@example.com"])
    expect(result.internalDisconnected).toEqual(["closer@example.com"])
    expect(result.googleEligible).toEqual([])
  })

  test("lista vazia de e-mails não chama o repositório", async () => {
    const findGoogleConnectionStatusByEmails = mock(async () => [])
    const repo: ITeamMembersRepository = { findGoogleConnectionStatusByEmails } as any

    const result = await resolveParticipantDispatchGroups({ teamId: "team-1", emails: [] }, repo)

    expect(findGoogleConnectionStatusByEmails).not.toHaveBeenCalled()
    expect(result.all).toEqual([])
  })
})
