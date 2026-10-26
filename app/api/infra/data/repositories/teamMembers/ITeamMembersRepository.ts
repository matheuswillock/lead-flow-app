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

/** Estado do time vinculado a uma membership, para autorizar troca de time ativo. */
export interface TeamMembersMembershipTeamState {
  deletedAt: Date | null;
}

/** Time patrocinado visível ao sponsor, para autorizar troca de time ativo. */
export interface TeamMembersSponsoredTeamAccess {
  sponsorMasterId: string | null;
}

export interface TeamMembersSnapshot {
  id: string;
  teamId: string;
  profileId: string;
  role: UserRole;
  functions: UserFunction[];
  createdAt: Date;
}


export interface TeamMemberRoleAndFunctions {
  role: UserRole;
  functions: UserFunction[];
}

/**
 * Membership do perfil num time, com o papel e as funcoes que ele exerce ALI.
 *
 * Base do escopo "member-all" das agendas (Calendario e widget do Dashboard):
 * os times saem das proprias memberships do perfil, inclusive de masters
 * diferentes, e o papel e avaliado time a time.
 */
export interface ProfileTeamMembership extends TeamMemberRoleAndFunctions {
  teamId: string;
  /** Master dono do time — o escopo precisa checar o acesso da conta time a time. */
  accountMasterId: string;
}

export interface TeamMemberTransferAuthorization {
  role: UserRole;
  canTransferAccountLeads: boolean;
}

export interface TeamMemberNotificationRecipient {
  profileId: string;
  profile: { email: string; fullName: string | null; supabaseId: string | null } | null;
}

/**
 * SPEC 13 (Agenda na Criação de Lead), A-E3 — status de conexão Google por
 * e-mail, para `participantDispatch.ts` classificar quem recebe convite via
 * Google Calendar e quem recebe por e-mail (Resend). Não trafega o
 * `refreshToken` de verdade fora do repositório — só o booleano derivado.
 */
export interface TeamMemberGoogleConnectionStatus {
  email: string;
  googleCalendarConnected: boolean;
}

export interface ITeamMembersRepository {
  findRequesterProfile(supabaseId: string): Promise<TeamMembersRequesterProfile | null>;
  findTeam(teamId: string): Promise<TeamMembersTeam | null>;
  findMembership(teamId: string, profileId: string): Promise<TeamMembersMembershipAccess | null>;
  /** Estado do time de uma membership (existência + soft-delete), para troca de time ativo. */
  findMembershipTeamState(
    teamId: string,
    profileId: string
  ): Promise<TeamMembersMembershipTeamState | null>;
  /** Patrocínio do time (não deletado), para troca de time ativo por sponsor. */
  findSponsoredTeamAccess(teamId: string): Promise<TeamMembersSponsoredTeamAccess | null>;
  /** Papel e funcoes do membro, para decisoes de permissao no dominio de leads. */
  findRoleAndFunctions(teamId: string, profileId: string): Promise<TeamMemberRoleAndFunctions | null>;
  /** Memberships ativas do perfil (todos os times, de qualquer master), para o escopo "member-all". */
  findMembershipsByProfile(profileId: string): Promise<ProfileTeamMembership[]>;
  /** Papel e permissao de transferencia, para autorizar transferencia de lead. */
  findTransferAuthorization(teamId: string, profileId: string): Promise<TeamMemberTransferAuthorization | null>;
  /** Membros do time nos papeis informados, para destinatarios de notificacao. */
  findNotificationRecipients(input: {
    teamId: string;
    roles: UserRole[];
    onlyTransferAuthorized?: boolean;
    onlyActive?: boolean;
  }): Promise<TeamMemberNotificationRecipient[]>;
  findNotificationRecipientsByProfileIds(input: {
    teamId: string;
    profileIds: string[];
  }): Promise<Array<{ profileId: string }>>;
  /** Status de conexão Google dos membros do time cujo e-mail está em `emails` (case-insensitive). */
  findGoogleConnectionStatusByEmails(
    teamId: string,
    emails: string[]
  ): Promise<TeamMemberGoogleConnectionStatus[]>;
  /** Membro do time com a função SDR e perfil não deletado (valida `assigned_to` do webhook v2). */
  isActiveSdr(teamId: string, profileId: string): Promise<boolean>;
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
