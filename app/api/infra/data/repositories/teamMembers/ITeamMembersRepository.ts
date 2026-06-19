import type { TeamMember, UserFunction, UserRole } from "@prisma/client";

export interface TeamMembersRequesterProfile {
  id: string;
  email: string | null;
  fullName: string | null;
  isMaster: boolean;
}

export interface TeamMembersTeam {
  id: string;
  masterId: string;
  name: string;
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
    googleConnection: {
      refreshToken: string | null;
      revokedAt: Date | null;
    } | null;
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

export interface TeamMembersMembershipAccess {
  id: string;
  role: UserRole;
  canManageAccountTeams: boolean;
}

export interface ITeamMembersRepository {
  findRequesterProfile(supabaseId: string): Promise<TeamMembersRequesterProfile | null>;
  findTeam(teamId: string): Promise<TeamMembersTeam | null>;
  findMembership(teamId: string, profileId: string): Promise<TeamMembersMembershipAccess | null>;
  findMembers(teamId: string): Promise<TeamMembersListItem[]>;
  findMasterAccountTeamMembers(masterId: string): Promise<Array<{ profileId: string; profile: TeamMembersProfileOption }>>;
  findMasterAccountProfiles(masterId: string): Promise<TeamMembersProfileOption[]>;
  findTransferTargets(teamId: string): Promise<TeamMembersTransferTarget[]>;
  findExistingMember(teamId: string, profileId: string): Promise<{ id: string } | null>;
  findEligibleProfile(profileId: string, masterId: string): Promise<TeamMembersEligibleProfile | null>;
  createMember(input: {
    teamId: string;
    profileId: string;
    role: UserRole;
    functions: UserFunction[];
  }): Promise<TeamMember>;
  deleteMember(teamId: string, profileId: string): Promise<void>;
}
