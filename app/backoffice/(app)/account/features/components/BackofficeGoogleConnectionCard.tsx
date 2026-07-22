"use client"

import { useEffect, useState } from "react"
import type { SignInWithOAuthCredentials } from "@supabase/supabase-js"
import {
  AlertTriangle,
  Calendar,
  CircleCheckBig,
  CircleX,
  Link2,
} from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { GOOGLE_CALENDAR_SCOPES } from "@/lib/googleOAuth"
import { createSupabaseBrowser } from "@/lib/supabase/browser"
import { useBackofficeAccount } from "../context/BackofficeAccountHook"
import type { BackofficeAccountData } from "../context/BackofficeAccountTypes"

const ALL_GOOGLE_SCOPES = [
  {
    scope: "https://www.googleapis.com/auth/calendar.events.freebusy",
    label: "Ver a disponibilidade nas agendas do Google a que você tem acesso",
  },
  {
    scope: "https://www.googleapis.com/auth/calendar.events",
    label: "Ver e editar eventos em todas as suas agendas",
  },
  {
    scope: "https://www.googleapis.com/auth/tasks",
    label: "Criar, editar, organizar e excluir todas as suas tarefas",
  },
  {
    scope: "profile",
    label: "Ver suas informações pessoais, inclusive aquelas que você disponibilizou publicamente",
  },
  {
    scope: "email",
    label: "Ver o endereço de e-mail principal da sua Conta do Google",
  },
  {
    scope: "openid",
    label: "Associar suas informações pessoais a você no Google",
  },
] as const

type Props = {
  account: BackofficeAccountData
}

