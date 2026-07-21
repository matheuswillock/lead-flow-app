import type { BackofficeBotChannelStatus } from "@prisma/client";
import type { Output } from "@/lib/output";

export interface IBackofficeBotChannelUseCase {
  getChannel(): Promise<Output>;
  upsertChannel(data: {
    displayName?: string;
    aboutText?: string | null;
    n8nInboundUrl?: string | null;
    status?: BackofficeBotChannelStatus;
  }): Promise<Output>;
  updateChannelProfile(data: {
    displayName?: string;
    aboutText?: string | null;
  }): Promise<Output>;
  listConversations(
    filters: { search?: string; dateFrom?: string; dateTo?: string },
    pagination: { page: number; pageSize: number }
  ): Promise<Output>;
  listMessages(
    userLinkId: string,
    pagination: { before?: string; limit: number }
  ): Promise<Output>;
  listUserLinks(pagination: { page: number; pageSize: number }): Promise<Output>;
  revokeUserLink(userLinkId: string): Promise<Output>;
  listAuthChallenges(
    filters: { source?: string; status?: string },
    pagination: { page: number; pageSize: number }
  ): Promise<Output>;
  testPing(): Promise<Output>;
  uploadChannelAvatar(file: File): Promise<Output>;
  reconnectChannel(): Promise<Output>;
  refreshChannelConnection(): Promise<Output>;
  disconnectChannel(): Promise<Output>;
  syncChannelProfile(): Promise<Output>;
}
