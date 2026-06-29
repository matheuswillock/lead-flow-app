"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useTeamContext } from "@/app/context/TeamContext";
import { WEB_PUSH_CONSENT_VERSION } from "@/lib/web-push/constants";
import { useWebPushNotifications } from "../hooks/useWebPushNotifications";
import { webPushNotificationsService } from "../services/WebPushNotificationsService";
import { WebPushConsentDialog } from "./WebPushConsentDialog";

type NotificationsSettingsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supabaseId: string;
};

function getPermissionLabel(permission: NotificationPermission) {
  if (permission === "granted") return "Concedida";
  if (permission === "denied") return "Negada";
  return "Pendente";
}

export function NotificationsSettingsSheet({
  open,
  onOpenChange,
  supabaseId,
}: NotificationsSettingsSheetProps) {
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  const { activeTeamId } = useTeamContext();
  const { permission, isEnabled, isLoading, enable, disable } = useWebPushNotifications(supabaseId);

  const openConsentFlow = () => {
    setConsentDialogOpen(true);
  };

  const handleAcceptConsent = async () => {
    await enable({ source: "settings_sheet" });
    setConsentDialogOpen(false);
  };

  const handleDismissConsent = () => {
    setConsentDialogOpen(false);
  };

  const handleDeclineConsent = async () => {
    if (activeTeamId) {
      try {
        await webPushNotificationsService.recordConsent(
          { supabaseId, teamId: activeTeamId },
          {
            status: "declined",
            consentVersion: WEB_PUSH_CONSENT_VERSION,
            source: "settings_sheet",
          },
        );
      } catch (error) {
        console.error("[NotificationsSettingsSheet] Erro ao recusar consentimento:", error);
      }
    }
    setConsentDialogOpen(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex max-h-[90vh] w-full max-w-md flex-col">
          <SheetHeader>
            <SheetTitle>Configurar notificações</SheetTitle>
            <SheetDescription>
              Gerencie alertas no navegador e permissões para receber as mesmas notificações da aba.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 p-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">Notificações no navegador</span>
                <span className="text-xs text-muted-foreground">
                  Receba alertas mesmo com o navegador fechado ou em segundo plano.
                </span>
              </div>
              <Switch
                checked={isEnabled}
                disabled={isLoading || permission === "denied"}
                onCheckedChange={(checked) => {
                  if (checked) {
                    openConsentFlow();
                    return;
                  }
                  void disable();
                }}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 p-4 text-sm">
              <span className="text-muted-foreground">Permissão do navegador</span>
              <Badge variant={permission === "granted" ? "default" : "secondary"}>
                {getPermissionLabel(permission)}
              </Badge>
            </div>

            {permission !== "granted" ? (
              <Button
                type="button"
                disabled={isLoading || permission === "denied"}
                onClick={openConsentFlow}
              >
                Permitir notificações
              </Button>
            ) : null}

            {permission === "denied" ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                As notificações foram bloqueadas no navegador. Reative nas configurações do site para
                continuar recebendo alertas.
              </p>
            ) : null}

            <p className="text-xs text-muted-foreground">
              No Safari/iOS, as notificações push podem exigir que o app esteja instalado como atalho na
              tela inicial.
            </p>
          </div>
        </SheetContent>
      </Sheet>

      <WebPushConsentDialog
        open={consentDialogOpen}
        onOpenChange={setConsentDialogOpen}
        isLoading={isLoading}
        onAccept={handleAcceptConsent}
        onDismiss={handleDismissConsent}
        onDecline={handleDeclineConsent}
      />
    </>
  );
}
