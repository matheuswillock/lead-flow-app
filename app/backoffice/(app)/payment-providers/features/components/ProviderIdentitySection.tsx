"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useBackofficePaymentProviders } from "../context/BackofficePaymentProvidersContext"
import type { ProviderInstanceView } from "../context/BackofficePaymentProvidersTypes"

export function ProviderIdentitySection({ instance }: { instance: ProviderInstanceView }) {
  const { canManage, busyInstanceId, updateInstance } = useBackofficePaymentProviders()
  const [displayName, setDisplayName] = useState(instance.displayName)
  const [accountContext, setAccountContext] = useState(instance.externalAccountContext)
  const [logoUrl, setLogoUrl] = useState(instance.logoUrl ?? "")
  const [logoAltText, setLogoAltText] = useState(instance.logoAltText ?? "")

  const isDirty =
    displayName !== instance.displayName ||
    accountContext !== instance.externalAccountContext ||
    logoUrl !== (instance.logoUrl ?? "") ||
    logoAltText !== (instance.logoAltText ?? "")
  const canSave = canManage && isDirty && busyInstanceId === null && displayName.trim() !== ""
  const readOnly = !canManage

  function save() {
    if (!canSave) return Promise.resolve(false)
    return updateInstance(
      instance,
      {
        displayName: displayName.trim(),
        externalAccountContext: accountContext.trim(),
        logoUrl: logoUrl.trim(),
        logoAltText: logoAltText.trim(),
      },
      "Identidade atualizada"
    )
  }

  return (
    <section aria-labelledby="provider-identity-title" className="flex flex-col gap-3">
      <h3 id="provider-identity-title" className="text-sm font-semibold">
        Identidade
      </h3>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="identity-name">Nome exibido</FieldLabel>
          <Input id="identity-name" value={displayName} readOnly={readOnly} onChange={(e) => setDisplayName(e.target.value)} className="max-lg:h-11" />
        </Field>
        <Field>
          <FieldLabel htmlFor="identity-context">Contexto da conta externa</FieldLabel>
          <Input id="identity-context" value={accountContext} readOnly={readOnly} onChange={(e) => setAccountContext(e.target.value)} className="max-lg:h-11" />
        </Field>
        <Field>
          <FieldLabel htmlFor="identity-logo">URL do logo</FieldLabel>
          <Input id="identity-logo" type="url" inputMode="url" value={logoUrl} readOnly={readOnly} onChange={(e) => setLogoUrl(e.target.value)} className="max-lg:h-11" />
        </Field>
        <Field>
          <FieldLabel htmlFor="identity-logo-alt">Texto alternativo do logo</FieldLabel>
          <Input id="identity-logo-alt" value={logoAltText} readOnly={readOnly} onChange={(e) => setLogoAltText(e.target.value)} className="max-lg:h-11" />
        </Field>
      </FieldGroup>
      {canManage && (
        <Button type="button" onClick={save} disabled={!canSave} className="self-start max-lg:h-11">
          Salvar identidade
        </Button>
      )}
    </section>
  )
}
