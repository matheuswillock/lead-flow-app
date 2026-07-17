import type {
  BackofficeBotAuthChallengeSource,
  BackofficeBotAuthChallengeStatus,
  BackofficeBotChannelStatus,
} from "@prisma/client";
import { Output } from "@/lib/output";
import { backofficeBotRepository } from "@/app/api/infra/data/repositories/backofficeBot/BackofficeBotRepository";
import { studioBotN8nDispatchService } from "@/app/api/services/backofficeBot/StudioBotN8nDispatchService";
import {
  backofficeEvoApiService,
  toBackofficeQrCodeImageUrl,
} from "@/app/api/services/backofficeBot/evo/BackofficeEvoApiService";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { IBackofficeBotChannelUseCase } from "./IBackofficeBotChannelUseCase";

const BACKOFFICE_BOT_AVATAR_BUCKET =
  process.env.SUPABASE_BACKOFFICE_BOT_BUCKET || "backoffice-bot";

function buildPagination(page: number, pageSize: number, totalItems: number) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

function toChannelDto(channel: Awaited<ReturnType<typeof backofficeBotRepository.findPrimaryChannel>>) {
  if (!channel) return null;
  return {
    id: channel.id,
    displayName: channel.displayName,
    avatarUrl: channel.avatarUrl,
    aboutText: channel.aboutText,
    phoneNumber: channel.phoneNumber,
    channelType: channel.channelType,
    status: channel.status,
    n8nInboundUrl: channel.n8nInboundUrl,
    isActive: channel.isActive,
    lastProfileSyncAt: channel.lastProfileSyncAt,
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
  };
}

function mapEvoStatusToChannelStatus(
  evoStatus: "open" | "close" | "connecting"
): BackofficeBotChannelStatus {
  if (evoStatus === "open") {
    return "connected";
  }
  if (evoStatus === "close") {
    return "disconnected";
  }
  return "pending";
}

export class BackofficeBotChannelUseCase implements IBackofficeBotChannelUseCase {
  /**
   * Alinha status/telefone do canal com a instância Evolution (fonte de verdade do número).
   */
  private async syncChannelFromEvolution(
    channel: NonNullable<Awaited<ReturnType<typeof backofficeBotRepository.findPrimaryChannel>>>
  ) {
    const instanceName = process.env.EVO_BETHANIA_INSTANCE?.trim() || "bethania";

    const evoStatus = await backofficeEvoApiService
      .getInstanceConnectionState(instanceName)
      .catch((error) => {
        console.error("[BackofficeBotChannelUseCase][syncChannelFromEvolution] state", error);
        return null;
      });

    if (!evoStatus) {
      return channel;
    }

    const nextStatus = mapEvoStatusToChannelStatus(evoStatus);
    let phoneNumber = channel.phoneNumber;

    if (evoStatus === "open") {
      const livePhone = await backofficeEvoApiService
        .getInstancePhoneNumber(instanceName)
        .catch((error) => {
          console.error("[BackofficeBotChannelUseCase][syncChannelFromEvolution] phone", error);
          return null;
        });
      if (livePhone) {
        phoneNumber = livePhone;
      }
    }

    const phoneChanged = (phoneNumber ?? null) !== (channel.phoneNumber ?? null);
    const statusChanged = channel.status !== nextStatus;

    if (!phoneChanged && !statusChanged) {
      return channel;
    }

    return backofficeBotRepository.upsertChannel({
      status: nextStatus,
      phoneNumber: phoneNumber ?? null,
    });
  }

  async getChannel(): Promise<Output> {
    try {
      let channel = await backofficeBotRepository.findPrimaryChannel();

      if (channel) {
        channel = await this.syncChannelFromEvolution(channel);
      }

      return new Output(true, [], [], { channel: toChannelDto(channel) });
    } catch (error) {
      console.error("[BackofficeBotChannelUseCase][getChannel]", error);
      return new Output(false, [], ["Erro ao buscar canal"], null);
    }
  }

