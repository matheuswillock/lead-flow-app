import type { Output } from "@/lib/output";
import type { HostAgentService } from "@/lib/studio-bot/host-services";

export interface IBackofficeBotHostUseCase {
  getSettings(): Promise<Output>;
  updateSettings(
    input: {
      agentBaseUrl?: string | null;
      desiredHostVersion?: string | null;
      n8nEnv?: Record<string, string>;
      evolutionEnv?: Record<string, string>;
    },
    access: { profileId: string; fullAccess: boolean }
  ): Promise<Output>;
  exportEnvFile(access: { profileId: string; fullAccess: boolean }): Promise<Output>;
  rotateAgentToken(access: { profileId: string; fullAccess: boolean }): Promise<Output>;
  listJobs(): Promise<Output>;
  health(access: { profileId: string; fullAccess: boolean }): Promise<Output>;
  fetchLogs(
    input: { service: HostAgentService; tail?: number },
    access: { profileId: string; fullAccess: boolean }
  ): Promise<Output>;
  applyEnv(access: { profileId: string; fullAccess: boolean }): Promise<Output>;
  restart(
    service: HostAgentService | "all",
    access: { profileId: string; fullAccess: boolean }
  ): Promise<Output>;
  resyncBethaniaWebhook(
    input: { confirm: boolean },
    access: { profileId: string; fullAccess: boolean }
  ): Promise<Output>;
  syncHost(
    input: { version: string; packBase64: string; packSha256: string },
    access: { profileId: string; fullAccess: boolean }
  ): Promise<Output>;
}
