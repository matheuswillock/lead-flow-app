import type { TeamMcpToken } from "@prisma/client";

export type CreateMcpTokenData = {
  teamId: string;
  createdBy: string;
  tokenHash: string;
  tokenPreview: string;
  label?: string;
  expiresAt?: Date;
};

export type ManagerAccessResult = {
  profileId: string;
  isManager: boolean;
};

export interface IMcpTokenRepository {
  create(data: CreateMcpTokenData): Promise<TeamMcpToken>;
  findActiveByHash(tokenHash: string): Promise<TeamMcpToken | null>;
  listByTeam(teamId: string): Promise<TeamMcpToken[]>;
  revoke(id: string, teamId: string): Promise<TeamMcpToken | null>;
  touchLastUsed(id: string): Promise<void>;
  resolveManagerAccess(supabaseId: string, teamId: string): Promise<ManagerAccessResult | null>;
}
