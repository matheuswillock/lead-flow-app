"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useParams } from "next/navigation";
import { Bell, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "../types/notification.types";
import { useNotifications } from "../context/NotificationsHook";

function formatCreatedAt(value: string) {
  try {
    return new Date(value).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function getLeadCode(notification: NotificationItem) {
  const metadata = notification.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  return typeof metadata.leadCode === "string" ? metadata.leadCode : null;
}

function hasLeadLink(notification: NotificationItem) {
  return (
    notification.type === "ACTIVITY_MENTION" ||
    notification.type === "LEAD_SCHEDULE_CREATED"
  );
}

export function NotificationsContainer() {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const {
    notifications,
    total,
    isLoadingList,
    error,
    loadNotifications,
    refreshUnreadCount,
    markAllAsRead,
  } = useNotifications();

  useEffect(() => {
    const load = async () => {
      await loadNotifications({ limit: 100, offset: 0 });
      await markAllAsRead();
      await refreshUnreadCount();
    };

    void load();
  }, [loadNotifications, markAllAsRead, refreshUnreadCount]);

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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void loadNotifications({ limit: 100, offset: 0 });
            void refreshUnreadCount();
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
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
          const canOpenLead = hasLeadLink(notification) && !!leadCode;
          const actorName =
            notification.actor?.fullName ||
            notification.actor?.email ||
            "Sistema";

          return (
            <div
              key={notification.id}
              className={cn(
                "rounded-lg border border-border/60 bg-card/60 p-4 transition",
                notification.isRead ? "opacity-60" : "opacity-100"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{notification.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {actorName} • {formatCreatedAt(notification.createdAt)}
                  </p>
                </div>
                {canOpenLead ? (
                  <Link
                    href={`/${supabaseId}/board?leadCode=${encodeURIComponent(leadCode as string)}`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Abrir lead
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
