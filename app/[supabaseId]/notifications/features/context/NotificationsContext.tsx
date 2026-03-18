"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTeamContext } from "@/app/context/TeamContext";
import { useUser } from "@/app/context/UserContext";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { notificationsService } from "../services/NotificationsService";
import type {
  MarkAllAsReadOptions,
  NotificationItem,
  NotificationsContextState,
} from "../types/notification.types";

type NotificationsProviderProps = {
  children: React.ReactNode;
  supabaseId: string;
};

type NotificationRealtimeRow = {
  id: string;
  recipientProfileId: string;
  recipient_profile_id?: string;
  actorProfileId: string | null;
  actor_profile_id?: string | null;
  teamId: string;
  team_id?: string;
  type: NotificationItem["type"];
  message: string;
  metadata: NotificationItem["metadata"];
  isRead: boolean;
  is_read?: boolean;
  readAt: string | null;
  read_at?: string | null;
  createdAt: string;
  created_at?: string;
  updatedAt: string;
  updated_at?: string;
};

const NotificationsContext = createContext<NotificationsContextState | undefined>(undefined);

function normalizeRealtimeRow(row: Partial<NotificationRealtimeRow>): NotificationRealtimeRow {
  return {
    id: String(row.id ?? ""),
    recipientProfileId: String(row.recipientProfileId ?? row.recipient_profile_id ?? ""),
    actorProfileId: (row.actorProfileId ?? row.actor_profile_id ?? null) as string | null,
    teamId: String(row.teamId ?? row.team_id ?? ""),
    type: row.type as NotificationItem["type"],
    message: String(row.message ?? ""),
    metadata: (row.metadata ?? null) as NotificationItem["metadata"],
    isRead: Boolean(row.isRead ?? row.is_read ?? false),
    readAt: (row.readAt ?? row.read_at ?? null) as string | null,
    createdAt: String(row.createdAt ?? row.created_at ?? ""),
    updatedAt: String(row.updatedAt ?? row.updated_at ?? ""),
  };
}

