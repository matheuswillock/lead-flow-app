"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Bell, CircleAlert, ExternalLink, Mail, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  buildNotificationPath,
  getMeetingLink,
  hasLeadNotificationLink,
} from "@/lib/notifications/build-notification-url";
import type { NotificationItem } from "../types/notification.types";
import { useNotifications } from "../context/NotificationsHook";
import { useTimezone } from "@/app/context/TimezoneContext";
import { formatIntimezone } from "@/lib/dates";
import { NotificationsSettingsSheet } from "../components/NotificationsSettingsSheet";

function formatCreatedAt(value: string, tz: string) {
  try {
    return formatIntimezone(new Date(value), "dd/MM/yyyy HH:mm", tz);
  } catch {
    return value;
  }
}

function getLeadCode(notification: NotificationItem) {
  const metadata = notification.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  return typeof metadata.leadCode === "string" ? metadata.leadCode : null;
}

function getScheduleShareUrl(notification: NotificationItem) {
  return getMeetingLink(notification.metadata);
}

function hasLeadLink(notification: NotificationItem) {
  return hasLeadNotificationLink(notification.type, notification.metadata);
}

function isProposalPendingNotification(notification: NotificationItem) {
  return notification.type === "LEAD_PROPOSAL_PENDING";
}

function isTransferActivatedNotification(notification: NotificationItem) {
  return notification.type === "LEAD_TRANSFER_ACTIVATED";
}

function getSdrName(notification: NotificationItem) {
  const metadata = notification.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  return typeof metadata.sdrName === "string" && metadata.sdrName.trim()
    ? metadata.sdrName.trim()
    : null;
}

function getNotificationEvent(notification: NotificationItem) {
  const metadata = notification.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  return typeof metadata.event === "string" ? metadata.event : null;
}

function getGoogleNotificationBadge(notification: NotificationItem) {
  const event = getNotificationEvent(notification);
  if (event === "GOOGLE_CONNECTED") {
    return {
      label: "Google conectado",
      className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200",
    };
  }

  if (event === "GOOGLE_DISCONNECTED") {
    return {
      label: "Google desconectado",
      className: "bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-200",
    };
  }

  return null;
}

export function NotificationsContainer() {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { tz } = useTimezone();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
    notifications,
    total,
    isLoadingList,
    error,
    loadNotifications,
    markAllAsRead,
  } = useNotifications();
  const markedOnExitRef = useRef(false);
  const canMarkOnExitRef = useRef(false);

  const triggerMarkAllAsReadOnExit = useCallback((keepalive: boolean) => {
    if (markedOnExitRef.current || !canMarkOnExitRef.current) return;
    markedOnExitRef.current = true;
    void markAllAsRead({ keepalive });
  }, [markAllAsRead]);

  useEffect(() => {
    const load = async () => {
      await loadNotifications({ limit: 100, offset: 0 });
    };

    void load();
  }, [loadNotifications]);

  useEffect(() => {
    markedOnExitRef.current = false;
    canMarkOnExitRef.current = false;
    const activationTimeout = window.setTimeout(() => {
      canMarkOnExitRef.current = true;
    }, 0);

    const handlePageHide = () => {
      triggerMarkAllAsReadOnExit(true);
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.clearTimeout(activationTimeout);
      window.removeEventListener("pagehide", handlePageHide);
      triggerMarkAllAsReadOnExit(true);
    };
  }, [triggerMarkAllAsReadOnExit]);

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações
          </CardTitle>
          <CardDescription>
            {total > 0 ? `${total} notificação(ões)` : "Sem notificações no momento"}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings data-icon="inline-start" />
            Configurar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void loadNotifications({ limit: 100, offset: 0 });
            }}
          >
            <RefreshCw data-icon="inline-start" />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoadingList && notifications.length === 0 ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : null}

        {!isLoadingList && error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!isLoadingList && !error && notifications.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
            Nenhuma notificação para você até o momento.
          </div>
        ) : null}

        {notifications.map((notification) => {
          const leadCode = getLeadCode(notification);
          const scheduleShareUrl = getScheduleShareUrl(notification);
          const leadHref = buildNotificationPath({
            supabaseId,
            type: notification.type,
            metadata: notification.metadata,
          });
          const canOpenLead = hasLeadLink(notification) && !!leadCode && !leadHref.startsWith("http");
          const isProposalPending = isProposalPendingNotification(notification);
          const isTransferActivated = isTransferActivatedNotification(notification);
          const sdrName = getSdrName(notification);
          const googleBadge = getGoogleNotificationBadge(notification);
          const actorName =
            notification.actor?.fullName ||
            notification.actor?.email ||
            "Sistema";

          return (
            <div
              key={notification.id}
              className={cn(
                "rounded-lg border border-border/60 bg-card/60 p-4 transition",
                isProposalPending && "border-amber-300/70 bg-amber-50/70 dark:border-amber-500/50 dark:bg-amber-500/10",
                notification.isRead ? "opacity-60" : "opacity-100"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  {isProposalPending ? (
                    <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
                      <CircleAlert className="h-3.5 w-3.5" />
                      Urgente
                    </div>
                  ) : null}
                  {googleBadge ? (
                    <div className={cn("mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", googleBadge.className)}>
                      <Mail className="h-3.5 w-3.5" />
                      {googleBadge.label}
                    </div>
                  ) : null}
                  <p className="text-sm font-medium">{notification.message}</p>
                  {isTransferActivated && sdrName ? (
                    <p className="text-xs text-muted-foreground">SDR: {sdrName}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {actorName} • {formatCreatedAt(notification.createdAt, tz)}
                  </p>
                </div>
                {canOpenLead ? (
                  <div className="flex flex-col items-end gap-2">
                    <Link
                      href={leadHref}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Abrir lead
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                    {scheduleShareUrl ? (
                      <a
                        href={scheduleShareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Abrir agendamento
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                ) : scheduleShareUrl ? (
                  <a
                    href={scheduleShareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Abrir agendamento
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </CardContent>
      <NotificationsSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        supabaseId={supabaseId}
      />
    </Card>
  );
}
