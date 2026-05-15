import type { Output } from "@/lib/output";

export interface IMcpTokenUseCase {
  createToken(supabaseId: string, teamId: string, label?: string): Promise<Output>;
  listTokens(supabaseId: string, teamId: string): Promise<Output>;
  revokeToken(supabaseId: string, teamId: string, tokenId: string): Promise<Output>;
}
