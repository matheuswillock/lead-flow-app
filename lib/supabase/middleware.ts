import { createServerClient } from "@supabase/ssr";
import { type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          console.debug("Fetching all cookies from request");
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          console.debug("Setting cookies:", cookiesToSet);
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
        },
      },
    },
  );

  console.debug("Fetching user from Supabase");
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("Error fetching user:", userError);
  }

  if (user) {
    console.debug("User found:", user);
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role, schoolId")
      .eq("supabaseId", user.id) // Aqui o `user.id` é o `supabaseId`
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
    }

    console.debug("Profile fetched:", profile);
    return {
      supabase,
      user: {
        ...user,
        supabaseId: user.id, // Adiciona explicitamente o `supabaseId`
        // role: profile?.role, TODO: habilitar quando implementar controle de acesso
        // schoolId: profile?.schoolId, TODO: habilitar quando implementar controle de acesso
      },
    };
  }

  console.debug("No user found");
  return { supabase, user };
}