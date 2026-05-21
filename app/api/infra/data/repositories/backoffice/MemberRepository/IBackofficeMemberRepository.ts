export interface MemberForUpdateRecord {
  id: string
  supabaseId: string | null
  email: string
  isMaster: boolean
}

export interface MemberForDeletionRecord {
  id: string
  supabaseId: string | null
  email: string
  fullName: string | null
  isMaster: boolean
  managerId: string | null
  subscriptionAsaasId: string | null
}

export interface MemberTeamMembershipRecord {
  teamId: string
  profileId: string
}

export interface IBackofficeMemberRepository {
  findAdminEmailByProfileId(profileId: string): Promise<string | null>

  findMemberForUpdate(memberId: string): Promise<MemberForUpdateRecord | null>

  updateMemberProfile(
    memberId: string,
    data: { fullName?: string; phone?: string | null; email?: string }
  ): Promise<{ id: string } | null>

  findMemberForDeletion(memberId: string): Promise<MemberForDeletionRecord | null>

  deleteMemberCascade(memberId: string): Promise<void>

  findTeamMembership(
    teamId: string,
    profileId: string
  ): Promise<MemberTeamMembershipRecord | null>

  deleteTeamMembership(teamId: string, profileId: string): Promise<void>
}