export function NotificationsProvider({ children, supabaseId }: NotificationsProviderProps) {
  const { activeTeamId } = useTeamContext();
  const { user } = useUser();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingUnread, setIsLoadingUnread] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const listWasLoadedRef = useRef(false);
  const loadNotificationsRef = useRef<() => Promise<void>>(async () => {});
  const notificationsRef = useRef<NotificationItem[]>([]);

  const mapRealtimeRowToNotification = useCallback((row: NotificationRealtimeRow): NotificationItem => {
    return {
      id: row.id,
      recipientProfileId: row.recipientProfileId,
      actorProfileId: row.actorProfileId,
      teamId: row.teamId,
      type: row.type,
      message: row.message,
      metadata: row.metadata ?? null,
      isRead: row.isRead,
      readAt: row.readAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      actor: null,
    };
  }, []);

  const loadNotifications = useCallback(
    async (params?: { limit?: number; offset?: number }) => {
      if (!supabaseId || !activeTeamId) {
        setNotifications([]);
        setTotal(0);
        return;
      }

      try {
        setIsLoadingList(true);
        setError(null);
        const result = await notificationsService.list({
          supabaseId,
          teamId: activeTeamId,
          limit: params?.limit ?? 100,
          offset: params?.offset ?? 0,
        });

        const list = result.notifications ?? [];
        setNotifications(list);
        setTotal(result.total ?? 0);
        setUnreadCount(list.reduce((acc, item) => (item.isRead ? acc : acc + 1), 0));
        listWasLoadedRef.current = true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao carregar notificações";
        setError(message);
      } finally {
        setIsLoadingList(false);
      }
    },
    [supabaseId, activeTeamId],
  );

  const refreshUnreadCount = useCallback(async () => {
    if (!supabaseId || !activeTeamId) {
      setUnreadCount(0);
      return;
    }

    try {
      setIsLoadingUnread(true);

      if (!listWasLoadedRef.current) {
        await loadNotifications({ limit: 100, offset: 0 });
        return;
      }

      setUnreadCount(notificationsRef.current.reduce((acc, item) => (item.isRead ? acc : acc + 1), 0));
    } catch (err) {
      console.error("[NotificationsContext] Erro ao buscar contador:", err);
    } finally {
      setIsLoadingUnread(false);
    }
  }, [supabaseId, activeTeamId, loadNotifications]);

  const markAllAsRead = useCallback(
    async (options?: MarkAllAsReadOptions) => {
      if (!supabaseId || !activeTeamId) return;

      try {
        await notificationsService.markAllAsRead(
          {
            supabaseId,
            teamId: activeTeamId,
          },
          options,
        );

        setUnreadCount(0);
        setNotifications((prev) =>
          prev.map((notification) => ({
            ...notification,
            isRead: true,
            readAt: notification.readAt || new Date().toISOString(),
          })),
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao marcar notificações como vistas";
        setError(message);
      }
    },
    [supabaseId, activeTeamId],
  );

  useEffect(() => {
    loadNotificationsRef.current = () => loadNotifications({ limit: 100, offset: 0 });
  }, [loadNotifications]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    setNotifications([]);
    setUnreadCount(0);
    setTotal(0);
    setError(null);
    listWasLoadedRef.current = false;
    void loadNotifications({ limit: 100, offset: 0 });
  }, [activeTeamId, loadNotifications]);

  useEffect(() => {
    if (!supabaseId || !activeTeamId || !user?.id) return;

    const supabase = createSupabaseBrowser();
    if (!supabase) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const teardownChannel = () => {
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    };

    const scheduleReconnect = (reason: "CHANNEL_ERROR" | "TIMED_OUT" | "MISSING_TOKEN") => {
      if (cancelled || reconnectTimerRef.current !== null) return;

      reconnectAttemptRef.current += 1;
      const delayMs = Math.min(1000 * 2 ** (reconnectAttemptRef.current - 1), 10000);
      console.info(
        `[NotificationsRealtime] Reagendando conexao (${reason}) em ${delayMs}ms (tentativa ${reconnectAttemptRef.current})`,
      );

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        if (!cancelled) {
          void setupRealtime();
        }
      }, delayMs);
    };

    const syncFromServer = async () => {
      await loadNotificationsRef.current();
    };

    const setupRealtime = async () => {
      try {
        clearReconnectTimer();
        teardownChannel();

        let accessToken: string | null = null;

        try {
          const sessionResult = await supabase.auth.getSession();
          accessToken = sessionResult.data.session?.access_token ?? null;
        } catch (sessionError) {
          console.error("[NotificationsRealtime][getSession] Erro ao obter sessão:", sessionError);
        }

        if (!accessToken) {
          try {
            const response = await fetch("/api/v1/realtime/auth-token", {
              method: "GET",
              cache: "no-store",
            });

            if (response.ok) {
              const result = await response.json();
              accessToken = result?.result?.accessToken ?? null;
            }
          } catch (tokenError) {
            console.error("[NotificationsRealtime][tokenFallback] Erro ao obter token:", tokenError);
          }
        }

        if (!accessToken) {
          console.info("[NotificationsRealtime] Token ausente; aguardando para tentar reconnect.");
          scheduleReconnect("MISSING_TOKEN");
          return;
        }

        await supabase.realtime.setAuth(accessToken);

        if (cancelled) return;

        const channelSuffix = `${user.id}-${activeTeamId}-${Date.now()}`;
        channel = supabase
          .channel(`notifications-${channelSuffix}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
            },
            (payload) => {
              const row = normalizeRealtimeRow(payload.new as Partial<NotificationRealtimeRow>);
              if (!row || !row.id || row.teamId !== activeTeamId || row.recipientProfileId !== user.id) {
                return;
              }

              setUnreadCount((prev) => prev + (row.isRead ? 0 : 1));
              setTotal((prev) => prev + 1);
              void syncFromServer();

              if (!listWasLoadedRef.current) {
                return;
              }

              const mapped = mapRealtimeRowToNotification(row);
              setNotifications((prev) => {
                if (prev.some((item) => item.id === mapped.id)) {
                  return prev;
                }
                return [mapped, ...prev];
              });
            },
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "notifications",
            },
            (payload) => {
              const oldRow = normalizeRealtimeRow(payload.old as Partial<NotificationRealtimeRow>);
              const newRow = normalizeRealtimeRow(payload.new as Partial<NotificationRealtimeRow>);

              if (!newRow || !newRow.id || newRow.teamId !== activeTeamId || newRow.recipientProfileId !== user.id) {
                return;
              }

              if (oldRow.isRead === false && newRow.isRead === true) {
                setUnreadCount((prev) => Math.max(0, prev - 1));
              } else if (oldRow.isRead === true && newRow.isRead === false) {
                setUnreadCount((prev) => prev + 1);
              }
              void syncFromServer();

              if (!listWasLoadedRef.current) {
                return;
              }

              setNotifications((prev) =>
                prev.map((item) =>
                  item.id === newRow.id
                    ? {
                        ...item,
                        isRead: newRow.isRead,
                        readAt: newRow.readAt,
                        updatedAt: newRow.updatedAt,
                        message: newRow.message,
                        metadata: newRow.metadata ?? null,
                      }
                    : item,
                ),
              );
            },
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              reconnectAttemptRef.current = 0;
              void syncFromServer();
            }
            if (status === "CHANNEL_ERROR") {
              console.info("[NotificationsRealtime] CHANNEL_ERROR");
              void syncFromServer();
              scheduleReconnect("CHANNEL_ERROR");
            }
            if (status === "TIMED_OUT") {
              console.info("[NotificationsRealtime] TIMED_OUT");
              void syncFromServer();
              scheduleReconnect("TIMED_OUT");
            }
          });
      } catch (error) {
        console.error("[NotificationsRealtime] Falha ao inicializar realtime:", error);
        scheduleReconnect("CHANNEL_ERROR");
      }
    };

    void setupRealtime();

    return () => {
      cancelled = true;
      clearReconnectTimer();
      teardownChannel();
    };
  }, [supabaseId, activeTeamId, user?.id, mapRealtimeRowToNotification]);

  useEffect(() => {
    if (!supabaseId || !activeTeamId || !user?.id) return;

    const syncOnFocus = () => {
      void loadNotificationsRef.current();
    };

    const syncOnVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadNotificationsRef.current();
      }
    };

    window.addEventListener("focus", syncOnFocus);
    document.addEventListener("visibilitychange", syncOnVisibilityChange);

    return () => {
      window.removeEventListener("focus", syncOnFocus);
      document.removeEventListener("visibilitychange", syncOnVisibilityChange);
    };
  }, [supabaseId, activeTeamId, user?.id]);

  const value = useMemo<NotificationsContextState>(
    () => ({
      notifications,
      unreadCount,
      total,
      isLoadingList,
      isLoadingUnread,
      error,
      loadNotifications,
      refreshUnreadCount,
      markAllAsRead,
    }),
    [
      notifications,
      unreadCount,
      total,
      isLoadingList,
      isLoadingUnread,
      error,
      loadNotifications,
      refreshUnreadCount,
      markAllAsRead,
    ],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotificationsContext() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotificationsContext must be used within NotificationsProvider");
  }
  return context;
}
