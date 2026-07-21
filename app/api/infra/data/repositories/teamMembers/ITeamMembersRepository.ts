import type { TeamMember, UserFunction, UserRole } from "@prisma/client";

export interface TeamMembersRequesterProfile {
  id: string;
  email: string | null;
  fullName: string | null;
  isMaster: boolean;
  managerId: string | null;
}

export interface TeamMembersTeam {
  id: string;
  masterId: string;
  name: string;
  sponsorMasterId?: string | null;
}

export interface TeamMembersListItem {
  id: string;
  profileId: string;
  role: UserRole;
  functions: UserFunction[];
  profile: {
    id: string;
    fullName: string | null;
    email: string | null;
    profileIconUrl: string | null;
    supabaseId: string | null;
    /** Derivado no repositório via filtro relacional — o refreshToken (segredo) não trafega. */
    googleCalendarConnected: boolean;
  };
}

export interface TeamMembersProfileOption {
  id: string;
  fullName: string | null;
  email: string | null;
  supabaseId: string | null;
}

export interface TeamMembersEligibleProfile extends TeamMembersProfileOption {
  role: UserRole;
  functions: UserFunction[];
}

export interface TeamMembersTransferTarget {
  teamId: string;
  teamName: string;
}

export type TeamMembersInternalTransferTarget = TeamMembersTransferTarget;

export interface TeamMembersMembershipAccess {
  id: string;
  role: UserRole;
  canManageAccountTeams: boolean;
}

export interface TeamMembersSnapshot {
  id: string;
  teamId: string;
  profileId: string;
  role: UserRole;
  functions: UserFunction[];
  createdAt: Date;
}

export interface ITeamMembersRepository {
  findRequesterProfile(supabaseId: string): Promise<TeamMembersRequesterProfile | null>;
  findTeam(teamId: string): Promise<TeamMembersTeam | null>;
  findMembership(teamId: string, profileId: string): Promise<TeamMembersMembershipAccess | null>;
  canManageTeamMembers(requesterProfileId: string, teamMasterId: string): Promise<boolean>;
  findMembers(teamId: string): Promise<TeamMembersListItem[]>;
  findMasterAccountTeamMembers(masterId: string): Promise<Array<{ profileId: string; profile: TeamMembersProfileOption }>>;
  findMasterAccountProfiles(masterId: string): Promise<TeamMembersProfileOption[]>;
  findTransferTargets(teamId: string): Promise<TeamMembersTransferTarget[]>;
  findInternalTransferTargetsWithSearch(
    sourceTeamId: string,
    query?: string
  ): Promise<TeamMembersInternalTransferTarget[]>;
  hasTransferRoute(sourceTeamId: string, targetTeamId: string): Promise<boolean>;
  findExistingMember(teamId: string, profileId: string): Promise<{ id: string } | null>;
  findMemberSnapshot(teamId: string, profileId: string): Promise<TeamMembersSnapshot | null>;
  findEligibleProfile(profileId: string, masterId: string): Promise<TeamMembersEligibleProfile | null>;
  createMember(input: {
    teamId: string;
    profileId: string;
    role: UserRole;
    functions: UserFunction[];
  }): Promise<TeamMember>;
  deleteMember(teamId: string, profileId: string): Promise<void>;
}
