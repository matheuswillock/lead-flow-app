import { Output } from "@/lib/output";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";
import {
  teamWebhookService,
} from "@/app/api/services/teamWebhook/TeamWebhookService";
import type {
  CreateInboundWebhookInput,
  CreateOutboundWebhookInput,
  TeamWebhookStatusAction,
  UpdateTeamWebhookInput,
} from "@/app/api/services/teamWebhook/ITeamWebhookService";
import type { TeamWebhookDirection, TeamWebhookStatus } from "@prisma/client";
import type { ITeamWebhookUseCase } from "./ITeamWebhookUseCase";

export class TeamWebhookUseCase implements ITeamWebhookUseCase {
  async list(
    access: TeamAccess,
    params: {
      direction: TeamWebhookDirection;
      status?: TeamWebhookStatus;
      search?: string;
      page: number;
      pageSize: number;
    },
    appUrl: string
  ): Promise<Output> {
    try {
      const result = await teamWebhookService.list(access, params, appUrl);
      return new Output(true, ["Webhooks listados com sucesso"], [], result);
    } catch (error) {
      console.error("[TeamWebhookUseCase][list] Erro:", error);
      return new Output(false, [], ["Erro ao listar webhooks"], null);
    }
  }

  async getById(access: TeamAccess, id: string, appUrl: string): Promise<Output> {
    try {
      const result = await teamWebhookService.getById(access, id, appUrl);
      if (!result) {
        return new Output(false, [], ["Webhook não encontrado"], null);
      }
      return new Output(true, ["Webhook carregado com sucesso"], [], result);
    } catch (error) {
      console.error("[TeamWebhookUseCase][getById] Erro:", error);
      return new Output(false, [], ["Erro ao carregar webhook"], null);
    }
  }

  async create(
    access: TeamAccess,
    input: CreateInboundWebhookInput | CreateOutboundWebhookInput,
    appUrl: string
  ): Promise<Output> {
    try {
      const result = await teamWebhookService.create(access, input, appUrl);
      return new Output(true, ["Webhook criado com sucesso"], [], result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao criar webhook";
      console.error("[TeamWebhookUseCase][create] Erro:", error);
      return new Output(false, [], [message], null);
    }
  }

  async update(
    access: TeamAccess,
    id: string,
    input: UpdateTeamWebhookInput,
    appUrl: string
  ): Promise<Output> {
    try {
      const result = await teamWebhookService.update(access, id, input, appUrl);
      return new Output(true, ["Webhook atualizado com sucesso"], [], result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao atualizar webhook";
      console.error("[TeamWebhookUseCase][update] Erro:", error);
      return new Output(false, [], [message], null);
    }
  }

  async changeStatus(
    access: TeamAccess,
    id: string,
    action: TeamWebhookStatusAction,
    appUrl: string
  ): Promise<Output> {
    try {
      const result = await teamWebhookService.changeStatus(access, id, action, appUrl);
      return new Output(true, ["Status do webhook atualizado"], [], result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao alterar status";
      console.error("[TeamWebhookUseCase][changeStatus] Erro:", error);
      return new Output(false, [], [message], null);
    }
  }

  async listLogs(
    access: TeamAccess,
    id: string,
    params: { page: number; pageSize: number; result?: "success" | "failure" | "rejected" }
  ): Promise<Output> {
    try {
      const result = await teamWebhookService.listLogs(access, id, params);
      return new Output(true, ["Logs carregados com sucesso"], [], result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao carregar logs";
      console.error("[TeamWebhookUseCase][listLogs] Erro:", error);
      return new Output(false, [], [message], null);
    }
  }

  async testDelivery(access: TeamAccess, id: string): Promise<Output> {
    try {
      const result = await teamWebhookService.testDelivery(access, id);
      if (!result.ok) {
        return new Output(
          false,
          [],
          [result.errorMessage ?? "Falha no envio de teste"],
          result
        );
      }
      return new Output(true, ["Envio de teste concluído com sucesso"], [], result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro no envio de teste";
      console.error("[TeamWebhookUseCase][testDelivery] Erro:", error);
      return new Output(false, [], [message], null);
    }
  }
}

export const teamWebhookUseCase = new TeamWebhookUseCase();
