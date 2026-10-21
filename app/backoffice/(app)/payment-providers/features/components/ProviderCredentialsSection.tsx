"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useBackofficePaymentProviders } from "../context/BackofficePaymentProvidersContext"
import type { ProviderInstanceView } from "../context/BackofficePaymentProvidersTypes"
import { buildCredentialRows, type CredentialRow } from "../utils/providerInstanceRules"
import type { PendingConfirmation } from "./ConfirmActionDialog"

interface Props {
  instance: ProviderInstanceView
  onRequestConfirmation: (pending: PendingConfirmation) => void
}

export function ProviderCredentialsSection({ instance, onRequestConfirmation }: Props) {
  const { adapters, canManage, busyInstanceId, setCredential, removeCredential } =
    useBackofficePaymentProviders()
  const adapter = adapters.find((a) => a.providerKey === instance.providerKey)
  const rows = buildCredentialRows(instance, adapter)
  const isBusy = busyInstanceId !== null

  return (
    <section aria-labelledby="provider-credentials-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 id="provider-credentials-title" className="text-sm font-semibold">
          Credenciais
        </h3>
        <p className="text-xs text-muted-foreground">
          {canManage
            ? "Os valores são write-only: depois de salvos nunca voltam ao navegador. Campo vazio não altera nada."
            : "Visualização mascarada. Apenas gestores podem alterar credenciais."}
        </p>
      </div>
      <FieldGroup>
        {rows.map((row) => (
          <CredentialField
            key={row.key}
            row={row}
            canManage={canManage}
            isBusy={isBusy}
            onSave={(value) => setCredential(instance, row.key, value)}
            onRemove={() =>
              onRequestConfirmation({
                title: `Remover ${row.label}?`,
                description:
                  "O valor será apagado do cofre e não poderá ser recuperado. Cadastre outro valor para voltar a usar esta credencial.",
                confirmLabel: "Remover credencial",
                run: () => removeCredential(instance, row.key),
              })
            }
          />
        ))}
      </FieldGroup>
    </section>
  )
}

interface CredentialFieldProps {
  row: CredentialRow
  canManage: boolean
  isBusy: boolean
  onSave: (value: string) => Promise<boolean>
  onRemove: () => void
}

function CredentialField({ row, canManage, isBusy, onSave, onRemove }: CredentialFieldProps) {
  const [draft, setDraft] = useState("")
  const inputId = `credential-${row.key}`

  async function save() {
    if (draft.length === 0 || isBusy) return
    const saved = await onSave(draft)
    if (saved) setDraft("")
  }

  return (
    <Field>
      <div className="flex flex-wrap items-center gap-2">
        <FieldLabel htmlFor={inputId}>{row.label}</FieldLabel>
        {row.required && <Badge variant="outline">Obrigatória</Badge>}
        <Badge variant={row.isSet ? "secondary" : "outline"}>{row.isSet ? "Definida" : "Não definida"}</Badge>
      </div>
      {row.isSet && (
        <p className="text-xs text-muted-foreground">
          {row.last4 ? `Termina em ${row.last4}` : "Valor oculto"}
          {row.fingerprint ? ` · impressão ${row.fingerprint}` : ""}
        </p>
      )}
      {canManage ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id={inputId}
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={row.isSet ? "•••• (já definido)" : "Informe o valor"}
            className="max-lg:h-11"
          />
          <Button type="button" onClick={save} disabled={draft.length === 0 || isBusy} className="max-lg:h-11">
            {row.isSet ? "Rotacionar" : "Salvar"}
          </Button>
          {row.isSet && (
            <Button
              type="button"
              variant="outline"
              onClick={onRemove}
              disabled={isBusy}
              className="max-lg:h-11"
              aria-label={`Remover ${row.label}`}
            >
              <Trash2 data-icon="inline-start" />
              Remover
            </Button>
          )}
        </div>
      ) : (
        <Input id={inputId} value={row.isSet ? "•••• (já definido)" : "Não definida"} readOnly disabled />
      )}
      {row.hint && <FieldDescription>{row.hint}</FieldDescription>}
    </Field>
  )
}
