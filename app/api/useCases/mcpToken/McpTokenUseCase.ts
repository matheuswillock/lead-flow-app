import { Output } from "@/lib/output";
import { generateMcpToken } from "@/lib/mcp-token";
import { McpTokenRepository } from "@/app/api/infra/data/repositories/mcpToken/McpTokenRepository";
import type { IMcpTokenUseCase } from "./IMcpTokenUseCase";

export class McpTokenUseCase implements IMcpTokenUseCase {
  private readonly repo = new McpTokenRepository();

  async createToken(supabaseId: string, teamId: string, label?: string): Promise<Output> {
    const access = await this.repo.resolveManagerAccess(supabaseId, teamId);
    if (!access) return new Output(false, [], ["Você não é membro deste time"], null);
    if (!access.isManager) return new Output(false, [], ["Somente managers podem gerar tokens MCP"], null);

    const { token, tokenHash, tokenPreview } = generateMcpToken();

    const created = await this.repo.create({
      teamId,
      createdBy: access.profileId,
      tokenHash,
      tokenPreview,
      label,
    });

    return new Output(true, ["Token MCP criado com sucesso"], [], {
      id: created.id,
      token,
      tokenPreview,
      label: created.label,
      createdAt: created.createdAt,
    });
  }

  async listTokens(supabaseId: string, teamId: string): Promise<Output> {
    const access = await this.repo.resolveManagerAccess(supabaseId, teamId);
    if (!access) return new Output(false, [], ["Você não é membro deste time"], null);
    if (!access.isManager) return new Output(false, [], ["Somente managers podem visualizar tokens MCP"], null);

    const tokens = await this.repo.listByTeam(teamId);
    return new Output(true, [], [], tokens.map((t) => ({
      id: t.id,
      tokenPreview: t.tokenPreview,
      label: t.label,
      isActive: t.isActive,
      lastUsedAt: t.lastUsedAt,
      expiresAt: t.expiresAt,
      revokedAt: t.revokedAt,
      createdAt: t.createdAt,
    })));
  }

  async revokeToken(supabaseId: string, teamId: string, tokenId: string): Promise<Output> {
    const access = await this.repo.resolveManagerAccess(supabaseId, teamId);
    if (!access) return new Output(false, [], ["Você não é membro deste time"], null);
    if (!access.isManager) return new Output(false, [], ["Somente managers podem revogar tokens MCP"], null);

    const revoked = await this.repo.revoke(tokenId, teamId);
    if (!revoked) return new Output(false, [], ["Token não encontrado"], null);

    return new Output(true, ["Token MCP revogado com sucesso"], [], { id: revoked.id });
  }
}
