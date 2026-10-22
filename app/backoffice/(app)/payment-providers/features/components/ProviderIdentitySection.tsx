"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useBackofficePaymentProviders } from "../context/BackofficePaymentProvidersContext"
import type { ProviderInstanceView } from "../context/BackofficePaymentProvidersTypes"
import { DISABLED_PRIMARY_CLASS } from "./providerButtonStyles"

type IdentityField = "displayName" | "externalAccountContext" | "logoUrl" | "logoAltText"
type IdentityDraft = Partial<Record<IdentityField, string>>

function currentValue(instance: ProviderInstanceView, field: IdentityField): string {
  return instance[field] ?? ""
}

/**
 * O rascunho guarda só os campos editados: depois de um 409 (dados recarregados) o que
 * a pessoa digitou continua valendo e o resto acompanha a versão nova do servidor.
 */
export function ProviderIdentitySection({ instance }: { instance: ProviderInstanceView }) {
  const { canManage, busyInstanceId, updateInstance } = useBackofficePaymentProviders()
  const [draft, setDraft] = useState<IdentityDraft>({})

  const editedFields = (Object.keys(draft) as IdentityField[]).filter(
    (field) => draft[field] !== currentValue(instance, field)
  )
  const valueOf = (field: IdentityField) => draft[field] ?? currentValue(instance, field)
  const canSave = canManage && editedFields.length > 0 && busyInstanceId === null && valueOf("displayName").trim() !== ""
  const readOnly = !canManage

  async function save() {
    if (!canSave) return
    const patch: Partial<Record<IdentityField, string>> = {}
    for (const field of editedFields) patch[field] = (draft[field] ?? "").trim()
    const saved = await updateInstance(instance, patch, "Identidade atualizada")
    if (saved) setDraft({})
  }

  function fieldProps(field: IdentityField) {
    return {
      value: valueOf(field),
      readOnly,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft((prev) => ({ ...prev, [field]: e.target.value })),
      className: "max-lg:h-11",
    }
  }

  return (
    <section aria-labelledby="provider-identity-title" className="flex flex-col gap-3">
      <h3 id="provider-identity-title" className="text-sm font-semibold">
        Identidade
      </h3>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="identity-name">Nome exibido</FieldLabel>
          <Input id="identity-name" {...fieldProps("displayName")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="identity-context">Contexto da conta externa</FieldLabel>
          <Input id="identity-context" {...fieldProps("externalAccountContext")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="identity-logo">URL do logo</FieldLabel>
          <Input id="identity-logo" type="url" inputMode="url" {...fieldProps("logoUrl")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="identity-logo-alt">Texto alternativo do logo</FieldLabel>
          <Input id="identity-logo-alt" {...fieldProps("logoAltText")} />
        </Field>
      </FieldGroup>
      {canManage && (
        <Button
          type="button"
          onClick={save}
          disabled={!canSave}
          className={cn("self-start max-lg:h-11", DISABLED_PRIMARY_CLASS)}
        >
          Salvar identidade
        </Button>
      )}
    </section>
  )
}
