import { Output } from "@/lib/output";
import { profileWebPushSubscriptionRepository } from "@/app/api/infra/data/repositories/webPush/ProfileWebPushSubscriptionRepository";
import type { WebPushConsentSource } from "@/lib/web-push/types";
import { webPushConsentUseCase } from "@/app/api/useCases/notifications/WebPushConsentUseCase";
import { getWebPushPublicKey } from "@/app/api/infra/webPush/dispatchWebPush";

type SubscribeInput = {
  profileId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
  consentVersion?: string | null;
  source?: WebPushConsentSource | null;
};

type UnsubscribeInput = {
  profileId: string;
  endpoint: string;
};

export class WebPushSubscriptionUseCase {
  getVapidPublicKey(): Output {
    const publicKey = getWebPushPublicKey();
    if (!publicKey) {
      return new Output(false, [], ["Web Push não configurado no servidor"], null);
    }

    return new Output(true, [], [], { publicKey });
  }

  async subscribe(input: SubscribeInput): Promise<Output> {
    try {
      await profileWebPushSubscriptionRepository.upsertSubscription({
        profileId: input.profileId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
      });

      if (input.consentVersion) {
        const consentOutput = await webPushConsentUseCase.recordAccepted({
          profileId: input.profileId,
          consentVersion: input.consentVersion,
          source: input.source ?? null,
        });

        if (!consentOutput.isValid) {
          return consentOutput;
        }
      }

      return new Output(true, ["Inscrição de notificações salva"], [], null);
    } catch (error) {
      console.error("[WebPushSubscriptionUseCase][subscribe] Erro:", error);
      return new Output(false, [], ["Erro ao salvar inscrição de notificações"], null);
    }
  }

  async unsubscribe(input: UnsubscribeInput): Promise<Output> {
    try {
      await profileWebPushSubscriptionRepository.deactivateSubscription({
        profileId: input.profileId,
        endpoint: input.endpoint,
      });

      return new Output(true, ["Inscrição de notificações removida"], [], null);
    } catch (error) {
      console.error("[WebPushSubscriptionUseCase][unsubscribe] Erro:", error);
      return new Output(false, [], ["Erro ao remover inscrição de notificações"], null);
    }
  }
}

export const webPushSubscriptionUseCase = new WebPushSubscriptionUseCase();
