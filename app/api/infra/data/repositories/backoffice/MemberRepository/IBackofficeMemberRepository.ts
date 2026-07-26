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
  canViewAllTeams: boolean
}

export interface MemberAccountTeamMembershipItem {
  teamId: string
  teamName: string
  membersCount: number
  isMember: boolean
  role?: string
  functions?: string[]
  canCreateAccountUsers?: boolean
  canManageAccountTeams?: boolean
  canTransferAccountLeads?: boolean
  canViewAllTeams?: boolean
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
      canViewAllTeams?: boolean
    }
  ): Promise<void>

  updateAccountMemberAccess(
    profileId: string,
    masterId: string,
    data: {
      role?: string
      functions?: string[]
      canCreateAccountUsers?: boolean
      canManageAccountTeams?: boolean
      canTransferAccountLeads?: boolean
      canViewAllTeams?: boolean
    }
  ): Promise<void>

  findMemberForDeletion(memberId: string): Promise<MemberForDeletionRecord | null>

  deleteMemberCascade(memberId: string): Promise<void>

  softDeleteMemberCascade(
    memberId: string,
    actorProfileId: string,
    requestId?: string | null
  ): Promise<void>

  softDeleteTeamCascade(
    teamId: string,
    actorProfileId: string,
    requestId?: string | null
  ): Promise<void>

  findTeamMembership(
    teamId: string,
    profileId: string
  ): Promise<MemberTeamMembershipRecord | null>

  deleteTeamMembership(teamId: string, profileId: string): Promise<void>

  deleteTeamMembershipWithAudit(input: {
    teamId: string
    profileId: string
    actorProfileId: string
  }): Promise<void>

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
    canViewAllTeams?: boolean
  }): Promise<{ id: string }>

  findAccountTeamMemberships(
    profileId: string,
    masterId: string
  ): Promise<MemberAccountTeamMembershipItem[]>

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
