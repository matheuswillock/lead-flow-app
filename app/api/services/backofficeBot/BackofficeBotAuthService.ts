import { backofficeBotRepository } from "@/app/api/infra/data/repositories/backofficeBot/BackofficeBotRepository";
import {
  generateAuthCode,
  getAuthCodeExpiresAt,
  hashAuthCode,
  studioBotAuthLimits,
  verifyAuthCode,
} from "@/lib/studio-bot/auth-code";
import { normalizePhoneE164, phoneDigitsEqual } from "@/lib/studio-bot/phone";

const GENERIC_EMAIL_RESPONSE = {
  challengeId: null as string | null,
  expiresAt: null as string | null,
};

function resolveAssistantPhoneDigits(channelPhone?: string | null): string | null {
  const candidates = [
    channelPhone,
    process.env.BACKOFFICE_BETHANIA_WHATSAPP_NUMBER,
    process.env.NEXT_PUBLIC_BETHANIA_WHATSAPP_NUMBER,
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const digits = candidate.replace(/\D/g, "");
    if (digits.length >= 10) {
      return digits;
    }
  }

  return null;
}

export class BackofficeBotAuthService {
  async requestCode(email: string, normalizedPhone: string) {
    const phone = normalizePhoneE164(normalizedPhone);
    if (!phone) {
      return { ok: false as const, error: "PHONE_INVALID" };
    }

    const profile = await backofficeBotRepository.findProfileByEmail(email);

    if (!profile) {
      return { ok: true as const, result: GENERIC_EMAIL_RESPONSE };
    }

    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await backofficeBotRepository.countRecentChallengesForProfile(
      profile.id,
      since
    );
    if (recentCount >= studioBotAuthLimits.maxCodeGenerationsPerHour) {
      return { ok: false as const, error: "RATE_LIMIT" };
    }

    await backofficeBotRepository.expirePendingChallengesForPhone(phone);

    const code = generateAuthCode();
    const codeHash = await hashAuthCode(code);
    const expiresAt = getAuthCodeExpiresAt();

    const challenge = await backofficeBotRepository.createAuthChallenge({
      source: "channel_email",
      codeHash,
      expiresAt,
      normalizedPhone: phone,
      emailRequested: email.trim(),
      profileId: profile.id,
    });

    return {
      ok: true as const,
      result: {
        challengeId: challenge.id,
        expiresAt: expiresAt.toISOString(),
        profileId: profile.id,
        code,
        activeTeamId: profile.activeTeamId,
      },
    };
  }

