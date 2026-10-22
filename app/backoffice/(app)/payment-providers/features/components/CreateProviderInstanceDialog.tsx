"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useBackofficePaymentProviders } from "../context/BackofficePaymentProvidersContext"
import { DISABLED_PRIMARY_CLASS } from "./providerButtonStyles"
import {
  ENVIRONMENT_LABELS,
  PAYMENT_PROVIDER_ENVIRONMENTS,
  type PaymentProviderEnvironment,
  type PaymentProviderKey,
} from "../context/BackofficePaymentProvidersTypes"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateProviderInstanceDialog({ open, onOpenChange }: Props) {
  const { adapters, environment: currentEnvironment, isCreating, createInstance } =
    useBackofficePaymentProviders()
  const [providerKey, setProviderKey] = useState<PaymentProviderKey | "">("")
  const [environment, setEnvironment] = useState<PaymentProviderEnvironment>(currentEnvironment)
  const [accountContext, setAccountContext] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [logoAltText, setLogoAltText] = useState("")

  const canSubmit =
    providerKey !== "" && accountContext.trim() !== "" && displayName.trim() !== "" && !isCreating

  async function submit() {
    if (!canSubmit || !providerKey) return
    const created = await createInstance({
      providerKey,
      environment,
      externalAccountContext: accountContext.trim(),
      displayName: displayName.trim(),
      ...(logoUrl.trim() ? { logoUrl: logoUrl.trim() } : {}),
      ...(logoAltText.trim() ? { logoAltText: logoAltText.trim() } : {}),
    })
    if (created) {
      setProviderKey("")
      setAccountContext("")
      setDisplayName("")
      setLogoUrl("")
      setLogoAltText("")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isCreating && onOpenChange(next)}>
      <DialogContent className="flex max-h-[90vh] flex-col">
        <DialogHeader>
          <DialogTitle>Nova instância de provider</DialogTitle>
          <DialogDescription>
            Só é possível usar adapters que existem no código. As credenciais são cadastradas depois.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex-1 overflow-y-auto px-1 py-1">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="new-provider-adapter">Adapter</FieldLabel>
              <Select value={providerKey} onValueChange={(v) => setProviderKey(v as PaymentProviderKey)}>
                <SelectTrigger id="new-provider-adapter" className="max-lg:h-11">
                  <SelectValue placeholder="Escolha o adapter" />
                </SelectTrigger>
                <SelectContent>
                  {adapters.map((adapter) => (
                    <SelectItem key={adapter.providerKey} value={adapter.providerKey}>
                      {adapter.label}
                      {adapter.paymentCapable ? "" : " (somente credenciais)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="new-provider-environment">Ambiente</FieldLabel>
              <Select value={environment} onValueChange={(v) => setEnvironment(v as PaymentProviderEnvironment)}>
                <SelectTrigger id="new-provider-environment" className="max-lg:h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_PROVIDER_ENVIRONMENTS.map((env) => (
                    <SelectItem key={env} value={env}>
                      {ENVIRONMENT_LABELS[env]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="new-provider-context">Contexto da conta externa</FieldLabel>
              <Input
                id="new-provider-context"
                value={accountContext}
                onChange={(e) => setAccountContext(e.target.value)}
                className="max-lg:h-11"
              />
              <FieldDescription>Identifica a conta no provider, por exemplo “default” ou “conta-b”.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="new-provider-name">Nome exibido</FieldLabel>
              <Input
                id="new-provider-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="max-lg:h-11"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-provider-logo">URL do logo (opcional)</FieldLabel>
              <Input
                id="new-provider-logo"
                type="url"
                inputMode="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="max-lg:h-11"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-provider-logo-alt">Texto alternativo do logo (opcional)</FieldLabel>
              <Input
                id="new-provider-logo-alt"
                value={logoAltText}
                onChange={(e) => setLogoAltText(e.target.value)}
                className="max-lg:h-11"
              />
            </Field>
          </FieldGroup>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
            className="max-lg:h-11"
          >
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit} className={cn("max-lg:h-11", DISABLED_PRIMARY_CLASS)}>
            Criar instância
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