  async upsertChannel(data: {
    displayName?: string;
    aboutText?: string | null;
    n8nInboundUrl?: string | null;
    status?: BackofficeBotChannelStatus;
    isActive?: boolean;
  }): Promise<Output> {
    try {
      const channel = await backofficeBotRepository.upsertChannel(data);
      const successMessage =
        data.isActive === false
          ? "Bethânia desabilitada para usuários"
          : data.isActive === true
            ? "Bethânia habilitada para usuários"
            : "Canal atualizado";
      return new Output(true, [successMessage], [], { channel: toChannelDto(channel) });
    } catch (error) {
      console.error("[BackofficeBotChannelUseCase][upsertChannel]", error);
      return new Output(false, [], ["Erro ao salvar canal"], null);
    }
  }

  async updateChannelProfile(data: {
    displayName?: string;
    aboutText?: string | null;
  }): Promise<Output> {
    try {
      const active = await backofficeBotRepository.findPrimaryChannel();
      if (!active) {
        return new Output(false, [], ["Canal não configurado"], null);
      }
      const channel = await backofficeBotRepository.updateChannelProfile(active.id, data);
      return new Output(true, ["Perfil do canal atualizado"], [], { channel: toChannelDto(channel) });
    } catch (error) {
      console.error("[BackofficeBotChannelUseCase][updateChannelProfile]", error);
      return new Output(false, [], ["Erro ao atualizar perfil do canal"], null);
    }
  }

  async listConversations(
    filters: { search?: string; dateFrom?: string; dateTo?: string },
    pagination: { page: number; pageSize: number }
  ): Promise<Output> {
    try {
      const page = Math.max(pagination.page, 1);
      const pageSize = Math.max(pagination.pageSize, 5);
      const result = await backofficeBotRepository.listConversations(
        {
          search: filters.search,
          dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
          dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
        },
        { page, pageSize }
      );
      return new Output(true, [], [], {
        items: result.items,
        pagination: buildPagination(page, pageSize, result.totalItems),
      });
    } catch (error) {
      console.error("[BackofficeBotChannelUseCase][listConversations]", error);
      return new Output(false, [], ["Erro ao listar conversas"], null);
    }
  }

  async listMessages(
    userLinkId: string,
    pagination: { before?: string; limit: number }
  ): Promise<Output> {
    try {
      const link = await backofficeBotRepository.findUserLinkById(userLinkId);
      if (!link) {
        return new Output(false, [], ["Vínculo não encontrado"], null);
      }

      const messages = await backofficeBotRepository.listMessagesByUserLink(userLinkId, {
        before: pagination.before ? new Date(pagination.before) : undefined,
        limit: Math.min(Math.max(pagination.limit, 1), 100),
      });

      return new Output(true, [], [], {
        userLink: {
          id: link.id,
          profileId: link.profileId,
          normalizedPhone: link.normalizedPhone,
          profile: link.profile,
        },
        messages: messages.reverse(),
      });
    } catch (error) {
      console.error("[BackofficeBotChannelUseCase][listMessages]", error);
      return new Output(false, [], ["Erro ao listar mensagens"], null);
    }
  }

  async listUserLinks(pagination: { page: number; pageSize: number }): Promise<Output> {
    try {
      const page = Math.max(pagination.page, 1);
      const pageSize = Math.max(pagination.pageSize, 5);
      const result = await backofficeBotRepository.listUserLinks({ page, pageSize });
      return new Output(true, [], [], {
        items: result.items,
        pagination: buildPagination(page, pageSize, result.totalItems),
      });
    } catch (error) {
      console.error("[BackofficeBotChannelUseCase][listUserLinks]", error);
      return new Output(false, [], ["Erro ao listar vínculos"], null);
    }
  }

