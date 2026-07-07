import type { OperationalAccessGrantRow, OperationalAccessProfileRow } from "@/app/api/infra/data/repositories/backofficeOperationalAccess/IBackofficeOperationalAccessRepository";

export interface OperationalAccessListResult {
  associadosQueue: OperationalAccessGrantRow[];
  multiskillOrigins: OperationalAccessGrantRow[];
  eligibleAssociadosProfiles: OperationalAccessProfileRow[];
  eligibleMultiskillMasters: OperationalAccessProfileRow[];
}

export interface EnsureMultiskillOriginTeamResult {
  teamId: string;
  created: boolean;
}

export interface IBackofficeOperationalAccessService {
  resolveOperationalAccess(profileId: string, teamId: string | null): Promise<{
    associadosQueue: boolean;
    multiskillTransferOrigin: boolean;
  }>;
  assertAssociadosQueueAccess(profileId: string): Promise<void>;
  assertMultiskillOriginTeam(teamId: string): Promise<void>;
  hasAssociadosQueueAccess(profileId: string): Promise<boolean>;
  hasMultiskillOriginTeam(teamId: string): Promise<boolean>;
  listForBackoffice(): Promise<OperationalAccessListResult>;
  grantAssociadosQueue(input: {
    profileId: string;
    grantedByProfileId: string;
    notes?: string | null;
  }): Promise<OperationalAccessGrantRow | { error: string }>;
  grantMultiskillOriginByMaster(input: {
    masterId: string;
    grantedByProfileId: string;
    notes?: string | null;
  }): Promise<OperationalAccessGrantRow | { error: string }>;
  revoke(grantId: string, revokedByProfileId: string): Promise<OperationalAccessGrantRow | { error: string }>;
  ensureMultiskillOriginTeam(masterId: string): Promise<EnsureMultiskillOriginTeamResult>;
}

export type { OperationalAccessGrantRow };