export function BackofficeGoogleConnectionCard({ account }: Props) {
  const { disconnectGoogle, getGoogleScopes, refresh } = useBackofficeAccount()
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false)
  const [isDisconnectingGoogle, setIsDisconnectingGoogle] = useState(false)
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false)
  const [grantedScopes, setGrantedScopes] = useState<string[]>([])
  const [isScopesLoading, setIsScopesLoading] = useState(false)

  const isConnected = account.googleCalendarConnected
  const isLinkedProfile = account.googleConnectionSource === "linked_profile"
  const isOwnConnection = account.googleConnectionSource === "backoffice_user"

  useEffect(() => {
    if (!isConnected) {
      setGrantedScopes([])
      return
    }

    let cancelled = false
    setIsScopesLoading(true)

    void getGoogleScopes()
      .then((result) => {
        if (cancelled) return
        setGrantedScopes(result.scopes)
      })
      .catch((err) => {
        console.error("[BackofficeGoogleConnectionCard][scopes]", err)
        if (!cancelled) setGrantedScopes([])
      })
      .finally(() => {
        if (!cancelled) setIsScopesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [getGoogleScopes, isConnected, account.googleConnectionSource, account.googleEmail])

  async function handleConnectGoogle() {
    if (isConnectingGoogle) return
    setIsConnectingGoogle(true)

    try {
      const supabase = createSupabaseBrowser()
      if (!supabase) {
        toast.error("Supabase indisponível no momento.")
        return
      }

      if (isOwnConnection && isConnected) {
        toast.info("Google Calendar já está conectado.")
        return
      }

      if (!account.supabaseId) {
        toast.error("Perfil sem autenticação vinculada.")
        return
      }

      const redirectTo = `${window.location.origin}/auth/callback`

      sessionStorage.setItem(
        "googleConnectContext",
        JSON.stringify({
          source: "backoffice-account",
          expectedSupabaseId: account.supabaseId,
          next: "/backoffice/account",
        })
      )

      const auth = supabase.auth as typeof supabase.auth & {
        linkIdentity?: (
          params: SignInWithOAuthCredentials
        ) => Promise<{ error: { message: string } | null }>
      }

      const { data } = await supabase.auth.getUser()
      const hasGoogleIdentity =
        data.user?.identities?.some((identity) => identity.provider === "google") ?? false

      // Já autenticado com Google: reconecta a MESMA identity (refresh de scopes/token).
      // Sem `select_account` — escolher outra conta via signInWithOAuth troca a sessão e
      // quebra o callback (expectedSupabaseId). Conta diferente usa linkIdentity abaixo.
      if (hasGoogleIdentity) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            scopes: GOOGLE_CALENDAR_SCOPES,
            redirectTo,
            queryParams: {
              access_type: "offline",
              prompt: "consent",
            },
          },
        })
        if (error) {
          sessionStorage.removeItem("googleConnectContext")
          toast.error(error.message || "Erro ao reconectar Google Calendar")
        }
        return
      }

      const linkIdentity = auth.linkIdentity?.bind(auth)
      if (!linkIdentity) {
        sessionStorage.removeItem("googleConnectContext")
        toast.error("Não foi possível iniciar a vinculação Google nesta versão do cliente.")
        return
      }

      const { error } = await linkIdentity({
        provider: "google",
        options: {
          scopes: GOOGLE_CALENDAR_SCOPES,
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "select_account consent",
          },
        },
      })

      if (error) {
        sessionStorage.removeItem("googleConnectContext")
        if (error.message === "Manual linking is disabled") {
          toast.error("Vinculação manual desativada no Supabase. Ative em Auth > Providers.")
        } else {
          toast.error(error.message || "Erro ao iniciar conexão com Google")
        }
      }
    } catch (error) {
      sessionStorage.removeItem("googleConnectContext")
      console.error("[BackofficeGoogleConnectionCard][connect]", error)
      toast.error("Erro inesperado ao conectar Google")
    } finally {
      setIsConnectingGoogle(false)
    }
  }

  async function handleDisconnectGoogle() {
    if (isDisconnectingGoogle || !isConnected) return
    setIsDisconnectingGoogle(true)
    try {
      await disconnectGoogle()
      setDisconnectDialogOpen(false)
      setGrantedScopes([])
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao desconectar Google")
    } finally {
      setIsDisconnectingGoogle(false)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-medium">Google Calendar</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Conecte uma conta Google dedicada ao backoffice para criar reuniões automaticamente.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">
          {isConnected ? (
            <CircleCheckBig className="size-4 text-emerald-500" />
          ) : (
            <Calendar className="size-4" />
          )}
          {isConnected ? "Conectado" : "Não conectado"}
        </div>
      </div>

      {isLinkedProfile ? (
        <div className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
          Conexão herdada do perfil Corretor Studio. Desconecte para parar de usar essa conta no
          backoffice e, em seguida, conecte uma conta Google própria (pode ser diferente da do
          Corretor Studio). A conexão do Corretor Studio não será revogada.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">
            {isConnected
              ? isLinkedProfile
                ? "Conta vinculada (herdada)"
                : "Conta vinculada"
              : "Conectar conta Google"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isConnected
              ? `Conectado como ${account.googleEmail || account.email}.`
              : "Necessário para enviar convites e criar eventos. Você pode escolher outra conta Google."}
          </p>
        </div>

        {isConnected ? (
          <div className="flex flex-wrap items-center gap-2">
            {isLinkedProfile ? (
              <Button
                type="button"
                variant="outline"
                className="h-10 gap-2"
                onClick={() => void handleConnectGoogle()}
                disabled={isConnectingGoogle || isDisconnectingGoogle}
              >
                <Link2 data-icon="inline-start" />
                {isConnectingGoogle ? "Conectando..." : "Conectar conta própria"}
              </Button>
            ) : null}
            <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  className="h-9 border border-foreground/20 bg-transparent font-medium text-red-500/90 hover:border-red-400 hover:bg-red-500 hover:text-white"
                  disabled={isDisconnectingGoogle || isConnectingGoogle}
                >
                  {isDisconnectingGoogle ? "Desconectando..." : "Desconectar Google"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-red-600/40">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-500">
                    <AlertTriangle className="size-5" />
                    Desconectar conta Google?
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="flex flex-col gap-2">
                      <p>
                        {isLinkedProfile
                          ? "O backoffice deixará de usar a conexão herdada do Corretor Studio."
                          : "Você deixará de criar eventos automaticamente no Google Calendar deste backoffice."}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Esta ação não remove eventos já criados e não revoga a conexão Google do
                        perfil Corretor Studio.
                      </p>
                      {isLinkedProfile ? (
                        <p className="text-sm text-muted-foreground">
                          Depois, você poderá conectar uma conta Google diferente só para o
                          backoffice.
                        </p>
                      ) : null}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="cursor-pointer" disabled={isDisconnectingGoogle}>
                    Cancelar
                  </AlertDialogCancel>
                  <Button
                    variant="destructive"
                    onClick={() => void handleDisconnectGoogle()}
                    disabled={isDisconnectingGoogle}
                    className="cursor-pointer bg-red-600 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-600 dark:hover:bg-red-700"
                  >
                    {isDisconnectingGoogle ? "Desconectando..." : "Desconectar Google"}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2"
            onClick={() => void handleConnectGoogle()}
            disabled={isConnectingGoogle}
          >
            <Link2 data-icon="inline-start" />
            {isConnectingGoogle ? "Conectando..." : "Conectar Google"}
          </Button>
        )}
      </div>

      {isConnected ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-4">
          <p className="text-sm font-medium">Permissões concedidas</p>
          {isScopesLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {ALL_GOOGLE_SCOPES.map(({ scope, label }) => {
                const granted = grantedScopes.includes(scope)
                return (
                  <li key={scope} className="flex items-start gap-2 text-sm">
                    {granted ? (
                      <CircleCheckBig className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    ) : (
                      <CircleX className="mt-0.5 size-4 shrink-0 text-destructive" />
                    )}
                    <span className={granted ? "text-foreground" : "text-muted-foreground"}>
                      {label}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  )
}
