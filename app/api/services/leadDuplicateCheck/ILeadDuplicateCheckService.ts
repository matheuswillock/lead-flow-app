import type { LeadStatus } from "@prisma/client";
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository";

export interface LeadDuplicateCandidate {
  id: string;
  leadCode: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: LeadStatus | null;
  createdAt: Date;
}

export interface FindDuplicateCandidatesInput {
  teamId: string;
  phone?: string | null;
  email?: string | null;
  excludeLeadId?: string;
}

export interface ILeadDuplicateCheckService {
  findCandidates(
    ctx: TeamContext,
    input: FindDuplicateCandidatesInput
  ): Promise<LeadDuplicateCandidate[]>;
}
