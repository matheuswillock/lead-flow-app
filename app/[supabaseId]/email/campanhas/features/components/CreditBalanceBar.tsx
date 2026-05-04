"use client"

import Link from "next/link"
import { AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useParams } from "next/navigation"
import { useCampanhasContext } from "../context/CampanhasContext"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates"

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  plus: "Plus",
  pro: "Pro",
  business: "Business",
}

export function CreditBalanceBar() {
  const { credits, loadingCredits } = useCampanhasContext()
  const params = useParams<{ supabaseId: string }>()
  const { tz } = useTimezone()

  if (loadingCredits) {
    return <Skeleton className="h-14 w-full rounded-lg" />
  }

  if (!credits || !credits.hasSubscription) {
    return (
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
        <CardContent className="flex items-center gap-3 py-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Sem créditos de email ativos.{" "}
            <Link
              href={`/${params.supabaseId}/subscription`}
              className="font-medium underline underline-offset-2"
            >
              Ative um plano em Assinaturas
            </Link>{" "}
            para disparar campanhas.
          </p>
        </CardContent>
      </Card>
    )
  }

  const pct = credits.monthlyCredits > 0
    ? Math.round((credits.creditsUsed / credits.monthlyCredits) * 100)
    : 0
  const remaining = credits.creditsAvailable
  const isLow = remaining / credits.monthlyCredits < 0.2

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {PLAN_LABELS[credits.plan ?? ""] ?? credits.plan} — Créditos de Email
            </span>
            <span className={isLow ? "text-amber-600 font-medium" : "text-muted-foreground"}>
              {remaining.toLocaleString("pt-BR")} / {credits.monthlyCredits.toLocaleString("pt-BR")} restantes
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${isLow ? "bg-amber-500" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {credits.currentPeriodEnd && (
          <p className="shrink-0 text-xs text-muted-foreground">
            Expira em {formatIntimezone(new Date(credits.currentPeriodEnd), "dd/MM/yyyy", tz)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
