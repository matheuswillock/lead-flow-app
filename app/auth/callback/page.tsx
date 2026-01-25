"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Conectando com o Google...");

  useEffect(() => {
    const finalize = async () => {
      const supabase = createSupabaseBrowser();
      if (!supabase) {
        setMessage("Supabase indisponivel.");
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.user) {
        setMessage("Sessao invalida. Faca login novamente.");
        return;
      }

      const session = data.session;
      const providerToken = session.provider_token;
      const refreshToken = session.provider_refresh_token;
      const supabaseId = session.user.id;
      const next = searchParams.get("next") || "/board";

      const googleIdentity = session.user.identities?.find(
        (identity) => identity.provider === "google"
      );
      const googleEmail =
        (googleIdentity?.identity_data as { email?: string } | undefined)?.email ||
        session.user.email ||
        undefined;

      const profileResponse = await fetch(`/api/v1/profiles/${supabaseId}`, {
        cache: "no-store",
      });

      if (profileResponse.status === 404) {
        const userMetadata = session.user.user_metadata as { full_name?: string; name?: string } | undefined;
        const fullName = userMetadata?.full_name || userMetadata?.name;

        sessionStorage.setItem("oauthSignup", JSON.stringify({
          fullName,
          email: googleEmail,
        }));

        if (providerToken) {
          sessionStorage.setItem("googleConnectPending", JSON.stringify({
            accessToken: providerToken,
            refreshToken: refreshToken || undefined,
            expiresAt: session.expires_at
              ? new Date(session.expires_at * 1000).toISOString()
              : undefined,
            email: googleEmail,
          }));
        }

        router.replace("/sign-up?oauth=google&newUser=1");
        return;
      }

      if (!profileResponse.ok) {
        setMessage("Falha ao validar perfil do usuario.");
        return;
      }

      if (!providerToken) {
        setMessage("Token do Google nao encontrado. Tente novamente.");
        return;
      }

      const response = await fetch("/api/v1/google/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
        },
        body: JSON.stringify({
          accessToken: providerToken,
          refreshToken: refreshToken || undefined,
          expiresAt: session.expires_at
            ? new Date(session.expires_at * 1000).toISOString()
            : undefined,
          email: googleEmail,
        }),
      });

      if (!response.ok) {
        setMessage("Falha ao salvar integracao do Google.");
        return;
      }

      router.replace(`/${supabaseId}${next}`);
    };

    finalize().catch((err) => {
      console.error("Erro no callback do Google:", err);
      setMessage("Erro inesperado ao finalizar conexao.");
    });
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 text-sm text-muted-foreground">
      {message}
    </div>
  );
}
