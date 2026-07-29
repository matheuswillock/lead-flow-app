import { Output } from "@/lib/output";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";
import type {
  CreateInboundWebhookInput,
  CreateOutboundWebhookInput,
  TeamWebhookStatusAction,
  UpdateTeamWebhookInput,
} from "@/app/api/services/teamWebhook/ITeamWebhookService";
import type { TeamWebhookDirection, TeamWebhookStatus } from "@prisma/client";

export interface ITeamWebhookUseCase {
  list(
    access: TeamAccess,
    params: {
      direction: TeamWebhookDirection;
      status?: TeamWebhookStatus;
      search?: string;
      page: number;
      pageSize: number;
    },
    appUrl: string
  ): Promise<Output>;
  getById(access: TeamAccess, id: string, appUrl: string): Promise<Output>;
  create(
    access: TeamAccess,
    input: CreateInboundWebhookInput | CreateOutboundWebhookInput,
    appUrl: string
  ): Promise<Output>;
  update(
    access: TeamAccess,
    id: string,
    input: UpdateTeamWebhookInput,
    appUrl: string
  ): Promise<Output>;
  changeStatus(
    access: TeamAccess,
    id: string,
    action: TeamWebhookStatusAction,
    appUrl: string
  ): Promise<Output>;
  listLogs(
    access: TeamAccess,
    id: string,
    params: { page: number; pageSize: number; result?: "success" | "failure" | "rejected" }
  ): Promise<Output>;
  testDelivery(access: TeamAccess, id: string): Promise<Output>;
}
