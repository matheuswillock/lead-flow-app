"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTeamContext } from "@/app/context/TeamContext";
import { notificationsService } from "../services/NotificationsService";
import type { NotificationItem, NotificationsContextState } from "../types/notification.types";

type NotificationsProviderProps = {
  children: React.ReactNode;
  supabaseId: string;
};

const NotificationsContext = createContext<NotificationsContextState | undefined>(undefined);

export function NotificationsProvider({ children, supabaseId }: NotificationsProviderProps) {
  const { activeTeamId } = useTeamContext();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingUnread, setIsLoadingUnread] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshUnreadCount = useCallback(async () => {
    if (!supabaseId || !activeTeamId) {
      setUnreadCount(0);
      return;
    }

    try {
      setIsLoadingUnread(true);
      const count = await notificationsService.getUnreadCount({
        supabaseId,
        teamId: activeTeamId,
      });
      setUnreadCount(count);
    } catch (err) {
      console.error("[NotificationsContext] Erro ao buscar contador:", err);
    } finally {
      setIsLoadingUnread(false);
    }
  }, [supabaseId, activeTeamId]);

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

        setNotifications(result.notifications ?? []);
        setTotal(result.total ?? 0);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao carregar notificações";
        setError(message);
      } finally {
        setIsLoadingList(false);
      }
    },
    [supabaseId, activeTeamId]
  );

  const markAllAsRead = useCallback(async () => {
    if (!supabaseId || !activeTeamId) return;

    try {
      await notificationsService.markAllAsRead({
        supabaseId,
        teamId: activeTeamId,
      });

      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          isRead: true,
          readAt: notification.readAt || new Date().toISOString(),
        }))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao marcar notificações como vistas";
      setError(message);
    }
  }, [supabaseId, activeTeamId]);

  useEffect(() => {
    setNotifications([]);
    setUnreadCount(0);
    setTotal(0);
    setError(null);
    void refreshUnreadCount();
  }, [activeTeamId, refreshUnreadCount]);

  useEffect(() => {
    if (!supabaseId || !activeTeamId) return;
    const intervalId = setInterval(() => {
      void refreshUnreadCount();
    }, 30000);

    return () => clearInterval(intervalId);
  }, [supabaseId, activeTeamId, refreshUnreadCount]);

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
    ]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotificationsContext must be used within NotificationsProvider");
  }
  return context;
}