  async verifyCode(normalizedPhone: string, code: string) {
    const phone = normalizePhoneE164(normalizedPhone);
    if (!phone) {
      return { ok: false as const, error: "PHONE_INVALID" };
    }

    const challenge =
      (await backofficeBotRepository.findPendingChallengeByPhone(phone)) ??
      (await this.findWebOtpChallengeByCode(phone, code));

    if (!challenge) {
      return { ok: false as const, error: "AUTH_EXPIRED_OTP" };
    }

    if (challenge.expiresAt <= new Date()) {
      await backofficeBotRepository.updateChallengeStatus(challenge.id, "expired");
      return { ok: false as const, error: "AUTH_EXPIRED_OTP" };
    }

    if (challenge.attemptCount >= studioBotAuthLimits.maxVerifyAttempts) {
      await backofficeBotRepository.updateChallengeStatus(challenge.id, "failed");
      return { ok: false as const, error: "AUTH_EXPIRED_OTP" };
    }

    const isValid = await verifyAuthCode(code, challenge.codeHash);
    if (!isValid) {
      const updated = await backofficeBotRepository.incrementChallengeAttempt(challenge.id);
      if (updated.attemptCount >= studioBotAuthLimits.maxVerifyAttempts) {
        await backofficeBotRepository.updateChallengeStatus(challenge.id, "failed");
      }
      return { ok: false as const, error: "AUTH_INVALID_CODE" };
    }

    // O WhatsApp que envia VINCULAR deve ser o mesmo número solicitado no challenge
    // (channel_email) ou o telefone cadastrado no perfil (web_otp).
    if (challenge.normalizedPhone) {
      if (!phoneDigitsEqual(challenge.normalizedPhone, phone)) {
        await backofficeBotRepository.incrementChallengeAttempt(challenge.id);
        return { ok: false as const, error: "PHONE_MISMATCH" };
      }
    } else if (challenge.source === "web_otp" && challenge.profileId) {
      const profilePhone = await backofficeBotRepository.resolveProfilePhone(challenge.profileId);
      if (!profilePhone) {
        return { ok: false as const, error: "PROFILE_PHONE_REQUIRED" };
      }
      if (!phoneDigitsEqual(profilePhone, phone)) {
        await backofficeBotRepository.incrementChallengeAttempt(challenge.id);
        return { ok: false as const, error: "PHONE_MISMATCH" };
      }
    } else {
      return { ok: false as const, error: "PHONE_MISMATCH" };
    }

    const profileId = challenge.profileId;
    if (!profileId) {
      return { ok: false as const, error: "PROFILE_NOT_FOUND" };
    }

    const existingPhoneLink = await backofficeBotRepository.findActiveUserLinkByPhone(phone);
    if (existingPhoneLink && existingPhoneLink.profileId !== profileId) {
      return { ok: false as const, error: "PHONE_ALREADY_LINKED" };
    }

    const profile = await backofficeBotRepository.findProfileActiveTeam(profileId);
    if (!profile?.activeTeamId) {
      return { ok: false as const, error: "TEAM_NOT_FOUND" };
    }

    await backofficeBotRepository.updateChallengeStatus(challenge.id, "verified", {
      verifiedAt: new Date(),
      profileId,
      normalizedPhone: phone,
    });

    let userLinkId: string;
    if (existingPhoneLink) {
      userLinkId = existingPhoneLink.id;
    } else {
      const existingProfileLink = await backofficeBotRepository.findActiveUserLinkByProfile(profileId);
      if (existingProfileLink) {
        await backofficeBotRepository.revokeUserLink(existingProfileLink.id);
      }

      const createdLink = await backofficeBotRepository.createUserLink({
        profileId,
        normalizedPhone: phone,
        linkedBy: challenge.source === "web_otp" ? "web_otp" : "channel_email",
        authChallengeId: challenge.id,
      });
      userLinkId = createdLink.id;
    }

    await backofficeBotRepository.upsertSession({
      userLinkId,
      teamId: profile.activeTeamId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    return {
      ok: true as const,
      result: {
        profileId,
        teamId: profile.activeTeamId,
        userLinkId,
      },
    };
  }

  async linkInitiate(profileId: string) {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await backofficeBotRepository.countRecentChallengesForProfile(
      profileId,
      since
    );
    if (recentCount >= studioBotAuthLimits.maxCodeGenerationsPerHour) {
      return { ok: false as const, error: "RATE_LIMIT" };
    }

    const profilePhone = await backofficeBotRepository.resolveProfilePhone(profileId);
    if (!profilePhone) {
      return { ok: false as const, error: "PROFILE_PHONE_REQUIRED" };
    }

    await backofficeBotRepository.expirePendingChallengesForProfile(profileId);

    const code = generateAuthCode();
    const codeHash = await hashAuthCode(code);
    const expiresAt = getAuthCodeExpiresAt();

    const challenge = await backofficeBotRepository.createAuthChallenge({
      source: "web_otp",
      codeHash,
      expiresAt,
      profileId,
      normalizedPhone: profilePhone,
    });

    return {
      ok: true as const,
      result: {
        challengeId: challenge.id,
        code,
        expiresAt: expiresAt.toISOString(),
        expectedPhone: profilePhone,
      },
    };
  }

  async linkStatus(profileId: string) {
    const channel = await backofficeBotRepository.getActiveChannel();
    const botAvailable = Boolean(channel?.isActive && channel.status === "connected");
    const botStatus = channel?.status ?? ("unavailable" as const);
    const assistantPhone = resolveAssistantPhoneDigits(channel?.phoneNumber);

    const link = await backofficeBotRepository.findActiveUserLinkByProfile(profileId);
    if (!link) {
      return {
        ok: true as const,
        result: {
          linked: false as const,
          botAvailable,
          botStatus,
          assistantPhone,
        },
      };
    }

    return {
      ok: true as const,
      result: {
        linked: true as const,
        normalizedPhone: link.normalizedPhone,
        linkedAt: link.linkedAt.toISOString(),
        userLinkId: link.id,
        botAvailable,
        botStatus,
        assistantPhone,
      },
    };
  }

  async revokeLink(profileId: string) {
    const link = await backofficeBotRepository.revokeUserLinkByProfile(profileId);
    if (!link) {
      return { ok: false as const, error: "NOT_LINKED" };
    }
    return { ok: true as const, result: { revoked: true, userLinkId: link.id } };
  }

  async getAuthStatus(normalizedPhone: string) {
    const phone = normalizePhoneE164(normalizedPhone);
    if (!phone) {
      return { ok: false as const, error: "PHONE_INVALID" };
    }

    const link = await backofficeBotRepository.findActiveUserLinkByPhone(phone);
    if (link) {
      return {
        ok: true as const,
        result: {
          linked: true as const,
          profileId: link.profileId,
          userLinkId: link.id,
        },
      };
    }

    const pendingChallenge = await backofficeBotRepository.findPendingChallengeByPhone(phone);
    return {
      ok: true as const,
      result: {
        linked: false as const,
        pendingChallenge: pendingChallenge
          ? { challengeId: pendingChallenge.id, expiresAt: pendingChallenge.expiresAt.toISOString() }
          : null,
      },
    };
  }

  private async findWebOtpChallengeByCode(_phone: string, code: string) {
    const challenges = await backofficeBotRepository.findPendingWebOtpChallenges(10);

    for (const challenge of challenges) {
      const valid = await verifyAuthCode(code, challenge.codeHash);
      if (valid) {
        return challenge;
      }
    }

    return null;
  }
}

export const backofficeBotAuthService = new BackofficeBotAuthService();
