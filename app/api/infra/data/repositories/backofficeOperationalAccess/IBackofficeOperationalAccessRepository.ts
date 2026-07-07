import type { BackofficeOperationalCapability } from "@prisma/client";

export interface OperationalAccessProfileRow {
  id: string;
  fullName: string | null;
  email: string;
  isMaster: boolean;
}

export interface OperationalAccessTeamRow {
  id: string;
  name: string;
  masterId: string;
  master: OperationalAccessProfileRow;
}

export interface OperationalAccessActorRow {
  id: string;
  fullName: string | null;
  email: string;
}

export interface OperationalAccessGrantRow {
  id: string;
  capability: BackofficeOperationalCapability;
  profileId: string | null;
  teamId: string | null;
  isActive: boolean;
  notes: string | null;
  grantedByProfileId: string | null;
  grantedAt: Date;
  revokedByProfileId: string | null;
  revokedAt: Date | null;
  profile: OperationalAccessProfileRow | null;
  team: OperationalAccessTeamRow | null;
  grantedBy: OperationalAccessActorRow | null;
  revokedBy: OperationalAccessActorRow | null;
}

export interface IBackofficeOperationalAccessRepository {
  findProfileById(profileId: string): Promise<OperationalAccessProfileRow | null>;
  findTeamById(teamId: string): Promise<{ id: string; masterId: string; name: string } | null>;
  findMultiskillTeamByMasterId(masterId: string, teamName: string): Promise<{ id: string } | null>;
  createMultiskillTeam(masterId: string, teamName: string): Promise<{ id: string }>;
  hasActiveGrant(input: {
    capability: BackofficeOperationalCapability;
    profileId?: string;
    teamId?: string;
  }): Promise<boolean>;
  listByCapability(capability: BackofficeOperationalCapability): Promise<OperationalAccessGrantRow[]>;
  listEligibleMasters(excludeProfileIds: string[]): Promise<OperationalAccessProfileRow[]>;
  listEligibleMastersForMultiskill(excludeMasterIds: string[]): Promise<OperationalAccessProfileRow[]>;
  grantAssociadosQueue(input: {
    profileId: string;
    grantedByProfileId: string;
    notes?: string | null;
  }): Promise<OperationalAccessGrantRow>;
  grantMultiskillOrigin(input: {
    teamId: string;
    grantedByProfileId: string;
    notes?: string | null;
  }): Promise<OperationalAccessGrantRow>;
  revoke(grantId: string, revokedByProfileId: string): Promise<OperationalAccessGrantRow | null>;
  findActiveMultiskillGrantByTeamId(teamId: string): Promise<{ id: string } | null>;
  provisionMultiskillOriginGrant(input: {
    masterId: string;
    teamName: string;
    grantedByProfileId: string;
    notes?: string | null;
  }): Promise<OperationalAccessGrantRow>;
}
