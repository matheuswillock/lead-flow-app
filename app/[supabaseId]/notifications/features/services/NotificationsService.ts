import { Output } from "@/lib/output";
import type { MarkAllAsReadOptions, NotificationsListResponse } from "../types/notification.types";

type RequestContext = {
  supabaseId: string;
  teamId: string;
};

type ListParams = RequestContext & {
  limit?: number;
  offset?: number;
};

export class NotificationsService {
  private baseUrl = "/api/v1/notifications";

  private async parseOutput(response: Response): Promise<Output> {
    const data = await response.json();
    return data as Output;
  }

  async list(params: ListParams): Promise<NotificationsListResponse> {
    const searchParams = new URLSearchParams();
    if (typeof params.limit === "number") {
      searchParams.set("limit", String(params.limit));
    }
    if (typeof params.offset === "number") {
      searchParams.set("offset", String(params.offset));
    }

    const query = searchParams.toString();
    const response = await fetch(`${this.baseUrl}${query ? `?${query}` : ""}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-supabase-user-id": params.supabaseId,
        "x-team-id": params.teamId,
      },
    });

    const output = await this.parseOutput(response);
    if (!response.ok || !output.isValid || !output.result) {
      throw new Error(output.errorMessages?.join(", ") || "Erro ao carregar notificações");
    }

    return output.result as NotificationsListResponse;
  }

  async getUnreadCount(context: RequestContext): Promise<number> {
    const response = await fetch(`${this.baseUrl}/unread-count`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-supabase-user-id": context.supabaseId,
        "x-team-id": context.teamId,
      },
    });

    const output = await this.parseOutput(response);
    if (!response.ok || !output.isValid || !output.result) {
      throw new Error(output.errorMessages?.join(", ") || "Erro ao consultar notificações");
    }

    return Number((output.result as { unreadCount?: number }).unreadCount ?? 0);
  }

  async markAllAsRead(context: RequestContext, options?: MarkAllAsReadOptions): Promise<number> {
    const response = await fetch(this.baseUrl, {
      method: "PATCH",
      keepalive: options?.keepalive ?? false,
      headers: {
        "Content-Type": "application/json",
        "x-supabase-user-id": context.supabaseId,
        "x-team-id": context.teamId,
      },
    });

    const output = await this.parseOutput(response);
    if (!response.ok || !output.isValid || !output.result) {
      throw new Error(output.errorMessages?.join(", ") || "Erro ao atualizar notificações");
    }

    return Number((output.result as { markedCount?: number }).markedCount ?? 0);
  }
}

export const notificationsService = new NotificationsService();
