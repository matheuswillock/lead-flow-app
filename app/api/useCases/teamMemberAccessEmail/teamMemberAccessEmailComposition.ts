import { BackofficeMemberAccessRepository } from "@/app/api/infra/data/repositories/backoffice/MemberAccessRepository/BackofficeMemberAccessRepository"
import { teamMemberAccessHistoryRepository } from "@/app/api/infra/data/repositories/teamMemberAccessHistory/TeamMemberAccessHistoryRepository"
import { managerAccountUserRepository } from "@/app/api/infra/data/repositories/managerAccountUser/ManagerAccountUserRepository"
import {
  resolveBackofficeMemberAccess,
  sendBackofficeMemberAccessEmail,
} from "@/lib/backoffice-member-access"
import { TeamMemberAccessEmailUseCase } from "./TeamMemberAccessEmailUseCase"

export const teamMemberAccessEmailUseCase = new TeamMemberAccessEmailUseCase({
  memberAccess: new BackofficeMemberAccessRepository(),
  findTeamMember: (teamId, profileId) => managerAccountUserRepository.findTeamMember(teamId, profileId),
  resolveAccess: async (profile) => {
    const snapshots = await resolveBackofficeMemberAccess([profile])
    const snapshot = snapshots.get(profile.profileId)
    if (!snapshot) throw new Error("Não foi possível verificar o acesso do usuário")
    return snapshot
  },
  resolveAccessMany: (profiles) => resolveBackofficeMemberAccess(profiles),
  sendEmail: (input) => sendBackofficeMemberAccessEmail(input),
  history: teamMemberAccessHistoryRepository,
})
