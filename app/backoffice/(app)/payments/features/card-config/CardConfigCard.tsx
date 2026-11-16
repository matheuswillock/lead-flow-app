"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { AlertCircle, CreditCard, Plus, Save, Trash2 } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CARD_CONFIG_ENVIRONMENTS, useCardConfig } from "./CardConfigContext"
import type { CardToggleOutcome } from "./cardConfigToggle"
import type { CardConfigEnvironment, ProviderVariablesConfig } from "./ICardConfigService"

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
  const { configs, providerConfigs, isLoading, loadError, saving, canManage, reload, toggleCard, saveProviderVariables } = useCardConfig()
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
                {providerConfigs[environment].map((providerConfig) => (
                  <ProviderVariablesEditor
                    key={`${environment}:${providerConfig.provider}`}
                    config={providerConfig}
                    disabled={!canManage || saving[environment]}
                    onSave={async (variables) => {
                      const saved = await saveProviderVariables(providerConfig.provider, environment, variables)
                      if (saved) toast.success("Variáveis salvas.")
                      else toast.error("Não foi possível salvar as variáveis.")
                    }}
                  />
                ))}
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

type VariableRow = {
  name: string
  visibility: "PUBLIC" | "SECRET"
  configured: boolean
  value: string
}

function ProviderVariablesEditor({
  config,
  disabled,
  onSave,
}: {
  config: ProviderVariablesConfig
  disabled: boolean
  onSave: (variables: Array<{ name: string; visibility: "PUBLIC" | "SECRET"; value?: string }>) => Promise<void>
}) {
  const [rows, setRows] = useState<VariableRow[]>([])

  useEffect(() => {
    setRows(config.variables.map((variable) => ({
      ...variable,
      value: variable.value ?? "",
    })))
  }, [config.variables])

  function addVariable() {
    const prefix = `${config.provider}_${config.environment}_`
    setRows((current) => [...current, { name: `${prefix}NEW_VARIABLE`, visibility: "SECRET", configured: false, value: "" }])
  }

  return (
    <section aria-label={`Variáveis ${config.provider} ${config.environment}`} className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">Variáveis · {config.provider}</h3>
          <p className="text-xs text-muted-foreground">Segredos são cifrados e nunca voltam na resposta da API.</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="max-lg:min-h-11" disabled={disabled} onClick={addVariable}>
          <Plus data-icon="inline-start" className="size-4" aria-hidden="true" />Adicionar variável
        </Button>
      </div>
      {rows.map((row, index) => (
        <div key={`${row.name}:${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)_auto]">
          <Input
            aria-label="Nome da variável"
            value={row.name}
            className="max-lg:min-h-11"
            disabled={disabled || row.configured}
            onChange={(event) => setRows((current) => current.map((item, i) => i === index ? { ...item, name: event.target.value.toUpperCase() } : item))}
            autoComplete="off"
          />
          <Select value={row.visibility} disabled={disabled} onValueChange={(visibility: "PUBLIC" | "SECRET") => setRows((current) => current.map((item, i) => i === index ? { ...item, visibility, value: "" } : item))}>
          <SelectTrigger aria-label="Visibilidade da variável" className="max-lg:min-h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PUBLIC">Pública</SelectItem>
              <SelectItem value="SECRET">Secreta</SelectItem>
            </SelectContent>
          </Select>
          <Input
            aria-label={`Valor de ${row.name}`}
            type={row.visibility === "SECRET" ? "password" : "text"}
            value={row.value}
            className="max-lg:min-h-11"
            placeholder={row.visibility === "SECRET" && row.configured ? "Cadastrado; vazio mantém o valor" : "Valor"}
            onChange={(event) => setRows((current) => current.map((item, i) => i === index ? { ...item, value: event.target.value } : item))}
            autoComplete="new-password"
          />
          <Button type="button" variant="ghost" size="icon" className="max-lg:size-11" aria-label={`Remover ${row.name}`} disabled={disabled} onClick={() => setRows((current) => current.filter((_, i) => i !== index))}>
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ))}
      <div className="flex justify-end">
        <Button type="button" variant="outline" className="max-lg:min-h-11" disabled={disabled} onClick={() => void onSave(rows.map(({ name, visibility, value }) => ({
          name: name.trim(),
          visibility,
          ...(value ? { value } : {}),
        })))}>
          <Save data-icon="inline-start" className="size-4" aria-hidden="true" />Salvar variáveis
        </Button>
      </div>
    </section>
  )
}
