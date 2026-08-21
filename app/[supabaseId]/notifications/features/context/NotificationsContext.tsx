"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTeamContext } from "@/app/context/TeamContext";
import { useUser } from "@/app/context/UserContext";
import { isUnauthorizedApiError } from "@/lib/http/api-request-error";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { shouldSkipRealtimeSubscribe } from "@/lib/supabase/realtime-guard";
import { notificationsService } from "../services/NotificationsService";
import { inAppNotificationBridge } from "@/lib/notifications/in-app-notification-bridge";
import type {
  MarkAllAsReadOptions,
  NotificationItem,
  NotificationsContextState,
} from "../types/notification.types";
import { API_CLIENT_BASE } from "@/lib/route-map";
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message";

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

// TTL do cache local da lista — evita recargas repetidas em focus/visibility.
const LIST_TTL_MS = 30_000;
// Debounce dos re-syncs disparados pelo realtime (o payload já aplica o delta).
const REALTIME_SYNC_DEBOUNCE_MS = 5_000;
// Após 401 (sessão ausente no proxy), não martelar unread-count/list.
const AUTH_FAIL_COOLDOWN_MS = 60_000;
const UNREAD_TTL_MS = 15_000;

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
  const listInFlightKeyRef = useRef<string | null>(null);
  const activeListKeyRef = useRef<string>("");
  const lastListKeyRef = useRef<string>("");
  const lastListAtRef = useRef(0);
  const unreadCountRef = useRef(0);
  const syncDebounceTimerRef = useRef<number | null>(null);
  const focusCheckInFlightRef = useRef(false);
  const authBlockedUntilRef = useRef(0);
  const unreadInFlightKeyRef = useRef<string | null>(null);
  const lastUnreadKeyRef = useRef("");
  const lastUnreadAtRef = useRef(0);

  const isAuthBlocked = useCallback(() => Date.now() < authBlockedUntilRef.current, []);

  const markAuthFailure = useCallback(() => {
    authBlockedUntilRef.current = Date.now() + AUTH_FAIL_COOLDOWN_MS;
  }, []);

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
    async (params?: { limit?: number; offset?: number; force?: boolean }) => {
      // Espera user do contexto — sem sessão o proxy não injeta x-supabase-user-id (401).
      if (!supabaseId || !activeTeamId || !user?.id) {
        setNotifications([]);
        setTotal(0);
        return;
      }

      if (isAuthBlocked()) return;

      // Dedupe: chave estável + guard de in-flight + TTL de última carga.
      const requestKey = `${supabaseId}:${params?.limit ?? 100}:${params?.offset ?? 0}`;
      const isSameRequest = lastListKeyRef.current === requestKey;
      const isFresh = Date.now() - lastListAtRef.current < LIST_TTL_MS;
      if (!params?.force && isSameRequest && isFresh) return;
      if (listInFlightKeyRef.current === requestKey) return;

      const capturedKey = requestKey;
      listInFlightKeyRef.current = capturedKey;
      activeListKeyRef.current = capturedKey;

      try {
        setIsLoadingList(true);
        setError(null);
        const [result, serverUnread] = await Promise.all([
          notificationsService.list({
            supabaseId,
            teamId: activeTeamId,
            limit: params?.limit ?? 100,
            offset: params?.offset ?? 0,
          }),
          notificationsService.unreadCount({
            supabaseId,
            teamId: activeTeamId,
          }),
        ]);

        if (activeListKeyRef.current !== capturedKey) return;

        const list = result.notifications ?? [];
        setNotifications(list);
        setTotal(result.total ?? 0);
        setUnreadCount(serverUnread);
        listWasLoadedRef.current = true;
        lastListKeyRef.current = capturedKey;
        lastListAtRef.current = Date.now();
        lastUnreadKeyRef.current = `${supabaseId}:${activeTeamId}`;
        lastUnreadAtRef.current = Date.now();
        authBlockedUntilRef.current = 0;
      } catch (err) {
        if (activeListKeyRef.current !== capturedKey) return;
        if (isUnauthorizedApiError(err)) {
          markAuthFailure();
          return;
        }
        const message = toUserToastMessage(err);
        setError(message);
      } finally {
        if (listInFlightKeyRef.current === capturedKey) {
          listInFlightKeyRef.current = null;
        }
        if (activeListKeyRef.current === capturedKey) {
          setIsLoadingList(false);
        }
      }
    },
    [supabaseId, activeTeamId, user?.id, isAuthBlocked, markAuthFailure],
  );

  const fetchUnreadCount = useCallback(async (force = false): Promise<number | null> => {
    if (!supabaseId || !activeTeamId || !user?.id) return null;
    if (isAuthBlocked()) return null;

    const requestKey = `${supabaseId}:${activeTeamId}`;
    const isSameRequest = lastUnreadKeyRef.current === requestKey;
    const isFresh = Date.now() - lastUnreadAtRef.current < UNREAD_TTL_MS;
    if (!force && isSameRequest && isFresh) {
      return unreadCountRef.current;
    }
    if (unreadInFlightKeyRef.current === requestKey) return null;

    unreadInFlightKeyRef.current = requestKey;
    try {
      const serverUnread = await notificationsService.unreadCount({
        supabaseId,
        teamId: activeTeamId,
      });
      lastUnreadKeyRef.current = requestKey;
      lastUnreadAtRef.current = Date.now();
      authBlockedUntilRef.current = 0;
      return serverUnread;
    } catch (err) {
      if (isUnauthorizedApiError(err)) {
        markAuthFailure();
        return null;
      }
      throw err;
    } finally {
      if (unreadInFlightKeyRef.current === requestKey) {
        unreadInFlightKeyRef.current = null;
      }
    }
  }, [supabaseId, activeTeamId, user?.id, isAuthBlocked, markAuthFailure]);

  const refreshUnreadCount = useCallback(async () => {
    if (!supabaseId || !activeTeamId || !user?.id) {
      setUnreadCount(0);
      return;
    }

    if (isAuthBlocked()) return;

    try {
      setIsLoadingUnread(true);

      if (!listWasLoadedRef.current) {
        await loadNotifications({ limit: 100, offset: 0 });
        return;
      }

      setUnreadCount(notificationsRef.current.reduce((acc, item) => (item.isRead ? acc : acc + 1), 0));
    } catch (err) {
      if (isUnauthorizedApiError(err)) {
        markAuthFailure();
        return;
      }
      console.error("[NotificationsContext] Erro ao buscar contador:", err);
    } finally {
      setIsLoadingUnread(false);
    }
  }, [supabaseId, activeTeamId, user?.id, loadNotifications, isAuthBlocked, markAuthFailure]);

  const markAllAsRead = useCallback(
    async (options?: MarkAllAsReadOptions) => {
      if (!supabaseId || !activeTeamId || !user?.id) return;
      if (isAuthBlocked()) return;

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
        authBlockedUntilRef.current = 0;
      } catch (err) {
        if (isUnauthorizedApiError(err)) {
          markAuthFailure();
          return;
        }
        const message =
          toUserToastMessage(err);
        setError(message);
      }
    },
    [supabaseId, activeTeamId, user?.id, isAuthBlocked, markAuthFailure],
  );

  useEffect(() => {
    // Syncs do realtime forçam a recarga (o dado mudou no servidor).
    loadNotificationsRef.current = () => loadNotifications({ limit: 100, offset: 0, force: true });
  }, [loadNotifications]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    unreadCountRef.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    listWasLoadedRef.current = false;
    lastListKeyRef.current = "";
    lastUnreadKeyRef.current = "";
    lastUnreadAtRef.current = 0;
    authBlockedUntilRef.current = 0;
    setNotifications([]);
    setUnreadCount(0);
    setTotal(0);
    setError(null);
  }, [supabaseId]);

  useEffect(() => {
    if (!supabaseId || !activeTeamId || !user?.id || listWasLoadedRef.current) return;
    if (isAuthBlocked()) return;
    void loadNotifications({ limit: 100, offset: 0 });
  }, [supabaseId, activeTeamId, user?.id, loadNotifications, isAuthBlocked]);

  useEffect(() => {
    if (shouldSkipRealtimeSubscribe()) return;
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

    // Debounce trailing: o payload do realtime já aplica o delta localmente;
    // o re-sync serve só para reconciliar (ex.: dados do actor) sem gerar uma
    // requisição por evento. Em 401, não agenda re-sync (evita storm).
    const syncFromServer = () => {
      if (isAuthBlocked()) return;
      if (syncDebounceTimerRef.current !== null) return;
      syncDebounceTimerRef.current = window.setTimeout(() => {
        syncDebounceTimerRef.current = null;
        if (!cancelled && !isAuthBlocked()) {
          void loadNotificationsRef.current();
        }
      }, REALTIME_SYNC_DEBOUNCE_MS);
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
            const response = await fetch(`${API_CLIENT_BASE}/realtime/auth-token`, {
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

        const channelSuffix = `${user.id}-${Date.now()}`;
        channel = supabase
          .channel(`notifications-${channelSuffix}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "corretor_studio_notifications",
              filter: `recipient_profile_id=eq.${user.id}`,
            },
            (payload) => {
              const row = normalizeRealtimeRow(payload.new as Partial<NotificationRealtimeRow>);
              if (!row || !row.id || row.recipientProfileId !== user.id) {
                return;
              }

              setUnreadCount((prev) => prev + (row.isRead ? 0 : 1));
              setTotal((prev) => prev + 1);
              syncFromServer();

              const mapped = mapRealtimeRowToNotification(row);
              if (!row.isRead && typeof document !== "undefined" && document.visibilityState === "visible") {
                inAppNotificationBridge.emit(mapped);
              }

              if (!listWasLoadedRef.current) {
                return;
              }

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
              table: "corretor_studio_notifications",
              filter: `recipient_profile_id=eq.${user.id}`,
            },
            (payload) => {
              const oldRow = normalizeRealtimeRow(payload.old as Partial<NotificationRealtimeRow>);
              const newRow = normalizeRealtimeRow(payload.new as Partial<NotificationRealtimeRow>);

              if (!newRow || !newRow.id || newRow.recipientProfileId !== user.id) {
                return;
              }

              if (oldRow.isRead === false && newRow.isRead === true) {
                setUnreadCount((prev) => Math.max(0, prev - 1));
              } else if (oldRow.isRead === true && newRow.isRead === false) {
                setUnreadCount((prev) => prev + 1);
              }
              syncFromServer();

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
              syncFromServer();
            }
            if (status === "CHANNEL_ERROR") {
              console.info("[NotificationsRealtime] CHANNEL_ERROR");
              syncFromServer();
              scheduleReconnect("CHANNEL_ERROR");
            }
            if (status === "TIMED_OUT") {
              console.info("[NotificationsRealtime] TIMED_OUT");
              syncFromServer();
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
      if (syncDebounceTimerRef.current !== null) {
        window.clearTimeout(syncDebounceTimerRef.current);
        syncDebounceTimerRef.current = null;
      }
    };
  }, [supabaseId, user?.id, mapRealtimeRowToNotification, isAuthBlocked]);

  useEffect(() => {
    if (!supabaseId || !activeTeamId || !user?.id) return;

    // No focus/visibility consulta só o unread-count (query leve) e recarrega
    // a lista apenas se o contador local divergir do servidor.
    const checkUnreadAndMaybeReload = async () => {
      if (document.visibilityState !== "visible") return;
      if (focusCheckInFlightRef.current) return;
      if (isAuthBlocked()) return;
      focusCheckInFlightRef.current = true;

      try {
        const serverUnread = await fetchUnreadCount();
        if (serverUnread === null) return;

        if (serverUnread !== unreadCountRef.current || !listWasLoadedRef.current) {
          await loadNotificationsRef.current();
        } else {
          setUnreadCount(serverUnread);
        }
      } catch (err) {
        if (isUnauthorizedApiError(err)) {
          markAuthFailure();
          return;
        }
        console.error("[NotificationsContext] Erro ao verificar unread-count:", err);
      } finally {
        focusCheckInFlightRef.current = false;
      }
    };

    const syncOnFocusOrVisibility = () => {
      void checkUnreadAndMaybeReload();
    };

    window.addEventListener("focus", syncOnFocusOrVisibility);
    document.addEventListener("visibilitychange", syncOnFocusOrVisibility);

    return () => {
      window.removeEventListener("focus", syncOnFocusOrVisibility);
      document.removeEventListener("visibilitychange", syncOnFocusOrVisibility);
    };
  }, [supabaseId, activeTeamId, user?.id, fetchUnreadCount, isAuthBlocked, markAuthFailure]);

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
