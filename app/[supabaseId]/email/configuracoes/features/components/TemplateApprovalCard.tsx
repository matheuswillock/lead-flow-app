"use client"

import { AlertCircle, Lock, Shield } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Switch } from "@/components/ui/switch"
import { useEmailSettingsContext } from "../context/EmailSettingsContext"
import { EmailSettingsSectionCard } from "./EmailSettingsSectionCard"

const roles = [
  { value: "manager", label: "Manager", description: "Aprovação estratégica e decisão final." },
  { value: "backoffice", label: "Backoffice", description: "Triagem operacional e conformidade." },
  { value: "operator", label: "Operador", description: "Revisão em fluxos menores ou times enxutos." },
] as const

export function TemplateApprovalCard() {
  const {
    loading,
    saving,
    templateApprovalRequired,
    templateApprovalRoles,
    setTemplateApprovalRequired,
    toggleTemplateApprovalRole,
  } = useEmailSettingsContext()

  return (
    <EmailSettingsSectionCard
      icon={Lock}
      title="Aprovação de templates"
      description="Controle se templates criados por operadores precisam passar por aprovação antes do uso."
      contentClassName="flex flex-col gap-6"
    >
      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <Field orientation="horizontal" className="items-start rounded-2xl border border-border/60 bg-[color:var(--surface-1)] p-5">
            <Switch
              id="template-approval-required"
              checked={templateApprovalRequired}
              onCheckedChange={setTemplateApprovalRequired}
              disabled={saving}
            />
            <FieldContent>
              <FieldLabel htmlFor="template-approval-required">Exigir aprovação antes do uso</FieldLabel>
              <FieldDescription>
                Quando ativo, novos templates de operadores ficam retidos até aprovação.
              </FieldDescription>
            </FieldContent>
          </Field>

          <FieldSeparator />

          <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-[color:var(--surface-1)] p-5">
            <div className="flex flex-col gap-1">
              <FieldTitle>Roles aprovadoras</FieldTitle>
              <FieldDescription>Escolha quem pode aprovar templates pendentes dentro do time.</FieldDescription>
            </div>

            <FieldGroup className="gap-3">
              {roles.map((role) => {
                const checked = templateApprovalRoles.includes(role.value)

                return (
                  <Field key={role.value} orientation="horizontal" className="items-start rounded-xl border border-border/60 bg-background/80 p-3">
                    <Checkbox
                      id={`template-approval-role-${role.value}`}
                      checked={checked}
                      onCheckedChange={() => toggleTemplateApprovalRole(role.value)}
                      disabled={saving || !templateApprovalRequired}
                      className="mt-0.5"
                    />
                    <FieldContent>
                      <FieldLabel htmlFor={`template-approval-role-${role.value}`}>{role.label}</FieldLabel>
                      <FieldDescription>{role.description}</FieldDescription>
                    </FieldContent>
                  </Field>
                )
              })}
            </FieldGroup>
          </div>

          <Alert className="border-semantic-warning/30 bg-semantic-warning-surface text-foreground">
            <AlertCircle className="size-4 text-semantic-warning" />
            <AlertTitle className="font-[family-name:var(--font-poppins)] text-sm font-semibold">
              Template aguardando aprovação
            </AlertTitle>
            <AlertDescription className="text-sm leading-6 text-muted-foreground">
              Exemplo visual da fila: <strong>João Silva (Operador)</strong> submeteu o template <em>Boas-vindas Premium</em> para revisão. Nesta etapa, o bloco é apenas representativo e não consulta pendências reais.
            </AlertDescription>
          </Alert>

          <Field orientation="horizontal" className="items-start rounded-2xl border border-dashed border-border bg-background/70 p-4">
            <Shield className="mt-0.5 size-4 text-primary" />
            <FieldContent>
              <FieldTitle>Governança recomendada</FieldTitle>
              <FieldDescription>
                Mantenha pelo menos uma role de gestão entre os aprovadores para evitar templates liberados sem revisão final.
              </FieldDescription>
            </FieldContent>
          </Field>
        </>
      )}
    </EmailSettingsSectionCard>
  )
}
