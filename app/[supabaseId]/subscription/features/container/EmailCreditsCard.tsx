'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Mail, Zap, CheckCircle2 } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useTimezone } from '@/app/context/TimezoneContext'
import { formatIntimezone } from "@/lib/dates"
import { API_CLIENT_BASE } from "@/lib/route-map";

type CreditPlan = 'starter' | 'plus' | 'pro' | 'business'

type CreditStatus = {
  hasSubscription: boolean
  isBetaExempt?: boolean
  plan: CreditPlan | null
  monthlyCredits: number
  creditsUsed: number
  creditsAvailable: number
  currentPeriodEnd: string | null
  status: string | null
}

const PLANS: Array<{
  id: CreditPlan
  label: string
  credits: number
  price: number
  overage: number
}> = [
  { id: 'starter',  label: 'Starter',  credits: 1000,  price: 25,  overage: 3.50 },
  { id: 'plus',     label: 'Plus',     credits: 5000,  price: 100, overage: 3.00 },
  { id: 'pro',      label: 'Pro',      credits: 10000, price: 175, overage: 2.50 },
  { id: 'business', label: 'Business', credits: 25000, price: 375, overage: 2.00 },
]

async function fetchStatus(): Promise<CreditStatus | null> {
  const res = await fetch(`${API_CLIENT_BASE}/email/credits/status`)
  if (!res.ok) return null
  const json = await res.json()
  return json.isValid ? (json.result as CreditStatus) : null
}

async function subscribePlan(plan: CreditPlan): Promise<boolean> {
  const res = await fetch(`${API_CLIENT_BASE}/email/credits/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  })
  const json = await res.json()
  if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
  return true
}

async function cancelPlan(): Promise<boolean> {
  const res = await fetch(`${API_CLIENT_BASE}/email/credits/cancel`, { method: 'POST' })
  const json = await res.json()
  if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
  return true
}

export function EmailCreditsCard() {
  const { tz } = useTimezone()
  const [status, setStatus] = useState<CreditStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState<CreditPlan | null>(null)
  const [canceling, setCanceling] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const result = await fetchStatus()
      setStatus(result)
    } catch (err) {
      console.error('[EmailCreditsCard] fetchStatus error', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSubscribe(plan: CreditPlan) {
    setSubscribing(plan)
    try {
      await subscribePlan(plan)
      toast.success(`Plano ${PLANS.find((p) => p.id === plan)?.label} ativado com sucesso`)
      await load()
    } catch (err) {
      console.error('[EmailCreditsCard] subscribe error', err)
      toast.error('Erro ao ativar plano de créditos')
    } finally {
      setSubscribing(null)
    }
  }

  async function handleCancel() {
    setCanceling(true)
    try {
      await cancelPlan()
      toast.success('Créditos de e-mail cancelados')
      await load()
    } catch (err) {
      console.error('[EmailCreditsCard] cancel error', err)
      toast.error('Erro ao cancelar créditos de e-mail')
    } finally {
      setCanceling(false)
      setCancelDialogOpen(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Créditos de E-mail</CardTitle>
        </div>
        <CardDescription>
          Pacote mensal para disparo de campanhas de e-mail. Créditos expiram no fim do ciclo e o
          excedente é cobrado automaticamente.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-full" />
          </div>
        ) : status?.isBetaExempt ? (
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-orange-500/15 text-orange-600 border-0">Beta</Badge>
              <span className="font-medium">Acesso Beta de e-mail</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Você está no grupo Beta do módulo de e-mail. Campanhas podem ser disparadas sem
              assinatura de créditos e sem cobrança adicional enquanto o acesso beta estiver ativo.
            </p>
          </div>
        ) : status?.hasSubscription ? (
          <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="font-medium">
                  Plano {PLANS.find((p) => p.id === status.plan)?.label ?? status.plan} ativo
                </span>
              </div>
              <Badge className="bg-emerald-500/15 text-emerald-700 border-0">Ativo</Badge>
            </div>
            <div className="space-y-1.5">
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
                        : 0,
                    )}%`,
                  }}
                />
              </div>
            </div>
            {status.currentPeriodEnd && (
              <p className="text-xs text-muted-foreground">
                Renova em {formatIntimezone(new Date(status.currentPeriodEnd), "dd/MM/yyyy", tz)}
              </p>
            )}
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
            Nenhum plano de créditos ativo. Escolha um pacote abaixo para começar a disparar
            campanhas.
          </p>
        )}

        {!status?.isBetaExempt ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {PLANS.map((plan) => {
            const isCurrent = status?.hasSubscription && status.plan === plan.id
            const isLoading = subscribing === plan.id

            return (
              <div
                key={plan.id}
                className={`relative rounded-lg border p-4 space-y-3 transition-colors ${
                  isCurrent ? "border-primary bg-primary/5" : "hover:border-primary/40"
                }`}
              >
                {isCurrent && (
                  <Badge className="absolute right-3 top-3 bg-primary text-primary-foreground text-[10px]">
                    Atual
                  </Badge>
                )}
                <div>
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{plan.label}</span>
                  </div>
                  <p className="mt-1 text-2xl font-bold">
                    R${plan.price}
                    <span className="text-sm font-normal text-muted-foreground">/mês</span>
                  </p>
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>{plan.credits.toLocaleString("pt-BR")} emails/mês</li>
                  <li>Excedente: R${plan.overage.toFixed(2)}/100 emails</li>
                </ul>
                {!isCurrent && (
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={isLoading || subscribing !== null}
                    onClick={() => handleSubscribe(plan.id)}
                  >
                    {isLoading
                      ? "Ativando..."
                      : status?.hasSubscription
                        ? "Mudar para este plano"
                        : "Ativar"}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
        ) : null}
      </CardContent>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
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
              onClick={handleCancel}
              disabled={canceling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {canceling ? "Cancelando..." : "Sim, cancelar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
