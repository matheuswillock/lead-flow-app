// src/context/AuthContext.tsx
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
//   userProfile: UserDisplay | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createSupabaseBrowser();
  const [user, setUser] = useState<User | null>(null);
//   const [userProfile, setUserProfile] = useState<UserDisplay | null>(null);
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
  // defensive unsubscribe
  authListener?.data?.subscription?.unsubscribe?.()
    }
  }, [supabase]);

  useEffect(() => {
    if (user) {
      const fetchUserProfile = async () => {
  // const { data: profile } = await supabase
  //   .from("users")
  //   .select("teachers!userId(fullName)")
  //   .eq("supabaseId", user.id)
  //   .single();

  /* const name = profile?.teachers?.[0]?.fullName || user.email;
     const avatar = user.user_metadata.avatar_url ?? null; */

        // setUserProfile({
        //   name,
        //   email: user.email,
        //   avatar,
        // });
      };
      fetchUserProfile();
    } else {
      // setUserProfile(null);
    }
  }, [user, supabase]);

  return (
    <AuthContext.Provider value={{ user, /*userProfile,*/ loading }}>
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