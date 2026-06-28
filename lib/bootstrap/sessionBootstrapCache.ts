const USER_CACHE_PREFIX = "bootstrap:user:";
const TEAMS_CACHE_PREFIX = "bootstrap:teams:";
const CACHE_TTL_MS = 10 * 60 * 1000;

type CachedPayload<T> = {
  ts: number;
  data: T;
};

export type UserBootstrapCache = {
  user: unknown;
  hasActiveSubscription: boolean;
  userRole: string | null;
};

export type TeamsBootstrapCache = {
  teams: unknown[];
  activeTeamId: string | null;
};

function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPayload<T>;
    if (!parsed?.ts || Date.now() - parsed.ts > CACHE_TTL_MS) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const payload: CachedPayload<T> = { ts: Date.now(), data };
    window.sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // sessionStorage pode estar indisponível
  }
}

export function readUserBootstrapCache(supabaseId: string): UserBootstrapCache | null {
  return readCache<UserBootstrapCache>(`${USER_CACHE_PREFIX}${supabaseId}`);
}

export function writeUserBootstrapCache(
  supabaseId: string,
  data: UserBootstrapCache
): void {
  writeCache(`${USER_CACHE_PREFIX}${supabaseId}`, data);
}

export function readTeamsBootstrapCache(supabaseId: string): TeamsBootstrapCache | null {
  return readCache<TeamsBootstrapCache>(`${TEAMS_CACHE_PREFIX}${supabaseId}`);
}

export function writeTeamsBootstrapCache(
  supabaseId: string,
  data: TeamsBootstrapCache
): void {
  writeCache(`${TEAMS_CACHE_PREFIX}${supabaseId}`, data);
}
