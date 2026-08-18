"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTeamContext } from "@/app/context/TeamContext";
import {
  getServiceWorkerRegistration,
  registerWebPushServiceWorker,
  urlBase64ToUint8Array,
} from "@/lib/web-push/client";
import { buildWebPushClientErrorPayload } from "@/lib/web-push/client-error-report";
import { WEB_PUSH_CONSENT_VERSION } from "@/lib/web-push/constants";
import { resolveWebPushUserErrorMessage } from "@/lib/web-push/resolve-user-error-message";
import type { EnableWebPushOptions } from "../services/IWebPushNotificationsService";
import { webPushNotificationsService } from "../services/WebPushNotificationsService";

function isBrowserPushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

export function useWebPushNotifications(supabaseId: string) {
  const { activeTeamId } = useTeamContext();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const canRequestPermission =
    isBrowserPushSupported() && permission === "default";

  useEffect(() => {
    if (!isBrowserPushSupported()) return;
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!isBrowserPushSupported()) return;

    const syncEnabledState = async () => {
      try {
        const registration = await getServiceWorkerRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        setIsEnabled(Boolean(subscription));
      } catch {
        setIsEnabled(false);
      }
    };

    void syncEnabledState();
  }, [permission]);

  const enable = useCallback(
    async ({ source }: EnableWebPushOptions) => {
      if (!supabaseId || !activeTeamId) return;
      if (!isBrowserPushSupported()) {
        void webPushNotificationsService.reportClientError(
          { supabaseId, teamId: activeTeamId },
          buildWebPushClientErrorPayload(
            new Error("Browser does not support Notification or Service Worker"),
            "enable",
          ),
        );
        toast.error("Seu navegador não suporta notificações push.");
        return;
      }

      setIsLoading(true);
      try {
        const nextPermission = await Notification.requestPermission();
        setPermission(nextPermission);
        if (nextPermission !== "granted") {
          toast.error("Permissão de notificações não concedida.");
          return;
        }

        const publicKey = await webPushNotificationsService.getVapidPublicKey();
        const registration = await registerWebPushServiceWorker();
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });

        const json = subscription.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
          throw new Error("Inscrição push inválida");
        }

        await webPushNotificationsService.subscribe(
          { supabaseId, teamId: activeTeamId },
          {
            endpoint: json.endpoint,
            keys: {
              p256dh: json.keys.p256dh,
              auth: json.keys.auth,
            },
            userAgent: navigator.userAgent,
            consentVersion: WEB_PUSH_CONSENT_VERSION,
            source,
          },
        );

        setIsEnabled(true);
        toast.success("Notificações no navegador ativadas.");
      } catch (error) {
        void webPushNotificationsService.reportClientError(
          { supabaseId, teamId: activeTeamId },
          buildWebPushClientErrorPayload(error, "enable"),
        );
        toast.error(resolveWebPushUserErrorMessage(error, "enable"));
      } finally {
        setIsLoading(false);
      }
    },
    [activeTeamId, supabaseId],
  );

  const disable = useCallback(async () => {
    if (!supabaseId || !activeTeamId) return;
    setIsLoading(true);
    try {
      const registration = await getServiceWorkerRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await webPushNotificationsService.unsubscribe(
          { supabaseId, teamId: activeTeamId },
          subscription.endpoint,
        );
        await subscription.unsubscribe();
      }
      setIsEnabled(false);
      toast.success("Notificações no navegador desativadas.");
    } catch (error) {
      void webPushNotificationsService.reportClientError(
        { supabaseId, teamId: activeTeamId },
        buildWebPushClientErrorPayload(error, "disable"),
      );
      toast.error(resolveWebPushUserErrorMessage(error, "disable"));
    } finally {
      setIsLoading(false);
    }
  }, [activeTeamId, supabaseId]);

  const handleToggle = useCallback(
    async (checked: boolean, source: EnableWebPushOptions["source"]) => {
      if (checked) {
        await enable({ source });
      } else {
        await disable();
      }
    },
    [disable, enable],
  );

  return {
    permission,
    isEnabled,
    isLoading,
    canRequestPermission,
    isSupported: isBrowserPushSupported(),
    enable,
    disable,
    handleToggle,
  };
}
