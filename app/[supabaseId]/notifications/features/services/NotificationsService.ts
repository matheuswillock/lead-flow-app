import { Output } from "@/lib/output";
import { ApiRequestError } from "@/lib/http/api-request-error";
import type { MarkAllAsReadOptions, NotificationsListResponse } from "../types/notification.types";
import { API_CLIENT_BASE } from "@/lib/route-map";

type RequestContext = {
  supabaseId: string;
  teamId: string;
};

type ListParams = RequestContext & {
  limit?: number;
  offset?: number;
};

export class NotificationsService {
  private baseUrl = `${API_CLIENT_BASE}/notifications`;

  private async parseOutput(response: Response): Promise<Output> {
    const data = await response.json();
    return data as Output;
  }

  private throwFromResponse(response: Response, output: Output, fallback: string): never {
    throw new ApiRequestError(
      output.errorMessages?.join(", ") || fallback,
      response.status,
    );
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
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "x-team-id": params.teamId,
      },
    });

    const output = await this.parseOutput(response);
    if (!response.ok || !output.isValid || !output.result) {
      this.throwFromResponse(response, output, "Erro ao carregar notificações");
    }

    return output.result as NotificationsListResponse;
  }

  async unreadCount(context: RequestContext): Promise<number> {
    const response = await fetch(`${this.baseUrl}/unread-count`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "x-team-id": context.teamId,
      },
    });

    const output = await this.parseOutput(response);
    if (!response.ok || !output.isValid || !output.result) {
      this.throwFromResponse(response, output, "Erro ao consultar notificações");
    }

    return Number((output.result as { unreadCount?: number }).unreadCount ?? 0);
  }

  async markAllAsRead(context: RequestContext, options?: MarkAllAsReadOptions): Promise<number> {
    const response = await fetch(this.baseUrl, {
      method: "PATCH",
      keepalive: options?.keepalive ?? false,
      headers: {
        "Content-Type": "application/json",
        "x-team-id": context.teamId,
      },
    });

    const output = await this.parseOutput(response);
    if (!response.ok || !output.isValid || !output.result) {
      this.throwFromResponse(response, output, "Erro ao atualizar notificações");
    }

    return Number((output.result as { markedCount?: number }).markedCount ?? 0);
  }
}

export const notificationsService = new NotificationsService();
