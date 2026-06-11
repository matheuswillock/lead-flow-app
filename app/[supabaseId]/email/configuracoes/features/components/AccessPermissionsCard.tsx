"use client"

import { ShieldCheck } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldTitle,
} from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { useEmailSettingsContext } from "../context/EmailSettingsContext"
import { EmailSettingsSectionCard } from "./EmailSettingsSectionCard"

const roles = [
  { value: "manager", label: "Manager", description: "Controle total da operação de e-mail." },
  { value: "backoffice", label: "Backoffice", description: "Suporte operacional e revisão interna." },
  { value: "operator", label: "Operador", description: "Execução assistida do fluxo comercial." },
] as const

type RoleValue = (typeof roles)[number]["value"]

function RoleChecklist({
  title,
  description,
  selectedRoles,
  disabled,
  onToggle,
  idPrefix,
}: {
  title: string
  description: string
  selectedRoles: string[]
  disabled: boolean
  onToggle: (role: RoleValue) => void
  idPrefix: string
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-[color:var(--surface-1)] p-5">
      <div className="flex flex-col gap-1">
        <p className="font-[family-name:var(--font-poppins)] text-sm font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <FieldGroup className="gap-3">
        {roles.map((role) => {
          const fieldId = `${idPrefix}-${role.value}`
          const checked = selectedRoles.includes(role.value)

          return (
            <Field key={role.value} orientation="horizontal" className="items-start rounded-xl border border-border/60 bg-background/80 p-3">
              <Checkbox
                id={fieldId}
                checked={checked}
                onCheckedChange={() => onToggle(role.value)}
                disabled={disabled}
                className="mt-0.5"
              />
              <FieldContent>
                <FieldLabel htmlFor={fieldId}>{role.label}</FieldLabel>
                <FieldDescription>{role.description}</FieldDescription>
              </FieldContent>
            </Field>
          )
        })}
      </FieldGroup>
    </div>
  )
}

export function AccessPermissionsCard() {
  const {
    loading,
    saving,
    dispatchAllowedRoles,
    templateCreateRoles,
    toggleDispatchRole,
    toggleTemplateCreateRole,
  } = useEmailSettingsContext()

  return (
    <EmailSettingsSectionCard
      icon={ShieldCheck}
      title="Permissões de acesso"
      description="Defina quem pode disparar campanhas e quem pode criar templates dentro do time."
      contentClassName="flex flex-col gap-6"
    >
      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <RoleChecklist
              title="Quem pode disparar campanhas"
              description="Esses perfis conseguem iniciar envios e operar campanhas."
              selectedRoles={dispatchAllowedRoles}
              disabled={saving}
              onToggle={toggleDispatchRole}
              idPrefix="dispatch"
            />
            <RoleChecklist
              title="Quem pode criar templates"
              description="Esses perfis conseguem cadastrar e editar templates."
              selectedRoles={templateCreateRoles}
              disabled={saving}
              onToggle={toggleTemplateCreateRole}
              idPrefix="template-create"
            />
          </div>

          <FieldSeparator />

          <Field>
            <FieldTitle>Regra operacional</FieldTitle>
            <FieldDescription>
              Managers continuam sendo a referência para governança, enquanto backoffice e operadores recebem acesso conforme a rotina do time.
            </FieldDescription>
          </Field>
        </>
      )}
    </EmailSettingsSectionCard>
  )
}
