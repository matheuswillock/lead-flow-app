import { prisma } from "../../prisma";
import type {
  ITeamRepository,
  TeamMasterRef,
  TeamMasterWithSponsor,
} from "./ITeamRepository";

export class TeamRepository implements ITeamRepository {
  async findMasterRef(teamId: string): Promise<TeamMasterRef | null> {
    return await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, masterId: true },
    });
  }

  async findMasterWithSponsor(teamId: string): Promise<TeamMasterWithSponsor | null> {
    return await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        masterId: true,
        master: { select: { sponsorMasterId: true } },
      },
    });
  }

  async hasTransferRoute(sourceTeamId: string, targetTeamId: string): Promise<boolean> {
    const route = await prisma.teamTransferRoute.findUnique({
      where: { sourceTeamId_targetTeamId: { sourceTeamId, targetTeamId } },
      select: { id: true },
    });
    return route !== null;
  }

  async findDefaultTeamIdByMaster(masterId: string): Promise<string | null> {
    const team = await prisma.team.findFirst({
      where: { masterId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    return team?.id ?? null;
  }
}

export const teamRepository = new TeamRepository();