  async revokeUserLink(userLinkId: string): Promise<Output> {
    try {
      const link = await backofficeBotRepository.findUserLinkById(userLinkId);
      if (!link) {
        return new Output(false, [], ["Vínculo não encontrado"], null);
      }
      const revoked = await backofficeBotRepository.revokeUserLink(userLinkId);
      return new Output(true, ["Vínculo revogado"], [], { userLinkId: revoked.id });
    } catch (error) {
      console.error("[BackofficeBotChannelUseCase][revokeUserLink]", error);
      return new Output(false, [], ["Erro ao revogar vínculo"], null);
    }
  }

  async listAuthChallenges(
    filters: { source?: string; status?: string },
    pagination: { page: number; pageSize: number }
  ): Promise<Output> {
    try {
      const page = Math.max(pagination.page, 1);
      const pageSize = Math.max(pagination.pageSize, 5);
      const result = await backofficeBotRepository.listAuthChallenges(
        {
          source: filters.source as BackofficeBotAuthChallengeSource | undefined,
          status: filters.status as BackofficeBotAuthChallengeStatus | undefined,
        },
        { page, pageSize }
      );
      return new Output(true, [], [], {
        items: result.items,
        pagination: buildPagination(page, pageSize, result.totalItems),
      });
    } catch (error) {
      console.error("[BackofficeBotChannelUseCase][listAuthChallenges]", error);
      return new Output(false, [], ["Erro ao listar verificações"], null);
    }
  }

  async testPing(): Promise<Output> {
    try {
      const result = await studioBotN8nDispatchService.sendTestPing();
      if (result.status === 0) {
        return new Output(false, [], ["BACKOFFICE_N8N_OUTBOUND_URL não configurada"], null);
      }
      if (result.ok) {
        return new Output(true, [], [], { status: result.status, ok: true });
      }

      const hint =
        result.status === 404
          ? "N8N respondeu 404 — importe e ative o workflow bethania-push-outbound (bun run n8n:import)."
          : `N8N não respondeu com sucesso (HTTP ${result.status}).`;

      return new Output(false, [], [hint], {
        status: result.status,
        ok: false,
      });
    } catch (error) {
      console.error("[BackofficeBotChannelUseCase][testPing]", error);
      const message =
        error instanceof TypeError
          ? "N8N inacessível — confira se o stack está no ar (bun run n8n:up) e BACKOFFICE_N8N_OUTBOUND_URL."
          : "Erro ao testar ping N8N";
      return new Output(false, [], [message], null);
    }
  }

