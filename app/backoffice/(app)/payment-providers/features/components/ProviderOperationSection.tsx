"use client"

import { Activity, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ProviderSwitch } from "./ProviderSwitch"
import { useBackofficePaymentProviders } from "../context/BackofficePaymentProvidersContext"
import {
  ENVIRONMENT_LABELS,
  HEALTH_LABELS,
  ROLLOUT_LABELS,
  ROLLOUT_STATES,
  type ProviderInstanceView,
  type ProviderRolloutState,
} from "../context/BackofficePaymentProvidersTypes"
import { canMakeDefault, getApplicableSettings, getDefaultBlockers } from "../utils/providerInstanceRules"
import type { PendingConfirmation } from "./ConfirmActionDialog"

interface Props {
  instance: ProviderInstanceView
  onRequestConfirmation: (pending: PendingConfirmation) => void
}

function formatDate(value: string | null): string {
  if (!value) return "nunca"
  return new Date(value).toLocaleString("pt-BR")
}

export function ProviderOperationSection({ instance, onRequestConfirmation }: Props) {
  const { canManage, busyInstanceId, currentDefault, updateInstance, runHealthCheck } =
    useBackofficePaymentProviders()
  const isBusy = busyInstanceId !== null
  const blockers = getDefaultBlockers(instance)
  const isDefaultAllowed = canMakeDefault(instance)
  const applicableSettings = getApplicableSettings(instance)

  function confirmMakeDefault() {
    const replaced = currentDefault && currentDefault.id !== instance.id ? currentDefault : null
    onRequestConfirmation({
      title: `Tornar “${instance.displayName}” o padrão?`,
      description: replaced
        ? `Novos pagamentos em ${ENVIRONMENT_LABELS[instance.environment]} passam a usar esta instância. O padrão atual é “${replaced.displayName}” e deixará de ser o padrão.`
        : `Novos pagamentos em ${ENVIRONMENT_LABELS[instance.environment]} passam a usar esta instância. Hoje não há padrão definido.`,
      confirmLabel: "Tornar padrão",
      run: () => updateInstance(instance, { isDefault: true }, "Padrão atualizado"),
    })
  }

  function confirmRollout(next: ProviderRolloutState) {
    if (next === instance.rolloutState) return
    onRequestConfirmation({
      title: "Alterar estado de rollout?",
      description: `De “${ROLLOUT_LABELS[instance.rolloutState]}” para “${ROLLOUT_LABELS[next]}”.`,
      confirmLabel: "Alterar rollout",
      run: () => updateInstance(instance, { rolloutState: next }, "Rollout atualizado"),
    })
  }

  function confirmKillSwitch(next: boolean) {
    onRequestConfirmation({
      title: next ? "Ativar o kill switch?" : "Desativar o kill switch?",
      description: next
        ? "O roteador deixa de usar esta instância imediatamente."
        : "O roteador volta a poder usar esta instância, conforme o rollout.",
      confirmLabel: next ? "Ativar kill switch" : "Desativar kill switch",
      run: () => updateInstance(instance, { killSwitch: next }, "Kill switch atualizado"),
    })
  }

  return (
    <section aria-labelledby="provider-operation-title" className="flex flex-col gap-3">
      <h3 id="provider-operation-title" className="text-sm font-semibold">
        Operação
      </h3>
      <p className="text-xs text-muted-foreground">
        Saúde: {HEALTH_LABELS[instance.healthStatus]} · última verificação {formatDate(instance.lastHealthCheckAt)}
        {instance.lastErrorCode ? ` · último erro ${instance.lastErrorCode}` : ""}
      </p>
      {canManage && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button type="button" variant="outline" disabled={isBusy} onClick={() => runHealthCheck(instance)} className="max-lg:h-11">
            <Activity data-icon="inline-start" />
            Verificar saúde
          </Button>
          <Button
            type="button"
            variant={isDefaultAllowed ? "default" : "outline"}
            disabled={isBusy || !isDefaultAllowed}
            onClick={confirmMakeDefault}
            className="max-lg:h-11"
          >
            <Star data-icon="inline-start" />
            Tornar padrão
          </Button>
        </div>
      )}
      {instance.isDefault ? (
        <p className="text-xs text-muted-foreground" data-testid="make-default-reason">
          Esta instância já é o padrão do ambiente.
        </p>
      ) : (
        blockers.length > 0 && (
          <div className="flex flex-col gap-1 text-xs text-muted-foreground" data-testid="make-default-reason">
            <p className="font-medium text-foreground">Para tornar padrão, resolva:</p>
            <ul className="flex list-disc flex-col gap-0.5 pl-4">
              {blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </div>
        )
      )}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="operation-rollout">Rollout</FieldLabel>
          <Select
            value={instance.rolloutState}
            onValueChange={(v) => confirmRollout(v as ProviderRolloutState)}
            disabled={!canManage || isBusy}
          >
            <SelectTrigger id="operation-rollout" className="max-lg:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLLOUT_STATES.map((state) => (
                <SelectItem key={state} value={state}>
                  {ROLLOUT_LABELS[state]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <ToggleField
          id="operation-kill-switch"
          label="Kill switch"
          description="Bloqueia o uso da instância de imediato."
          checked={instance.killSwitch}
          disabled={!canManage || isBusy}
          onChange={confirmKillSwitch}
        />
        {applicableSettings.includes("requireSignature") && (
          <ToggleField
            id="operation-require-signature"
            label="Exigir assinatura do webhook"
            description="Rejeita eventos sem assinatura HMAC válida."
            checked={instance.settings.requireSignature}
            disabled={!canManage || isBusy}
            onChange={(next) =>
              updateInstance(instance, { settings: { requireSignature: next } }, "Configuração atualizada")
            }
          />
        )}
        {applicableSettings.includes("cardEnabled") && (
          <ToggleField
            id="operation-card-enabled"
            label="Cartão habilitado"
            description="Oferece cartão de crédito no checkout desta instância."
            checked={instance.settings.cardEnabled}
            disabled={!canManage || isBusy}
            onChange={(next) =>
              updateInstance(instance, { settings: { cardEnabled: next } }, "Configuração atualizada")
            }
          />
        )}
      </FieldGroup>
    </section>
  )
}

function ToggleField({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  disabled: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <Field orientation="horizontal" className="max-lg:min-h-11">
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
      <ProviderSwitch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </Field>
  )
}
