import { prisma } from "../../prisma";
import { TeamUpdateError } from "./ITeamRepository";
import type {
  ITeamRepository,
  TeamAuditSnapshot,
  TeamMasterRef,
  TeamMasterWithSponsor,
  TeamUpdateResult,
  UpdateTeamWithTransferRoutesInput,
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

  async findTeamIdsByMaster(masterId: string): Promise<string[]> {
    const teams = await prisma.team.findMany({
      where: { masterId, deletedAt: null },
      select: { id: true },
    });
    return teams.map((team) => team.id);
  }

  async updateTeamWithTransferRoutes(
    input: UpdateTeamWithTransferRoutesInput
  ): Promise<TeamUpdateResult> {
    const { teamId, masterId, actorProfileId } = input;

    return await prisma.$transaction(async (tx) => {
      const existingTeam = await tx.team.findFirst({
        where: { id: teamId, masterId },
        select: { id: true, name: true, isDefault: true },
      });

      if (!existingTeam) {
        throw new TeamUpdateError("TEAM_NOT_FOUND");
      }

      if (input.isDefault === false) {
        const otherDefaultTeam = await tx.team.findFirst({
          where: { masterId, isDefault: true, NOT: { id: teamId } },
          select: { id: true },
        });

        if (!otherDefaultTeam) {
          throw new TeamUpdateError("CANNOT_UNSET_ONLY_DEFAULT");
        }
      }

      const teamUpdateData: { name?: string; isDefault?: boolean } = {};
      if (input.name !== undefined) {
        teamUpdateData.name = input.name.trim();
      }

      if (input.isDefault === true) {
        await tx.team.updateMany({ where: { masterId }, data: { isDefault: false } });
        teamUpdateData.isDefault = true;
      } else if (input.isDefault === false) {
        teamUpdateData.isDefault = false;
      }

      const team = await tx.team.update({
        where: { id: teamId },
        data: teamUpdateData,
        select: { id: true, name: true, isDefault: true },
      });

      if (input.transferTargetTeamIds) {
        const validTargets = await tx.team.findMany({
          where: {
            id: { in: input.transferTargetTeamIds },
            masterId,
            NOT: { id: teamId },
          },
          select: { id: true },
        });

        await tx.teamTransferRoute.deleteMany({ where: { sourceTeamId: teamId } });

        if (validTargets.length > 0) {
          await tx.teamTransferRoute.createMany({
            data: validTargets.map((target) => ({
              sourceTeamId: teamId,
              targetTeamId: target.id,
              createdBy: actorProfileId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return { before: existingTeam, after: team };
    });
  }

  async findAuditSnapshot(teamId: string): Promise<TeamAuditSnapshot | null> {
    return await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, masterId: true, isDefault: true },
    });
  }

  async deleteTeam(teamId: string): Promise<void> {
    await prisma.team.delete({ where: { id: teamId } });
  }
}

export const teamRepository = new TeamRepository();