  async uploadChannelAvatar(file: File): Promise<Output> {
    try {
      const active = await backofficeBotRepository.findPrimaryChannel();
      if (!active) {
        return new Output(false, [], ["Canal não configurado"], null);
      }

      const allowed = ["image/jpeg", "image/png", "image/webp"];
      if (!allowed.includes(file.type)) {
        return new Output(false, [], ["Formato de imagem não suportado"], null);
      }

      const supabase = createSupabaseAdmin();
      if (!supabase) {
        return new Output(false, [], ["Storage não disponível"], null);
      }

      const storagePath = `channel/${active.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error } = await supabase.storage
        .from(BACKOFFICE_BOT_AVATAR_BUCKET)
        .upload(storagePath, buffer, { contentType: file.type, upsert: true });

      if (error) {
        return new Output(false, [], [`Erro no upload: ${error.message}`], null);
      }

      const { data: publicData } = supabase.storage
        .from(BACKOFFICE_BOT_AVATAR_BUCKET)
        .getPublicUrl(storagePath);

      const channel = await backofficeBotRepository.updateChannelProfile(active.id, {
        avatarUrl: publicData.publicUrl,
        avatarStoragePath: storagePath,
      });

      return new Output(true, ["Avatar atualizado"], [], { channel: toChannelDto(channel) });
    } catch (error) {
      console.error("[BackofficeBotChannelUseCase][uploadChannelAvatar]", error);
      return new Output(false, [], ["Erro ao enviar avatar"], null);
    }
  }

  async reconnectChannel(): Promise<Output> {
    try {
      const active =
        (await backofficeBotRepository.findPrimaryChannel()) ??
        (await backofficeBotRepository.upsertChannel({}));

      if (!active.n8nInboundUrl) {
        return new Output(false, [], ["Configure a URL inbound N8N antes de conectar"], {
          channel: toChannelDto(active),
        });
      }

      const instanceName = process.env.EVO_BETHANIA_INSTANCE?.trim() || "bethania";

      const result = await backofficeEvoApiService.connectInstance({
        instanceName,
        webhookUrl: active.n8nInboundUrl,
      });

      const channel = await backofficeBotRepository.upsertChannel({
        status: result.status === "open" ? "connected" : "pending",
        providerConfig: { instanceName },
        ...(result.phoneNumber ? { phoneNumber: result.phoneNumber } : {}),
      });

      return new Output(true, [], [], {
        channel: toChannelDto(channel),
        qrCode: result.qrCode
          ? { imageUrl: toBackofficeQrCodeImageUrl(result.qrCode.base64), text: result.qrCode.text }
          : null,
      });
    } catch (error) {
      console.error("[BackofficeBotChannelUseCase][reconnectChannel]", error);
      return new Output(false, [], ["Erro ao reconectar canal"], null);
    }
  }

  async refreshChannelConnection(): Promise<Output> {
    try {
      const active = await backofficeBotRepository.findPrimaryChannel();
      if (!active) {
        return new Output(false, [], ["Canal não configurado"], null);
      }

      const channel = await this.syncChannelFromEvolution(active);
      const connected = channel.status === "connected";

      return new Output(true, [], [], {
        channel: toChannelDto(channel),
        evoStatus:
          channel.status === "connected"
            ? "open"
            : channel.status === "pending"
              ? "connecting"
              : "close",
        connected,
      });
    } catch (error) {
      console.error("[BackofficeBotChannelUseCase][refreshChannelConnection]", error);
      return new Output(false, [], ["Erro ao atualizar status da conexão"], null);
    }
  }

  async disconnectChannel(): Promise<Output> {
    try {
      const active = await backofficeBotRepository.findPrimaryChannel();
      if (!active) {
        return new Output(false, [], ["Canal não configurado"], null);
      }

      const instanceName = process.env.EVO_BETHANIA_INSTANCE?.trim() || "bethania";

      await backofficeEvoApiService.disconnectInstance(instanceName);

      const channel = await backofficeBotRepository.upsertChannel({
        status: "disconnected",
        phoneNumber: null,
      });

      return new Output(
        true,
        ["WhatsApp da Bethânia desconectado. Conecte um novo número pelo QR Code."],
        [],
        { channel: toChannelDto(channel) }
      );
    } catch (error) {
      console.error("[BackofficeBotChannelUseCase][disconnectChannel]", error);
      return new Output(false, [], ["Erro ao desconectar canal WhatsApp"], null);
    }
  }

  async syncChannelProfile(): Promise<Output> {
    try {
      const active = await backofficeBotRepository.findPrimaryChannel();
      if (!active) {
        return new Output(false, [], ["Canal não configurado"], null);
      }

      const dispatch = await studioBotN8nDispatchService.dispatchEvent(
        {
          eventType: "studio_bot.channel_sync_profile",
          channelId: active.id,
          displayName: active.displayName,
          aboutText: active.aboutText,
          avatarUrl: active.avatarUrl,
          timestamp: new Date().toISOString(),
        },
        `channel-sync:${active.id}:${Date.now()}`
      );

      if (dispatch.ok) {
        await backofficeBotRepository.updateChannelProfile(active.id, {
          lastProfileSyncAt: new Date(),
        });
      }

      return new Output(dispatch.ok, [], dispatch.ok ? ["Sync solicitado"] : ["Falha no sync"], {
        ok: dispatch.ok,
        status: dispatch.status,
      });
    } catch (error) {
      console.error("[BackofficeBotChannelUseCase][syncChannelProfile]", error);
      return new Output(false, [], ["Erro ao sincronizar perfil"], null);
    }
  }
}

export const backofficeBotChannelUseCase = new BackofficeBotChannelUseCase();
