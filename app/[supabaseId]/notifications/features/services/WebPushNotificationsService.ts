import type {

  IWebPushNotificationsService,

  RequestContext,

  WebPushConsentPayload,

  WebPushConsentState,

  WebPushSubscriptionPayload,

} from "./IWebPushNotificationsService";
import { API_CLIENT_BASE } from "@/lib/route-map";



type ApiOutput = {

  isValid: boolean;

  successMessages: string[];

  errorMessages: string[];

  result: unknown;

};



export class WebPushNotificationsService implements IWebPushNotificationsService {

  private async parseOutput(response: Response): Promise<ApiOutput> {

    const data = await response.json();

    return data as ApiOutput;

  }



  async getVapidPublicKey(): Promise<string> {

    const response = await fetch(`${API_CLIENT_BASE}/notifications/push/vapid-public-key`, {

      method: "GET",

      cache: "no-store",

    });

    const output = await this.parseOutput(response);

    if (!response.ok || !output.isValid || !output.result) {

      throw new Error(output.errorMessages?.join(", ") || "Web Push indisponível");

    }



    const publicKey = (output.result as { publicKey?: string }).publicKey;

    if (!publicKey) {

      throw new Error("Chave pública do Web Push não encontrada");

    }



    return publicKey;

  }



  async getConsent(context: RequestContext): Promise<WebPushConsentState> {

    const response = await fetch(`${API_CLIENT_BASE}/notifications/push/consent`, {

      method: "GET",

      headers: {

        "x-supabase-user-id": context.supabaseId,

        "x-team-id": context.teamId,

      },

      cache: "no-store",

    });



    const output = await this.parseOutput(response);

    if (!response.ok || !output.isValid || !output.result) {

      throw new Error(output.errorMessages?.join(", ") || "Erro ao buscar consentimento");

    }



    return output.result as WebPushConsentState;

  }



  async recordConsent(context: RequestContext, payload: WebPushConsentPayload): Promise<void> {

    const response = await fetch(`${API_CLIENT_BASE}/notifications/push/consent`, {

      method: "POST",

      headers: {

        "Content-Type": "application/json",

        "x-supabase-user-id": context.supabaseId,

        "x-team-id": context.teamId,

      },

      body: JSON.stringify(payload),

    });



    const output = await this.parseOutput(response);

    if (!response.ok || !output.isValid) {

      throw new Error(output.errorMessages?.join(", ") || "Erro ao salvar consentimento");

    }

  }



  async subscribe(context: RequestContext, payload: WebPushSubscriptionPayload): Promise<void> {

    const response = await fetch(`${API_CLIENT_BASE}/notifications/push/subscribe`, {

      method: "POST",

      headers: {

        "Content-Type": "application/json",

        "x-supabase-user-id": context.supabaseId,

        "x-team-id": context.teamId,

      },

      body: JSON.stringify(payload),

    });



    const output = await this.parseOutput(response);

    if (!response.ok || !output.isValid) {

      throw new Error(output.errorMessages?.join(", ") || "Erro ao ativar notificações no navegador");

    }

  }



  async unsubscribe(context: RequestContext, endpoint: string): Promise<void> {

    const response = await fetch(`${API_CLIENT_BASE}/notifications/push/subscribe`, {

      method: "DELETE",

      headers: {

        "Content-Type": "application/json",

        "x-supabase-user-id": context.supabaseId,

        "x-team-id": context.teamId,

      },

      body: JSON.stringify({ endpoint }),

    });



    const output = await this.parseOutput(response);

    if (!response.ok || !output.isValid) {

      throw new Error(output.errorMessages?.join(", ") || "Erro ao desativar notificações no navegador");

    }

  }

}



export const webPushNotificationsService = new WebPushNotificationsService();

