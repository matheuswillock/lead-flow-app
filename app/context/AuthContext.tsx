"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User } from "@supabase/supabase-js";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { isE2eTestModeClient } from "@/lib/e2e/is-e2e-test-mode-client";
import { readE2eClientSessionCookie } from "@/lib/e2e/read-e2e-client-session-cookie";
import { buildE2eMockUser } from "@/lib/e2e/build-e2e-mock-user";

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createSupabaseBrowser();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // E2E: injectE2eAuthCookie() nunca autentica o client Supabase real no
    // browser (aponta pro projeto remoto; a suíte usa Auth via cookie
    // assinado só no servidor — ver lib/e2e/resolve-e2e-user.ts). Sem este
    // desvio, `user` fica sempre null no client e efeitos gated em
    // `user?.id` (ex.: TimezoneContext) nunca disparam em specs Playwright.
    if (isE2eTestModeClient()) {
      const sessionUser = readE2eClientSessionCookie();
      setUser(sessionUser ? buildE2eMockUser(sessionUser) : null);
      setLoading(false);
      return;
    }

    const fetchSession = async () => {
      if (!supabase) {
        setUser(null)
        setLoading(false)
        return
      }
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null)
      setLoading(false)
    };

    fetchSession();

    const authListener = supabase
      ? supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ?? null)
        })
      : { data: { subscription: { unsubscribe() {} } } }

    return () => {
  authListener?.data?.subscription?.unsubscribe?.()
    }
  }, [supabase]);

  useEffect(() => {
    if (user) {
      const fetchUserProfile = async () => {
      };
      fetchUserProfile();
    } else {
    }
  }, [user, supabase]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}