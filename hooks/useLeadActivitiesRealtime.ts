import { useEffect, useRef } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export type LeadActivityRealtimeRow = {
  id: string;
  leadId: string;
  type: string;
  body: string | null;
  payload: unknown;
  createdBy: string | null;
  createdAt: string;
};

export type LeadActivityReactionRealtimeRow = {
  id: string;
  activityId: string;
  profileId: string;
  emoji: string;
  emojiUnified: string;
  createdAt: string;
};

type UseLeadActivitiesRealtimeParams = {
  enabled: boolean;
  leadId: string | null;
  activeActivityIds: string[];
  onActivityInserted: (activity: LeadActivityRealtimeRow) => void;
  onReactionInserted: (reaction: LeadActivityReactionRealtimeRow) => void;
  onReactionDeleted: (reaction: LeadActivityReactionRealtimeRow) => void;
  onSyncRequested?: () => void;
};

export function useLeadActivitiesRealtime({
  enabled,
  leadId,
  activeActivityIds,
  onActivityInserted,
  onReactionInserted,
  onReactionDeleted,
  onSyncRequested,
}: UseLeadActivitiesRealtimeParams) {
  const activeActivityIdsRef = useRef<Set<string>>(new Set(activeActivityIds));
  const onActivityInsertedRef = useRef(onActivityInserted);
  const onReactionInsertedRef = useRef(onReactionInserted);
  const onReactionDeletedRef = useRef(onReactionDeleted);
  const onSyncRequestedRef = useRef(onSyncRequested);

  useEffect(() => {
    activeActivityIdsRef.current = new Set(activeActivityIds);
  }, [activeActivityIds]);

  useEffect(() => {
    onActivityInsertedRef.current = onActivityInserted;
  }, [onActivityInserted]);

  useEffect(() => {
    onReactionInsertedRef.current = onReactionInserted;
  }, [onReactionInserted]);

  useEffect(() => {
    onReactionDeletedRef.current = onReactionDeleted;
  }, [onReactionDeleted]);

  useEffect(() => {
    onSyncRequestedRef.current = onSyncRequested;
  }, [onSyncRequested]);

  useEffect(() => {
    if (!enabled || !leadId) return;

    const supabase = createSupabaseBrowser();
    if (!supabase) return;

    let cancelled = false;
    let activitiesChannel: ReturnType<typeof supabase.channel> | null = null;
    let reactionsChannel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtime = async () => {
      try {
        let accessToken: string | null = null;

        try {
          const sessionResult = await supabase.auth.getSession();
          accessToken = sessionResult.data.session?.access_token ?? null;
        } catch (sessionError) {
          console.error("[LeadActivitiesRealtime][getSession] Erro ao obter sessão:", sessionError);
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
            console.error("[LeadActivitiesRealtime][tokenFallback] Erro ao obter token:", tokenError);
          }
        }

        if (accessToken) {
          await supabase.realtime.setAuth(accessToken);
        } else {
          console.error("[LeadActivitiesRealtime] Token ausente; subscription pode ficar sem RLS.");
        }

        if (cancelled) return;

        const channelSuffix = `${leadId}-${Date.now()}`;
        activitiesChannel = supabase
          .channel(`lead-activities-${channelSuffix}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "lead_activities",
            },
            (payload) => {
              const row = payload.new as Partial<LeadActivityRealtimeRow>;
              if (!row || typeof row.id !== "string" || typeof row.leadId !== "string") {
                return;
              }
              if (row.leadId !== leadId) {
                return;
              }

              onActivityInsertedRef.current({
                id: row.id,
                leadId: row.leadId,
                type: typeof row.type === "string" ? row.type : "note",
                body: typeof row.body === "string" || row.body === null ? row.body : null,
                payload: row.payload ?? null,
                createdBy: typeof row.createdBy === "string" || row.createdBy === null ? row.createdBy : null,
                createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
              });

              onSyncRequestedRef.current?.();
            }
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              onSyncRequestedRef.current?.();
            }
            if (status === "CHANNEL_ERROR") {
              console.error("[LeadActivitiesRealtime][activities] CHANNEL_ERROR");
            }
            if (status === "TIMED_OUT") {
              console.error("[LeadActivitiesRealtime][activities] TIMED_OUT");
            }
          });

        reactionsChannel = supabase
          .channel(`lead-activity-reactions-${channelSuffix}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "lead_activity_reactions",
            },
            (payload) => {
              const row = payload.new as Partial<LeadActivityReactionRealtimeRow>;
              if (!row || typeof row.activityId !== "string" || typeof row.id !== "string") {
                return;
              }
              if (!activeActivityIdsRef.current.has(row.activityId)) {
                return;
              }

              onReactionInsertedRef.current({
                id: row.id,
                activityId: row.activityId,
                profileId: typeof row.profileId === "string" ? row.profileId : "",
                emoji: typeof row.emoji === "string" ? row.emoji : "",
                emojiUnified: typeof row.emojiUnified === "string" ? row.emojiUnified : "",
                createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
              });

              onSyncRequestedRef.current?.();
            }
          )
          .on(
            "postgres_changes",
            {
              event: "DELETE",
              schema: "public",
              table: "lead_activity_reactions",
            },
            (payload) => {
              const row = payload.old as Partial<LeadActivityReactionRealtimeRow>;
              if (!row || typeof row.activityId !== "string" || typeof row.id !== "string") {
                return;
              }
              if (!activeActivityIdsRef.current.has(row.activityId)) {
                return;
              }

              onReactionDeletedRef.current({
                id: row.id,
                activityId: row.activityId,
                profileId: typeof row.profileId === "string" ? row.profileId : "",
                emoji: typeof row.emoji === "string" ? row.emoji : "",
                emojiUnified: typeof row.emojiUnified === "string" ? row.emojiUnified : "",
                createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
              });

              onSyncRequestedRef.current?.();
            }
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              onSyncRequestedRef.current?.();
            }
            if (status === "CHANNEL_ERROR") {
              console.error("[LeadActivitiesRealtime][reactions] CHANNEL_ERROR");
            }
            if (status === "TIMED_OUT") {
              console.error("[LeadActivitiesRealtime][reactions] TIMED_OUT");
            }
          });
      } catch (error) {
        console.error("[LeadActivitiesRealtime] Falha ao inicializar realtime:", error);
      }
    };

    void setupRealtime();

    return () => {
      cancelled = true;
      if (activitiesChannel) {
        void supabase.removeChannel(activitiesChannel);
      }
      if (reactionsChannel) {
        void supabase.removeChannel(reactionsChannel);
      }
    };
  }, [enabled, leadId]);
}
