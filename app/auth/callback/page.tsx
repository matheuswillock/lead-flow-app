"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { AlertCircle } from "lucide-react";
import { ConnectingDots } from "@/components/ui/connecting-dots";

type Status = "connecting" | "error";

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="size-6"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("connecting");
  const [errorMessage, setErrorMessage] = useState("");

  const setError = (msg: string) => {
    setStatus("error");
    setErrorMessage(msg);
  };

  useEffect(() => {
    const finalize = async () => {
      const supabase = createSupabaseBrowser();
      if (!supabase) {
        setError("Supabase indisponível.");
        return;
      }

      const oauthError = searchParams.get("error");
      const oauthErrorCode = searchParams.get("error_code");
      const oauthErrorDescription = searchParams.get("error_description");

      if (oauthError) {
        const description = oauthErrorDescription || oauthError;
        if (
          oauthErrorCode === "identity_already_exists" ||
          description.toLowerCase().includes("already linked")
        ) {
          setError("Esta conta Google já está vinculada. Tente reconectar novamente.");
        } else if (description.toLowerCase().includes("conta nao encontrada")) {
          setError(
            "Conta não encontrada. Crie sua conta com e-mail e senha ou fale com o suporte."
          );
          setTimeout(() => router.replace("/"), 5000);
        } else {
          setError(`Falha ao conectar com o Google: ${description}`);
        }
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.user) {
        setError("Sessão inválida. Faça login novamente.");
        return;
      }

      const session = data.session;
      const providerToken = session.provider_token;
      const refreshToken = session.provider_refresh_token;
      const supabaseId = session.user.id;
      const next = searchParams.get("next") || "/crm";
      const connectContextRaw = sessionStorage.getItem("googleConnectContext");
      let connectContext: { source?: string; expectedSupabaseId?: string } | null = null;
      if (connectContextRaw) {
        try {
          connectContext = JSON.parse(connectContextRaw) as {
            source?: string;
            expectedSupabaseId?: string;
          };
        } catch {
          sessionStorage.removeItem("googleConnectContext");
        }
      }
      const isBackofficeAccountConnectFlow =
        next === "/backoffice/account" || connectContext?.source === "backoffice-account";
      const isAccountReconnectFlow =
        !isBackofficeAccountConnectFlow &&
        (next === "/account" || connectContext?.source === "account");

      if (
        (isAccountReconnectFlow || isBackofficeAccountConnectFlow) &&
        connectContext?.expectedSupabaseId &&
        connectContext.expectedSupabaseId !== supabaseId
      ) {
        sessionStorage.removeItem("googleConnectContext");
        setError(
          "A autenticacao retornou para um usuario diferente do esperado. Tente reconectar novamente."
        );
        return;
      }

      const googleIdentity = session.user.identities?.find(
        (identity) => identity.provider === "google"
      );
      const identityData = googleIdentity?.identity_data as
        | { email?: string }
        | undefined;
      const googleEmail = identityData?.email || session.user.email || undefined;

      const profileResponse = await fetch(`/api/v1/profiles/${supabaseId}`, {
        cache: "no-store",
      });

      if (profileResponse.status === 404) {
        if (isAccountReconnectFlow || isBackofficeAccountConnectFlow) {
          sessionStorage.removeItem("googleConnectContext");
          setError(
            "Nao foi possivel vincular a conta Google ao usuario atual. Tente novamente na tela de conta."
          );
          return;
        }
        setError("Conta não encontrada. Você será redirecionado em instantes...");
        setTimeout(() => router.replace("/"), 5000);
        return;
      }

      if (!profileResponse.ok) {
        setError("Falha ao validar perfil do usuário.");
        return;
      }

      if (!providerToken) {
        setError("Token do Google não encontrado. Tente novamente.");
        return;
      }

      if (isBackofficeAccountConnectFlow) {
        const response = await fetch("/api/v1/backoffice/google/connect", {
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
          sessionStorage.removeItem("googleConnectContext");
          setError("Falha ao salvar integração Google do backoffice.");
          return;
        }

        sessionStorage.removeItem("googleConnectContext");
        router.replace("/backoffice/account");
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
        sessionStorage.removeItem("googleConnectContext");
        setError("Falha ao salvar integração do Google.");
        return;
      }

      sessionStorage.removeItem("googleConnectContext");

      router.replace(`/${supabaseId}${next}`);
    };

    finalize().catch((err) => {
      console.error("[AuthCallback] Erro inesperado:", err);
      setError("Erro inesperado ao finalizar conexão.");
    });
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 rounded-2xl border border-border bg-card p-8 shadow-sm">

        {/* Brand */}
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/corretor-studio-icon.svg"
            alt="Corretor Studio"
            width={48}
            height={48}
            priority
          />
          <span className="text-base font-semibold tracking-tight text-foreground">
            Corretor Studio
          </span>
        </div>

        {/* Connector */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full border border-border bg-background shadow-sm">
            <GoogleIcon />
          </div>
          <ConnectingDots />
          <div className="flex size-10 items-center justify-center rounded-full border border-border bg-background shadow-sm">
            <Image
              src="/corretor-studio-icon.svg"
              alt=""
              width={22}
              height={22}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Status */}
        {status === "connecting" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-medium text-foreground">
              Te conectando com o Google ao Corretor Studio
            </p>
            <p className="text-xs text-muted-foreground">
              Aguarde um instante, isso não vai demorar...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="size-5 text-destructive" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Não foi possível conectar
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {errorMessage}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

function CallbackFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/corretor-studio-icon.svg"
            alt="Corretor Studio"
            width={48}
            height={48}
            priority
          />
          <span className="text-base font-semibold tracking-tight text-foreground">
            Corretor Studio
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full border border-border bg-background shadow-sm">
            <GoogleIcon />
          </div>
          <ConnectingDots />
          <div className="flex size-10 items-center justify-center rounded-full border border-border bg-background shadow-sm">
            <Image
              src="/corretor-studio-icon.svg"
              alt=""
              width={22}
              height={22}
              aria-hidden="true"
            />
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-medium text-foreground">
            Te conectando com o Google ao Corretor Studio
          </p>
          <p className="text-xs text-muted-foreground">
            Aguarde um instante, isso não vai demorar...
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackFallback />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
