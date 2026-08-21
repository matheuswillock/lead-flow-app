"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { toastUserError } from "@/lib/ui/to-user-toast-message"
import { CheckCircle2 } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTimezone } from "@/app/context/TimezoneContext"
import { useTeamContext } from "@/app/context/TeamContext"
import { useFeatureAccess } from "@/app/context/FeatureAccessContext"
import { formatIntimezone } from "@/lib/dates"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"
import { emailCreditsService } from "../services/EmailCreditsService"
import type {
  EmailCreditPlanId,
  EmailCreditsStatus,
} from "../services/IEmailCreditsService"
import { EMAIL_CREDIT_PLAN_CATALOG, getEmailCreditPlanLabel } from "../utils/emailCreditPlansCatalog"
import {
  resolveCheckoutNavigationPath,
  shouldShowEmailCreditsPurchasePlans,
  shouldShowEmailCreditsTeamSelector,
} from "../utils/emailCreditsTabVisibility"
import { cn } from "@/lib/utils"

export function EmailCreditsCard() {
  const router = useRouter()
  const { tz } = useTimezone()
  const { teams, activeTeam, activeTeamId, setActiveTeamId, isTeamMaster } = useTeamContext()
  const { showsBetaLabel } = useFeatureAccess()
  const [status, setStatus] = useState<EmailCreditsStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState<EmailCreditPlanId | null>(null)
  const [canceling, setCanceling] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const inFlightRef = useRef(false)
  const lastSuccessKeyRef = useRef<string | null>(null)

  const showTeamSelector = shouldShowEmailCreditsTeamSelector({
    isMaster: isTeamMaster,
    teamCount: teams.length,
  })
  const showPurchasePlans = shouldShowEmailCreditsPurchasePlans({
    isBetaExempt: status?.isBetaExempt === true,
  })
  const hasRadarBeta = showsBetaLabel(FEATURE_SLUGS.RADAR)

  const load = useCallback(async () => {
    const requestKey = `email-credits-status:${activeTeamId ?? "none"}`
    if (inFlightRef.current) return
    inFlightRef.current = true
    try {
      const result = await emailCreditsService.getStatus()
      setStatus(result)
      lastSuccessKeyRef.current = requestKey
    } catch (err) {
      console.error("[EmailCreditsCard] fetchStatus error", err)
    } finally {
      inFlightRef.current = false
      setLoading(false)
    }
  }, [activeTeamId])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  async function handleSubscribe(plan: EmailCreditPlanId) {
    if (subscribing) return
    setSubscribing(plan)
    try {
      const result = await emailCreditsService.subscribe(plan)
      const path = resolveCheckoutNavigationPath(result.checkoutUrl)
      if (!path) {
        throw new Error("Checkout criado sem URL válida")
      }
      toast.success("Checkout criado. A ativação acontece após confirmação do pagamento.")
      router.push(path)
    } catch (err) {
      console.error("[EmailCreditsCard] subscribe error", err)
      toastUserError(err)
    } finally {
      setSubscribing(null)
    }
  }

  async function handleCancel() {
    if (canceling) return
    setCanceling(true)
    try {
      await emailCreditsService.cancel()
      toast.success("Créditos de e-mail cancelados")
      await load()
    } catch (err) {
      console.error("[EmailCreditsCard] cancel error", err)
      toast.error("Erro ao cancelar créditos de e-mail")
    } finally {
      setCanceling(false)
      setCancelDialogOpen(false)
    }
  }

  const teamLabel = activeTeam
    ? [activeTeam.accountName, activeTeam.name].filter(Boolean).join(" — ")
    : "Time ativo"

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
      <Card>
        <CardHeader className="gap-2">
          <CardTitle className="text-lg">Créditos de e-mail</CardTitle>
          <CardDescription>
            Cada destinatário enviado consome 1 crédito.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {showTeamSelector ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">Time</span>
              <Select
                value={activeTeamId ?? undefined}
                onValueChange={(teamId) => {
                  void setActiveTeamId(teamId)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o time" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {[team.accountName, team.name].filter(Boolean).join(" — ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Time</span>
              <p className="text-sm font-medium">{teamLabel}</p>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-full" />
            </div>
          ) : null}

          {showPurchasePlans ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {EMAIL_CREDIT_PLAN_CATALOG.map((plan) => {
                const isCurrent = status?.hasSubscription && status.plan === plan.id
                const isLoading = subscribing === plan.id

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "relative flex flex-col gap-2 rounded-lg border p-3.5",
                      isCurrent ? "border-primary bg-primary/5" : "border-border"
                    )}
                  >
                    {isCurrent ? (
                      <Badge className="absolute right-3 top-3 text-[10px]">Atual</Badge>
                    ) : null}
                    <strong className="text-[15px]">{plan.label}</strong>
                    <p className="text-2xl font-bold text-primary">
                      R$ {plan.price}
                      <span className="text-sm font-normal text-muted-foreground">/mês</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {plan.credits.toLocaleString("pt-BR")} créditos/mês
                    </p>
                    {!isCurrent ? (
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={isLoading || subscribing !== null}
                        onClick={() => void handleSubscribe(plan.id)}
                      >
                        {isLoading ? "Criando checkout..." : "Comprar"}
                      </Button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <aside className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-2 pt-6">
            {hasRadarBeta ? (
              <>
                <Badge variant="secondary">Beta Radar</Badge>
                <strong>Acesso autorizado para este time</strong>
                <p className="text-sm text-muted-foreground">
                  Disparos de e-mail estão liberados nesta fase apenas para times no Grupo Beta
                  de Radar.
                </p>
              </>
            ) : (
              <>
                <strong>Status do Beta Radar</strong>
                <p className="text-sm text-muted-foreground">
                  Disparos de e-mail nesta fase dependem de autorização no Grupo Beta de Radar.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <strong>Status dos créditos</strong>
            {loading ? (
              <Skeleton className="h-4 w-56" />
            ) : status?.isBetaExempt ? (
              <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/10 p-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Beta</Badge>
                  <span className="font-medium">Isenção de créditos</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Acesso beta gratuito ativo: não é necessário comprar créditos enquanto a
                  isenção estiver válida.
                </p>
              </div>
            ) : status?.hasSubscription ? (
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span className="font-medium">
                      Plano {getEmailCreditPlanLabel(status.plan)} ativo
                    </span>
                  </div>
                  <Badge variant="secondary">Ativo</Badge>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Créditos usados</span>
                    <span>
                      {status.creditsUsed.toLocaleString("pt-BR")} /{" "}
                      {status.monthlyCredits.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          status.monthlyCredits > 0
                            ? (status.creditsUsed / status.monthlyCredits) * 100
                            : 0
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                {status.currentPeriodEnd ? (
                  <p className="text-xs text-muted-foreground">
                    Renova em {formatIntimezone(new Date(status.currentPeriodEnd), "dd/MM/yyyy", tz)}
                  </p>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelDialogOpen(true)}
                  disabled={canceling}
                  className="text-destructive hover:text-destructive"
                >
                  Cancelar créditos
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum plano ativo para este time.
              </p>
            )}
          </CardContent>
        </Card>
      </aside>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent className="max-h-[90vh] flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar créditos de e-mail?</AlertDialogTitle>
            <AlertDialogDescription>
              Os créditos restantes serão perdidos ao fim do ciclo atual. Você não poderá mais
              disparar campanhas de e-mail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={canceling}>Manter plano</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleCancel()}
              disabled={canceling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {canceling ? "Cancelando..." : "Sim, cancelar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
