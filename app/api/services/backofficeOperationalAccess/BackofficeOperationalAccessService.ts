import { BackofficeOperationalCapability } from "@prisma/client";
import {
  backofficeOperationalAccessRepository,
  type BackofficeOperationalAccessRepository,
} from "@/app/api/infra/data/repositories/backofficeOperationalAccess/BackofficeOperationalAccessRepository";
import { MULTISKILL_TEAM_NAME } from "@/lib/multiskill/constants";
import {
  isMultiskillOriginAccountMasterId,
  resolveMultiskillOriginMasterId,
} from "@/lib/multiskill/is-multiskill-origin-master";
import type {
  IBackofficeOperationalAccessService,
  OperationalAccessListResult,
} from "./IBackofficeOperationalAccessService";
import type { OperationalAccessGrantRow } from "./IBackofficeOperationalAccessService";

const ASSOCIADOS_DENIED = "Acesso restrito à fila Associados";
const MULTISKILL_DENIED = "Acesso negado: time não autorizado para transferência MultiSkill";

export class BackofficeOperationalAccessService implements IBackofficeOperationalAccessService {
  constructor(
    private readonly repository: BackofficeOperationalAccessRepository = backofficeOperationalAccessRepository
  ) {}

  async resolveOperationalAccess(profileId: string, teamId: string | null) {
    const [associadosQueue, multiskillTransferOrigin, originMasterId, team] =
      await Promise.all([
        this.hasAssociadosQueueAccess(profileId),
        teamId ? this.hasMultiskillOriginTeam(teamId) : Promise.resolve(false),
        resolveMultiskillOriginMasterId(),
        teamId ? this.repository.findTeamById(teamId) : Promise.resolve(null),
      ]);

    const multiskillExternalTransfer =
      multiskillTransferOrigin &&
      isMultiskillOriginAccountMasterId(team?.masterId ?? "", originMasterId);

    return { associadosQueue, multiskillTransferOrigin, multiskillExternalTransfer };
  }

  async assertAssociadosQueueAccess(profileId: string): Promise<void> {
    const allowed = await this.hasAssociadosQueueAccess(profileId);
    if (!allowed) {
      throw new Error(ASSOCIADOS_DENIED);
    }
  }

  async assertMultiskillOriginTeam(teamId: string): Promise<void> {
    const allowed = await this.hasMultiskillOriginTeam(teamId);
    if (!allowed) {
      throw new Error(MULTISKILL_DENIED);
    }
  }

  async hasAssociadosQueueAccess(profileId: string): Promise<boolean> {
    return this.repository.hasActiveGrant({
      capability: BackofficeOperationalCapability.ASSOCIADOS_QUEUE,
      profileId,
    });
  }

  async hasMultiskillOriginTeam(teamId: string): Promise<boolean> {
    return this.repository.hasActiveGrant({
      capability: BackofficeOperationalCapability.MULTISKILL_TRANSFER_ORIGIN,
      teamId,
    });
  }

  async listForBackoffice(): Promise<OperationalAccessListResult> {
    const [associadosQueue, multiskillOrigins] = await Promise.all([
      this.repository.listByCapability(BackofficeOperationalCapability.ASSOCIADOS_QUEUE),
      this.repository.listByCapability(BackofficeOperationalCapability.MULTISKILL_TRANSFER_ORIGIN),
    ]);

    const activeAssociadosProfileIds = associadosQueue
      .filter((row) => row.isActive && row.profileId)
      .map((row) => row.profileId as string);

    const activeMultiskillMasterIds = multiskillOrigins
      .filter((row) => row.isActive && row.team?.masterId)
      .map((row) => row.team!.masterId);

    const [eligibleAssociadosProfiles, eligibleMultiskillMasters] = await Promise.all([
      this.repository.listEligibleMasters(activeAssociadosProfileIds),
      this.repository.listEligibleMastersForMultiskill(activeMultiskillMasterIds),
    ]);

    return {
      associadosQueue,
      multiskillOrigins,
      eligibleAssociadosProfiles,
      eligibleMultiskillMasters,
    };
  }

  async grantAssociadosQueue(input: {
    profileId: string;
    grantedByProfileId: string;
    notes?: string | null;
  }): Promise<OperationalAccessGrantRow | { error: string }> {
    const profile = await this.repository.findProfileById(input.profileId);
    if (!profile?.isMaster) {
      return { error: "Selecione um master válido" };
    }

    const record = await this.repository.grantAssociadosQueue(input);
    return record;
  }

  async ensureMultiskillOriginTeam(masterId: string) {
    const existing = await this.repository.findMultiskillTeamByMasterId(
      masterId,
      MULTISKILL_TEAM_NAME
    );
    if (existing) {
      return { teamId: existing.id, created: false };
    }

    const created = await this.repository.createMultiskillTeam(masterId, MULTISKILL_TEAM_NAME);
    return { teamId: created.id, created: true };
  }

  async grantMultiskillOriginByMaster(input: {
    masterId: string;
    grantedByProfileId: string;
    notes?: string | null;
  }): Promise<OperationalAccessGrantRow | { error: string }> {
    const profile = await this.repository.findProfileById(input.masterId);
    if (!profile?.isMaster) {
      return { error: "Selecione um master válido" };
    }

    const result = await this.repository.provisionMultiskillOriginGrant({
      masterId: input.masterId,
      teamName: MULTISKILL_TEAM_NAME,
      grantedByProfileId: input.grantedByProfileId,
      notes: input.notes,
    });

    return result;
  }

  async revoke(
    grantId: string,
    revokedByProfileId: string
  ): Promise<OperationalAccessGrantRow | { error: string }> {
    const record = await this.repository.revoke(grantId, revokedByProfileId);
    if (!record) {
      return { error: "Autorização não encontrada ou já revogada" };
    }
    return record;
  }
}

export const backofficeOperationalAccessService = new BackofficeOperationalAccessService();
