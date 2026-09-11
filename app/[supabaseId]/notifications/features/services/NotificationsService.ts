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

  /**
   * Sem `.catch(() => null)` de propósito diferente (não é design defensivo):
   * um corpo não-JSON (502/504 de proxy/CDN) rejeita aqui com `SyntaxError`
   * ANTES de chegar em `throwFromResponse` — nunca vira `ApiRequestError`, e
   * `toUserToastMessage` já mascara `SyntaxError` (ver
   * `to-user-toast-message.test.ts`). Funciona, mas por acidente de forma —
   * documentado para o próximo review não reintroduzir um `.catch(() => null)`
   * aqui sem revisar `throwFromResponse` junto (isso mudaria `output` para
   * `undefined`/`null` e o `?.` faria cair no `fallback` de qualquer forma).
   */
  private async parseOutput(response: Response): Promise<Output> {
    const data = await response.json();
    return data as Output;
  }

  /**
   * Auditoria de review (PR #1085, Entregável 3): `fallback` aqui é sempre
   * uma constante PT-BR escrita à mão por cada chamador (ex.: "Erro ao
   * carregar notificações") — nunca interpola `response.status` nem uma
   * mensagem de exceção. Etiquetar como `ApiRequestError` incondicionalmente
   * é seguro pelo mesmo motivo de `TemplateEditorService.parseResponse`: o
   * texto que chega ao toast nunca é detalhe técnico/interno, mesmo no ramo
   * sem `errorMessages` do backend.
   */
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
