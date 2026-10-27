import { prisma } from "@/app/api/infra/data/prisma";
import type {
  ITeamApiResourceActivationRepository,
  TeamApiResourceActivationRow,
} from "./ITeamApiResourceActivationRepository";

/** Nunca selecionar `tokenHash` em respostas: ele só entra na busca por token. */
const SAFE_SELECT = {
  id: true,
  teamId: true,
  resourceSlug: true,
  status: true,
  tokenPreview: true,
  expiresAt: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class TeamApiResourceActivationRepository implements ITeamApiResourceActivationRepository {
  async findByTokenHash(tokenHash: string): Promise<TeamApiResourceActivationRow | null> {
    return prisma.teamApiResourceActivation.findUnique({ where: { tokenHash }, select: SAFE_SELECT });
  }

  async findByTeamAndSlug(teamId: string, resourceSlug: string): Promise<TeamApiResourceActivationRow | null> {
    return prisma.teamApiResourceActivation.findUnique({
      where: { teamId_resourceSlug: { teamId, resourceSlug } },
      select: SAFE_SELECT,
    });
  }

  async upsertActivation(input: {
    teamId: string;
    resourceSlug: string;
    tokenHash: string;
    tokenPreview: string;
    profileId: string;
  }): Promise<TeamApiResourceActivationRow> {
    return prisma.teamApiResourceActivation.upsert({
      where: { teamId_resourceSlug: { teamId: input.teamId, resourceSlug: input.resourceSlug } },
      create: {
        teamId: input.teamId,
        resourceSlug: input.resourceSlug,
        status: "active",
        tokenHash: input.tokenHash,
        tokenPreview: input.tokenPreview,
        activatedByProfileId: input.profileId,
        updatedByProfileId: input.profileId,
      },
      // Gerar de novo troca o token (o anterior deixa de valer) e reativa o recurso.
      update: {
        status: "active",
        tokenHash: input.tokenHash,
        tokenPreview: input.tokenPreview,
        updatedByProfileId: input.profileId,
        lastUsedAt: null,
      },
      select: SAFE_SELECT,
    });
  }

  async setStatus(input: {
    teamId: string;
    resourceSlug: string;
    status: "active" | "inactive";
    profileId: string;
  }): Promise<TeamApiResourceActivationRow | null> {
    const updated = await prisma.teamApiResourceActivation.updateMany({
      where: { teamId: input.teamId, resourceSlug: input.resourceSlug },
      data: { status: input.status, updatedByProfileId: input.profileId },
    });
    if (updated.count === 0) return null;
    return this.findByTeamAndSlug(input.teamId, input.resourceSlug);
  }

  async touchLastUsed(activationId: string, now: Date): Promise<void> {
    await prisma.teamApiResourceActivation.update({ where: { id: activationId }, data: { lastUsedAt: now } });
  }
}

export const teamApiResourceActivationRepository = new TeamApiResourceActivationRepository();
