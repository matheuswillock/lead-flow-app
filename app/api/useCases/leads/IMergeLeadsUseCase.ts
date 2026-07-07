import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";
import type { Output } from "@/lib/output";

export interface MergeLeadsInput {
  targetLeadId: string;
  sourceLeadId: string;
}

export interface MergeLeadsResult {
  targetLeadId: string;
  mergedLeadId: string;
  mergedLeadCode: string;
}

export interface IMergeLeadsUseCase {
  execute(access: TeamAccess, input: MergeLeadsInput): Promise<Output>;
}
