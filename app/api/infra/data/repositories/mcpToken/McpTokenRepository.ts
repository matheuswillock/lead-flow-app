import type { TeamMcpToken } from "@prisma/client";
import { prisma } from "../../prisma";
import type {
  CreateMcpTokenData,
  IMcpTokenRepository,
  ManagerAccessResult,
} from "./IMcpTokenRepository";

export class McpTokenRepository implements IMcpTokenRepository {
  async create(data: CreateMcpTokenData): Promise<TeamMcpToken> {
    return prisma.teamMcpToken.create({ data });
  }

  async findActiveByHash(tokenHash: string): Promise<TeamMcpToken | null> {
    return prisma.teamMcpToken.findFirst({
      where: {
        tokenHash,
        isActive: true,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
  }

  async listByTeam(teamId: string): Promise<TeamMcpToken[]> {
    return prisma.teamMcpToken.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
    });
  }

  async revoke(id: string, teamId: string): Promise<TeamMcpToken | null> {
    const token = await prisma.teamMcpToken.findFirst({ where: { id, teamId } });
    if (!token) return null;
    return prisma.teamMcpToken.update({
      where: { id },
      data: { isActive: false, revokedAt: new Date() },
    });
  }

  async touchLastUsed(id: string): Promise<void> {
    await prisma.teamMcpToken.update({ where: { id }, data: { lastUsedAt: new Date() } });
  }

  async resolveManagerAccess(
    supabaseId: string,
    teamId: string
  ): Promise<ManagerAccessResult | null> {
    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { id: true },
    });
    if (!profile) return null;

    const membership = await prisma.teamMember.findUnique({
      where: { teamId_profileId: { teamId, profileId: profile.id } },
      select: { role: true },
    });
    if (!membership) return null;

    return { profileId: profile.id, isManager: membership.role === "manager" };
  }
}
