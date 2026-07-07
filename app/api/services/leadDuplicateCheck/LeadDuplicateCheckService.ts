import { normalizeCdpEmail, normalizeCdpPhone } from "@/lib/cdp/normalization";
import { leadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository";
import type { ILeadRepository } from "@/app/api/infra/data/repositories/lead/ILeadRepository";
import type {
  FindDuplicateCandidatesInput,
  ILeadDuplicateCheckService,
  LeadDuplicateCandidate,
} from "./ILeadDuplicateCheckService";
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository";

const CANDIDATE_SCAN_LIMIT = 200;
const RESULT_LIMIT = 5;

function matchesNormalizedIdentity(
  lead: { phone: string | null; email: string | null },
  normalizedPhone: string,
  normalizedEmail: string
): boolean {
  if (normalizedPhone) {
    const leadPhone = normalizeCdpPhone(lead.phone);
    if (leadPhone && leadPhone === normalizedPhone) {
      return true;
    }
  }

  if (normalizedEmail) {
    const leadEmail = normalizeCdpEmail(lead.email);
    if (leadEmail && leadEmail === normalizedEmail) {
      return true;
    }
  }

  return false;
}

export class LeadDuplicateCheckService implements ILeadDuplicateCheckService {
  constructor(private readonly repository: ILeadRepository = leadRepository) {}

  async findCandidates(
    _ctx: TeamContext,
    input: FindDuplicateCandidatesInput
  ): Promise<LeadDuplicateCandidate[]> {
    const normalizedPhone = normalizeCdpPhone(input.phone);
    const normalizedEmail = normalizeCdpEmail(input.email);

    if (!normalizedPhone && !normalizedEmail) {
      return [];
    }

    const [directMatches, teamCandidates] = await Promise.all([
      this.repository.findDuplicateDirectMatches(input.teamId, {
        phone: normalizedPhone || undefined,
        email: normalizedEmail || undefined,
        excludeLeadId: input.excludeLeadId,
        limit: RESULT_LIMIT,
      }),
      this.repository.findDuplicateScanCandidates(input.teamId, {
        hasPhone: Boolean(normalizedPhone),
        hasEmail: Boolean(normalizedEmail),
        excludeLeadId: input.excludeLeadId,
        limit: CANDIDATE_SCAN_LIMIT,
      }),
    ]);

    const seen = new Set<string>();
    const merged: LeadDuplicateCandidate[] = [];

    for (const lead of [...directMatches, ...teamCandidates]) {
      if (seen.has(lead.id)) continue;
      if (!matchesNormalizedIdentity(lead, normalizedPhone, normalizedEmail)) continue;
      seen.add(lead.id);
      merged.push(lead);
      if (merged.length >= RESULT_LIMIT) break;
    }

    return merged;
  }
}

export const leadDuplicateCheckService = new LeadDuplicateCheckService();
