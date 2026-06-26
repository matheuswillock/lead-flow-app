export interface MemberForUpdateRecord {
  id: string
  supabaseId: string | null
  email: string
  fullName: string | null
  phone: string | null
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

export interface MemberProfileRoleContext {
  id: string
  role: string
  functions: string[]
  managerId: string | null
  isMaster: boolean
}

export interface MemberAccountMembershipTemplate {
  role: string
  functions: string[]
  canCreateAccountUsers: boolean
  canManageAccountTeams: boolean
  canTransferAccountLeads: boolean
}

export interface IBackofficeMemberRepository {
  findAdminEmailByProfileId(profileId: string): Promise<string | null>

  findMemberForUpdate(memberId: string): Promise<MemberForUpdateRecord | null>

  updateMemberProfile(
    memberId: string,
    data: {
      fullName?: string | null
      phone?: string | null
      email?: string
    }
  ): Promise<{ id: string } | null>

  updateTeamMemberAccess(
    profileId: string,
    teamId: string,
    data: {
      role?: string
      functions?: string[]
      canCreateAccountUsers?: boolean
      canManageAccountTeams?: boolean
      canTransferAccountLeads?: boolean
    }
  ): Promise<void>

  findMemberForDeletion(memberId: string): Promise<MemberForDeletionRecord | null>

  deleteMemberCascade(memberId: string): Promise<void>

  findTeamMembership(
    teamId: string,
    profileId: string
  ): Promise<MemberTeamMembershipRecord | null>

  deleteTeamMembership(teamId: string, profileId: string): Promise<void>

  findTeamForMaster(teamId: string, masterId: string): Promise<{ id: string; masterId: string } | null>
  findTeamById(teamId: string): Promise<{ id: string; masterId: string } | null>

  findProfileRoleContext(profileId: string): Promise<MemberProfileRoleContext | null>

  findAccountMembershipTemplate(
    profileId: string,
    masterId: string
  ): Promise<MemberAccountMembershipTemplate | null>

  createTeamMembership(input: {
    teamId: string
    profileId: string
    role: string
    functions: string[]
    canCreateAccountUsers: boolean
    canManageAccountTeams: boolean
    canTransferAccountLeads: boolean
  }): Promise<{ id: string }>

  findExternalTeamMemberships(
    profileId: string,
    excludeMasterId: string
  ): Promise<
    Array<{
      teamId: string
      teamName: string
      accountMasterId: string
      accountName: string
      role: string
    }>
  >
}
