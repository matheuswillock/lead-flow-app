import { prisma } from "@/app/api/infra/data/prisma";
import type {
  ITeamApiRequestLogRepository,
  TeamApiRequestLogInput,
  TeamApiRequestLogRow,
} from "./ITeamApiRequestLogRepository";

const MAX_REQUESTED_DATE_LENGTH = 32;

export class TeamApiRequestLogRepository implements ITeamApiRequestLogRepository {
  async record(input: TeamApiRequestLogInput): Promise<void> {
    await prisma.teamApiRequestLog.create({
      data: {
        teamId: input.teamId,
        resourceSlug: input.resourceSlug,
        activationId: input.activationId,
        statusCode: input.statusCode,
        errorCode: input.errorCode,
        requestedDate: input.requestedDate ? input.requestedDate.slice(0, MAX_REQUESTED_DATE_LENGTH) : null,
        durationMs: Math.max(0, Math.round(input.durationMs)),
      },
    });
  }

  async listRecent(teamId: string, resourceSlug: string, limit: number): Promise<TeamApiRequestLogRow[]> {
    return prisma.teamApiRequestLog.findMany({
      where: { teamId, resourceSlug },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, statusCode: true, errorCode: true, requestedDate: true, durationMs: true, createdAt: true },
    });
  }

  async purgeOlderThan(cutoff: Date): Promise<number> {
    const result = await prisma.teamApiRequestLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return result.count;
  }
}

export const teamApiRequestLogRepository = new TeamApiRequestLogRepository();
