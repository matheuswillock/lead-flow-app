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