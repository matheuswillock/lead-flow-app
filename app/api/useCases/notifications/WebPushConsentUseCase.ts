import { profileWebPushConsentRepository } from "@/app/api/infra/data/repositories/webPush/ProfileWebPushConsentRepository";
import type { WebPushConsentSource } from "@/lib/web-push/types";
import { Output } from "@/lib/output";
import {
  WEB_PUSH_CONSENT_DISMISS_COOLDOWN_DAYS,
  WEB_PUSH_CONSENT_VERSION,
} from "@/lib/web-push/constants";
import type { WebPushConsentStatus } from "@prisma/client";

type GetConsentInput = {
  profileId: string;
};

type RecordConsentInput = {
  profileId: string;
  status: Extract<WebPushConsentStatus, "declined" | "dismissed">;
  consentVersion: string;
  source?: WebPushConsentSource | null;
};

type RecordAcceptedInput = {
  profileId: string;
  consentVersion: string;
  source?: WebPushConsentSource | null;
};

function isDismissCooldownExpired(dismissedAt: Date | null): boolean {
  if (!dismissedAt) return true;

  const cooldownMs = WEB_PUSH_CONSENT_DISMISS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - dismissedAt.getTime() >= cooldownMs;
}

function computeShouldPrompt(
  status: WebPushConsentStatus | null,
  dismissedAt: Date | null,
): boolean {
  if (!status) return true;
  if (status === "declined") return false;
  if (status === "accepted") return false;
  if (status === "dismissed") return isDismissCooldownExpired(dismissedAt);
  return false;
}

export class WebPushConsentUseCase {
  async getConsent(input: GetConsentInput): Promise<Output> {
    try {
      const consent = await profileWebPushConsentRepository.findByProfileId(input.profileId);

      const shouldPrompt = computeShouldPrompt(consent?.status ?? null, consent?.dismissedAt ?? null);

      return new Output(true, [], [], {
        status: consent?.status ?? null,
        consentVersion: consent?.consentVersion ?? null,
        consentedAt: consent?.consentedAt?.toISOString() ?? null,
        declinedAt: consent?.declinedAt?.toISOString() ?? null,
        dismissedAt: consent?.dismissedAt?.toISOString() ?? null,
        source: consent?.source ?? null,
        shouldPrompt,
        currentConsentVersion: WEB_PUSH_CONSENT_VERSION,
      });
    } catch (error) {
      console.error("[WebPushConsentUseCase][getConsent] Erro:", error);
      return new Output(false, [], ["Erro ao buscar consentimento de notificações"], null);
    }
  }

  async recordConsent(input: RecordConsentInput): Promise<Output> {
    if (input.consentVersion !== WEB_PUSH_CONSENT_VERSION) {
      return new Output(false, [], ["Versão de consentimento inválida"], null);
    }

    try {
      await profileWebPushConsentRepository.upsertConsent({
        profileId: input.profileId,
        status: input.status,
        consentVersion: input.consentVersion,
        source: input.source ?? null,
      });

      const message =
        input.status === "declined"
          ? "Preferência de notificações salva"
          : "Você poderá ativar as notificações mais tarde";

      return new Output(true, [message], [], null);
    } catch (error) {
      console.error("[WebPushConsentUseCase][recordConsent] Erro:", error);
      return new Output(false, [], ["Erro ao salvar consentimento de notificações"], null);
    }
  }

  async recordAccepted(input: RecordAcceptedInput): Promise<Output> {
    if (input.consentVersion !== WEB_PUSH_CONSENT_VERSION) {
      return new Output(false, [], ["Versão de consentimento inválida"], null);
    }

    try {
      await profileWebPushConsentRepository.upsertConsent({
        profileId: input.profileId,
        status: "accepted",
        consentVersion: input.consentVersion,
        source: input.source ?? null,
      });

      return new Output(true, ["Consentimento de notificações registrado"], [], null);
    } catch (error) {
      console.error("[WebPushConsentUseCase][recordAccepted] Erro:", error);
      return new Output(false, [], ["Erro ao registrar consentimento de notificações"], null);
    }
  }
}

export const webPushConsentUseCase = new WebPushConsentUseCase();
