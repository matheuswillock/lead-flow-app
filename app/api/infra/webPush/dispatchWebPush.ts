import webpush from "web-push";
import { profileWebPushSubscriptionRepository } from "@/app/api/infra/data/repositories/webPush/ProfileWebPushSubscriptionRepository";
import { buildNotificationUrl, type NotificationLinkMetadata } from "@/lib/notifications/build-notification-url";

type SendToProfileInput = {
  profileId: string;
  teamId: string;
  type: string;
  message: string;
  metadata?: NotificationLinkMetadata | null;
  notificationId?: string;
};

let configured = false;

function ensureConfigured(): boolean {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return false;
  }

  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }

  return true;
}

export function getWebPushPublicKey(): string | null {
  return process.env.WEB_PUSH_VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ?? null;
}

export async function dispatchWebPushToProfile(input: SendToProfileInput): Promise<void> {
  if (!ensureConfigured()) {
    return;
  }

  const [subscriptions, supabaseId] = await Promise.all([
    profileWebPushSubscriptionRepository.findActiveByProfileId(input.profileId),
    profileWebPushSubscriptionRepository.findSupabaseIdByProfileId(input.profileId),
  ]);

  if (subscriptions.length === 0 || !supabaseId) {
    return;
  }

  const url = buildNotificationUrl({
    supabaseId,
    type: input.type,
    metadata: input.metadata,
  });

  const payload = JSON.stringify({
    title: "Corretor Studio",
    body: input.message,
    url,
    notificationId: input.notificationId ?? null,
  });

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload,
        );
      } catch (error) {
        const statusCode =
          error && typeof error === "object" && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : null;

        if (statusCode === 404 || statusCode === 410) {
          await profileWebPushSubscriptionRepository.deactivateByEndpoint(subscription.endpoint);
        }

        console.error("[dispatchWebPushToProfile] Falha ao enviar push:", error);
      }
    }),
  );
}
