import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { fetchTeamMembersPayload } from "@/lib/team/teamMembersClientCache";

type TeamMemberFunction = "SDR" | "CLOSER";
type PresenceAvailability = "online" | "away";
type PresenceStatus = PresenceAvailability | "offline";

type PresenceStateEntry = {
  profileId?: string;
  masterId?: string;
  lastActivityAt?: string;
  availability?: string;
  joinedAt?: string;
};

export type TeamPresenceMember = {
  profileId: string;
  name: string;
  email: string;
  profileIconUrl: string | null;
  functions: TeamMemberFunction[];
  presenceStatus: PresenceStatus;
};

type UseTeamPresenceParams = {
  activeTeamId: string | null;
  masterId?: string | null;
  supabaseId?: string;
  currentProfileId?: string | null;
  enabled?: boolean;
};

type PresenceRecord = {
  profileId: string;
  availability: PresenceAvailability;
  lastActivityAt: number | null;
};

const LOG_PREFIX = "[useTeamPresence]";
const INACTIVITY_THRESHOLD_MS = 10 * 60 * 1000;
const ACTIVITY_THROTTLE_MS = 5_000;
const STATUS_RECHECK_INTERVAL_MS = 30_000;
const ACTIVITY_EVENT_NAMES = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

function normalizeFunctions(functions: string[] | null | undefined): TeamMemberFunction[] {
  if (!Array.isArray(functions)) {
    return [];
  }

  return functions.filter(
    (value): value is TeamMemberFunction => value === "SDR" || value === "CLOSER"
  );
}

function normalizeAvailability(value: string | undefined): PresenceAvailability {
  return value === "away" ? "away" : "online";
}

