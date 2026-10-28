"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AlertCircle, CreditCard } from "lucide-react"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { CARD_CONFIG_ENVIRONMENTS, useCardConfig } from "./CardConfigContext"
import type { CardToggleOutcome } from "./cardConfigToggle"
import type { CardConfigEnvironment } from "./ICardConfigService"

const ENVIRONMENT_LABELS: Record<CardConfigEnvironment, { title: string; hint: string }> = {
  DEV: { title: "Desenvolvimento", hint: "Ambiente de testes" },
  PRODUCTION: { title: "Produção", hint: "Cobranças reais" },
}

const READ_ONLY_MESSAGE = "Somente gerentes podem ligar ou desligar o cartão."

function notifyOutcome(outcome: CardToggleOutcome | null, cardEnabled: boolean) {
  if (!outcome) return
  switch (outcome.status) {
    case "saved":
      toast.success(cardEnabled ? "Cartão ligado." : "Cartão desligado. Os checkouts voltam a oferecer só PIX.")
      return
    case "conflict":
      toast.warning("Outra pessoa alterou esta configuração. Atualizamos a tela, confira e tente de novo.")
      return
    case "forbidden":
      toast.error(READ_ONLY_MESSAGE)
      return
    case "error":
      toast.error(outcome.message)
  }
}

export function CardConfigCard() {
  const { configs, isLoading, loadError, saving, canManage, reload, toggleCard } = useCardConfig()
  const [pendingEnable, setPendingEnable] = useState<CardConfigEnvironment | null>(null)

  async function applyToggle(environment: CardConfigEnvironment, cardEnabled: boolean) {
    notifyOutcome(await toggleCard(environment, cardEnabled), cardEnabled)
  }

  function handleCheckedChange(environment: CardConfigEnvironment, checked: boolean) {
    if (checked) {
      setPendingEnable(environment)
      return
    }
    void applyToggle(environment, false)
  }

  function confirmEnable() {
    if (!pendingEnable) return
    const environment = pendingEnable
    setPendingEnable(null)
    void applyToggle(environment, true)
  }

  return (
    <Card data-testid="card-config">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="size-5 text-muted-foreground" aria-hidden="true" />
          Cartão de crédito
        </CardTitle>
        <CardDescription>
          O cartão só aparece nos checkouts quando esta opção está ligada e a loja do Abacate Pay
          tem a chave pública cadastrada. Desligado, os checkouts oferecem só PIX.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loadError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>Erro ao carregar a configuração de cartão.</span>
              <Button size="sm" variant="outline" className="max-lg:h-11" onClick={() => void reload()}>
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!canManage && !loadError && (
          <p className="text-sm text-muted-foreground">{READ_ONLY_MESSAGE}</p>
        )}

        {!loadError &&
          CARD_CONFIG_ENVIRONMENTS.map((environment, index) => {
            const label = ENVIRONMENT_LABELS[environment]
            const config = configs[environment]
            const switchId = `card-switch-${environment}`
            return (
              <div key={environment} className="flex flex-col gap-3">
                {index > 0 && <Separator />}
                {isLoading ? (
                  <div className="flex min-h-11 items-center justify-between gap-4">
                    <Skeleton className="h-9 w-40" />
                    <Skeleton className="h-5 w-9 rounded-full" />
                  </div>
                ) : (
                  <label
                    htmlFor={switchId}
                    className="flex min-h-11 items-center justify-between gap-4"
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {label.title}
                        {config && (
                          <Badge variant={config.cardEnabled ? "default" : "secondary"}>
                            {config.cardEnabled ? "Cartão ligado" : "Só PIX"}
                          </Badge>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {config ? label.hint : "Abacate Pay não está configurado neste ambiente."}
                      </span>
                    </span>
                    <Switch
                      id={switchId}
                      checked={config?.cardEnabled ?? false}
                      disabled={!config || !canManage || saving[environment]}
                      className="max-lg:h-12 max-lg:w-12 max-lg:px-1.5 max-lg:py-3.5 max-lg:[background-clip:content-box]"
                      onCheckedChange={(checked) => handleCheckedChange(environment, checked)}
                      aria-label={`Cartão de crédito em ${label.title}`}
                    />
                  </label>
                )}
              </div>
            )
          })}
      </CardContent>

      <AlertDialog
        open={pendingEnable !== null}
        onOpenChange={(open) => {
          if (!open) setPendingEnable(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ligar o cartão de crédito?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingEnable === "PRODUCTION"
                ? "Os checkouts de produção passam a oferecer cartão e as cobranças serão reais, desde que a loja do Abacate Pay tenha a chave pública cadastrada."
                : "Os checkouts de desenvolvimento passam a oferecer cartão, desde que a loja do Abacate Pay tenha a chave pública cadastrada."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEnable}>Ligar cartão</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
