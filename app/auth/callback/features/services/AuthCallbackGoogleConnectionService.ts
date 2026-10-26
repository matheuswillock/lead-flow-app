import { API_CLIENT_BASE } from "@/lib/route-map";
import type {
  AuthCallbackGoogleConnectionEventInput,
  IAuthCallbackGoogleConnectionService,
} from "./IAuthCallbackGoogleConnectionService";

export class AuthCallbackGoogleConnectionService implements IAuthCallbackGoogleConnectionService {
  async recordConnectionEvent(input: AuthCallbackGoogleConnectionEventInput): Promise<boolean> {
    try {
      const response = await fetch(`${API_CLIENT_BASE}/google/connection-events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-request-id": input.requestId,
        },
        body: JSON.stringify(input),
        keepalive: true,
      });

      if (response.ok) return true;

      console.error("[AuthCallbackGoogleConnectionService] Falha ao registrar evento", {
        status: response.status,
        eventType: input.eventType,
        flow: input.flow,
        requestId: input.requestId,
      });
    } catch (error) {
      console.error("[AuthCallbackGoogleConnectionService] Erro ao registrar evento", {
        eventType: input.eventType,
        flow: input.flow,
        requestId: input.requestId,
        error,
      });
    }

    return false;
  }
}

export const authCallbackGoogleConnectionService = new AuthCallbackGoogleConnectionService();