function toTimestamp(value: string | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function normalizePresenceState(
  state: Record<string, PresenceStateEntry[]>
): Map<string, PresenceRecord[]> {
  const mapped = new Map<string, PresenceRecord[]>();

  for (const entries of Object.values(state)) {
    for (const entry of entries) {
      const profileId = typeof entry?.profileId === "string" ? entry.profileId.trim() : "";
      if (!profileId) continue;

      const nextRecord: PresenceRecord = {
        profileId,
        availability: normalizeAvailability(entry.availability),
        lastActivityAt: toTimestamp(entry.lastActivityAt),
      };

      const list = mapped.get(profileId) ?? [];
      list.push(nextRecord);
      mapped.set(profileId, list);
    }
  }

  return mapped;
}

function resolvePresenceStatus(records: PresenceRecord[], now: number): PresenceStatus {
  if (records.length === 0) {
    return "offline";
  }

  const hasOnlineRecord = records.some((record) => {
    if (record.availability !== "online") return false;
    if (record.lastActivityAt === null) return true;
    return now - record.lastActivityAt < INACTIVITY_THRESHOLD_MS;
  });

  if (hasOnlineRecord) {
    return "online";
  }

  return "away";
}

export function useTeamPresence({
  activeTeamId,
  masterId,
  supabaseId,
  currentProfileId,
  enabled = true,
}: UseTeamPresenceParams) {
  const [members, setMembers] = useState<Omit<TeamPresenceMember, "presenceStatus">[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [presenceByProfile, setPresenceByProfile] = useState<Map<string, PresenceRecord[]>>(new Map());
  const [statusTick, setStatusTick] = useState(0);
  const channelRef = useRef<ReturnType<NonNullable<ReturnType<typeof createSupabaseBrowser>>["channel"]> | null>(null);
  const lastActivityAtRef = useRef<number>(Date.now());
  const availabilityRef = useRef<PresenceAvailability>("online");
  const lastTrackAtRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !activeTeamId || !supabaseId) {
      setMembers([]);
      setIsLoadingMembers(false);
      return;
    }

    let isMounted = true;

    const fetchMembers = async () => {
      setIsLoadingMembers(true);

      try {
        const payload = await fetchTeamMembersPayload(supabaseId, activeTeamId);

        const mappedMembers = payload.members.map((member) => ({
          profileId: member.id,
          name: member.name || member.email || "Usuário",
          email: member.email || "",
          profileIconUrl: member.avatarImageUrl || null,
          functions: normalizeFunctions(member.functions),
        }));

        if (isMounted) {
          setMembers(mappedMembers);
        }
      } catch (error) {
        console.error(`${LOG_PREFIX} Erro ao carregar membros do time:`, error);
        if (isMounted) {
          setMembers([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingMembers(false);
        }
      }
    };

    void fetchMembers();

    return () => {
      isMounted = false;
    };
  }, [enabled, activeTeamId, supabaseId]);

  const syncPresenceFromChannel = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;

    const state = channel.presenceState() as Record<string, PresenceStateEntry[]>;
    setPresenceByProfile(normalizePresenceState(state));
  }, []);

  const pushPresence = useCallback(
    async (nextAvailability: PresenceAvailability, options?: { force?: boolean; activityAt?: number }) => {
      const channel = channelRef.current;
      if (!channel || !currentProfileId || !masterId) {
        return;
      }

      const now = options?.activityAt ?? Date.now();
      const elapsedSinceLastTrack = now - lastTrackAtRef.current;
      const shouldThrottle =
        !options?.force &&
        nextAvailability === availabilityRef.current &&
        elapsedSinceLastTrack < ACTIVITY_THROTTLE_MS;

      if (shouldThrottle) {
        return;
      }

      if (now > lastActivityAtRef.current) {
        lastActivityAtRef.current = now;
      }

      availabilityRef.current = nextAvailability;
      lastTrackAtRef.current = now;

      try {
        await channel.track({
          profileId: currentProfileId,
          masterId,
          lastActivityAt: new Date(lastActivityAtRef.current).toISOString(),
          availability: nextAvailability,
          joinedAt: new Date().toISOString(),
        });
        syncPresenceFromChannel();
      } catch (error) {
        console.error(`${LOG_PREFIX} Falha ao enviar presença:`, error);
      }
    },
    [currentProfileId, masterId, syncPresenceFromChannel]
  );

  useEffect(() => {
    if (!enabled || !masterId || !currentProfileId) {
      setPresenceByProfile(new Map());
      return;
    }

    const supabase = createSupabaseBrowser();
    if (!supabase) {
      setPresenceByProfile(new Map());
      return;
    }

    let cancelled = false;
    let heartbeatInterval: number | null = null;

    const markActive = () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      const now = Date.now();
      lastActivityAtRef.current = now;

      if (availabilityRef.current !== "online") {
        void pushPresence("online", { force: true, activityAt: now });
        return;
      }

      void pushPresence("online", { activityAt: now });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void pushPresence("away", { force: true });
        return;
      }

      markActive();
    };

    const onFocus = () => {
      markActive();
    };

    const startActivityListeners = () => {
      for (const eventName of ACTIVITY_EVENT_NAMES) {
        window.addEventListener(eventName, markActive, { passive: true });
      }
      document.addEventListener("visibilitychange", onVisibilityChange);
      window.addEventListener("focus", onFocus);

      heartbeatInterval = window.setInterval(() => {
        const now = Date.now();
        const inactiveFor = now - lastActivityAtRef.current;

        if (inactiveFor >= INACTIVITY_THRESHOLD_MS && availabilityRef.current !== "away") {
          void pushPresence("away", { force: true, activityAt: lastActivityAtRef.current });
        }

        setStatusTick((previous) => previous + 1);
      }, STATUS_RECHECK_INTERVAL_MS);
    };

    const stopActivityListeners = () => {
      for (const eventName of ACTIVITY_EVENT_NAMES) {
        window.removeEventListener(eventName, markActive);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);

      if (heartbeatInterval !== null) {
        window.clearInterval(heartbeatInterval);
      }
    };

    const setupPresence = async () => {
      try {
        let accessToken: string | null = null;

        try {
          const sessionResult = await supabase.auth.getSession();
          accessToken = sessionResult.data.session?.access_token ?? null;
        } catch (sessionError) {
          console.error(`${LOG_PREFIX} Erro ao obter sessão para presence:`, sessionError);
        }

        if (!accessToken) {
          try {
            const tokenResponse = await fetch("/api/v1/realtime/auth-token", {
              method: "GET",
              cache: "no-store",
            });
            if (tokenResponse.ok) {
              const tokenResult = await tokenResponse.json();
              accessToken = tokenResult?.result?.accessToken ?? null;
            }
          } catch (tokenError) {
            console.error(`${LOG_PREFIX} Erro ao obter token fallback de realtime:`, tokenError);
          }
        }

        if (accessToken) {
          await supabase.realtime.setAuth(accessToken);
        } else {
          console.info(`${LOG_PREFIX} Token de realtime ausente; presence não inicializado.`);
          setPresenceByProfile(new Map());
          return;
        }

        if (cancelled) return;

        channelRef.current = supabase
          .channel(`studio-presence:${masterId}`, {
            config: {
              presence: {
                key: currentProfileId,
              },
            },
          })
          .on("presence", { event: "sync" }, syncPresenceFromChannel)
          .on("presence", { event: "join" }, syncPresenceFromChannel)
          .on("presence", { event: "leave" }, syncPresenceFromChannel);

        startActivityListeners();

        channelRef.current.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            lastActivityAtRef.current = Date.now();
            availabilityRef.current = "online";
            void pushPresence("online", { force: true, activityAt: lastActivityAtRef.current });
            syncPresenceFromChannel();
          }

          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.info(`${LOG_PREFIX} Presence com status ${status} para studio ${masterId}.`);
          }
        });
      } catch (error) {
        console.error(`${LOG_PREFIX} Falha ao inicializar presença do time:`, error);
        setPresenceByProfile(new Map());
      }
    };

    void setupPresence();

    return () => {
      cancelled = true;
      stopActivityListeners();
      setPresenceByProfile(new Map());

      if (channelRef.current) {
        void channelRef.current.untrack();
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, masterId, currentProfileId, pushPresence, syncPresenceFromChannel]);

  const membersWithPresence = useMemo<TeamPresenceMember[]>(
    () => {
      const now = Date.now();
      const statusRank: Record<PresenceStatus, number> = {
        online: 0,
        away: 1,
        offline: 2,
      };

      return members
        .map((member) => {
          const records = presenceByProfile.get(member.profileId) ?? [];
          return {
            ...member,
            presenceStatus: resolvePresenceStatus(records, now),
          };
        })
        .sort((a, b) => {
          if (a.presenceStatus !== b.presenceStatus) {
            return statusRank[a.presenceStatus] - statusRank[b.presenceStatus];
          }
          return a.name.localeCompare(b.name, "pt-BR");
        });
    },
    [members, presenceByProfile, statusTick]
  );

  return {
    members: membersWithPresence,
    isLoadingMembers,
  };
}
