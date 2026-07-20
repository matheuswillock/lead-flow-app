"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { useTeamContext } from "@/app/context/TeamContext"
import { cdpService } from "@/app/[supabaseId]/cdp/features/services/CdpService"
import { Braces, ChevronDown, ChevronUp, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import type { UpsertEmailVariableData } from "../services/IEmailSettingsService"
import { useEmailSettingsContext } from "../context/EmailSettingsContext"
import type { EmailGlobalVariable, EmailVariableValueSource } from "../context/EmailSettingsTypes"
import { EmailSettingsSectionCard } from "./EmailSettingsSectionCard"

type RadarFieldOption = {
  key: string
  label: string
  sourceType: string
}

function sanitizeKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_]/g, "")
}

function useRadarFieldOptions() {
  const params = useParams()
  const supabaseId = params.supabaseId as string
  const { activeTeamId } = useTeamContext()
  const [fields, setFields] = useState<RadarFieldOption[]>([])

  useEffect(() => {
    if (!supabaseId || !activeTeamId) return

    let active = true
    void cdpService
      .listAvailableFields(supabaseId, activeTeamId)
      .then((items) => {
        if (active) setFields(items)
      })
      .catch(() => {
        if (active) setFields([])
      })
    return () => {
      active = false
    }
  }, [activeTeamId, supabaseId])

  const grouped = useMemo(() => {
    const groups = new Map<string, RadarFieldOption[]>()
    for (const field of fields) {
      const list = groups.get(field.sourceType) ?? []
      list.push(field)
      groups.set(field.sourceType, list)
    }
    return groups
  }, [fields])

  return { fields, grouped, hasRadar: fields.length > 0 }
}

type RadarProfileOption = { id: string; displayName: string; primaryEmail: string | null }

function useRadarProfileOptions() {
  const params = useParams()
  const supabaseId = params.supabaseId as string
  const { activeTeamId } = useTeamContext()
  const [profiles, setProfiles] = useState<RadarProfileOption[]>([])

  useEffect(() => {
    if (!supabaseId || !activeTeamId) return

    let active = true
    void cdpService
      .listProfiles(supabaseId, activeTeamId, { page: 1, pageSize: 20 })
      .then((result) => {
        if (!active) return
        setProfiles(
          result.items.map((item) => ({
            id: item.id,
            displayName: item.displayName,
            primaryEmail: item.primaryEmail,
          }))
        )
      })
      .catch(() => {
        if (active) setProfiles([])
      })
    return () => {
      active = false
    }
  }, [activeTeamId, supabaseId])

  return profiles
}

function RadarInterpolationPreview({ variableKey }: { variableKey: string }) {
  const params = useParams()
  const supabaseId = params.supabaseId as string
  const { activeTeamId } = useTeamContext()
  const profiles = useRadarProfileOptions()
  const [profileId, setProfileId] = useState("")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resolvedValue, setResolvedValue] = useState<string | null>(null)

  if (!variableKey.trim()) return null

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border/70 p-4">
      <Button
        type="button"
        variant="ghost"
        className="h-auto justify-between px-0"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="text-sm font-medium">Testar interpolação</span>
        {open ? <ChevronUp data-icon="inline-end" /> : <ChevronDown data-icon="inline-end" />}
      </Button>
      {open ? (
        <div className="flex flex-col gap-3">
          <Select value={profileId || "__none"} onValueChange={(value) => setProfileId(value === "__none" ? "" : value)}>
            <SelectTrigger>
              <SelectValue placeholder="Perfil CDP" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Selecione um perfil...</SelectItem>
              {profiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.displayName}
                  {profile.primaryEmail ? ` (${profile.primaryEmail})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            disabled={!profileId || loading}
            onClick={() => {
              if (!supabaseId || !activeTeamId) return
              setLoading(true)
              void cdpService
                .previewInterpolation(supabaseId, activeTeamId, {
                  profileId,
                  variableKeys: [variableKey],
                })
                .then((result) => {
                  setResolvedValue(result.values[variableKey] ?? "")
                })
                .catch(() => {
                  setResolvedValue(null)
                })
                .finally(() => setLoading(false))
            }}
          >
            {loading ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
            Preview
          </Button>
          {resolvedValue !== null ? (
            <div className="rounded-md border p-3 text-sm">
              <p className="font-mono text-xs text-muted-foreground">{`{{${variableKey}}}`}</p>
              <p className="mt-1 font-medium">{resolvedValue || "—"}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

type VariableFormProps = {
  initialValue?: UpsertEmailVariableData
  loading: boolean
  submitLabel: string
  onSubmit: (data: UpsertEmailVariableData) => Promise<void>
  onCancel?: () => void
}

function VariableForm({ initialValue, loading, submitLabel, onSubmit, onCancel }: VariableFormProps) {
  const { fields, grouped, hasRadar } = useRadarFieldOptions()
  const [key, setKey] = useState(initialValue?.key ?? "")
  const [type, setType] = useState<"string" | "number">(initialValue?.type ?? "string")
  const [valueSource, setValueSource] = useState<EmailVariableValueSource>(
    initialValue?.valueSource ?? "STATIC"
  )
  const [radarFieldKey, setRadarFieldKey] = useState(initialValue?.radarFieldKey ?? "")
  const [defaultValue, setDefaultValue] = useState(initialValue?.defaultValue ?? "")
  const [description, setDescription] = useState(initialValue?.description ?? "")

  const isDisabled =
    loading ||
    !key.trim() ||
    (valueSource === "RADAR" && !radarFieldKey.trim())

  const selectedFieldLabel = fields.find((field) => field.key === radarFieldKey)?.label

  return (
    <form
      className="flex flex-col gap-5 rounded-2xl border border-border/70 bg-[color:var(--surface-1)] p-5"
      onSubmit={(event) => {
        event.preventDefault()
        void onSubmit({
          key: sanitizeKey(key),
          type,
          valueSource,
          radarFieldKey: valueSource === "RADAR" ? radarFieldKey : null,
          defaultValue: defaultValue.trim() ? defaultValue : null,
          description: description.trim() ? description : null,
        })
      }}
    >
      <FieldGroup className="gap-5">
        <Field>
          <FieldLabel htmlFor="variable-key">Chave da variável</FieldLabel>
          <FieldContent>
            <Input
              id="variable-key"
              value={key}
              onChange={(event) => setKey(sanitizeKey(event.target.value))}
              disabled={loading}
              className="font-mono"
              placeholder="Ex: corretora_nome"
            />
            <FieldDescription>
              Use <code className="rounded bg-muted px-1 font-mono text-[11px]">{`{{${key.trim() || "chave"}}}`}</code> no HTML do template.
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="variable-type">Tipo</FieldLabel>
          <FieldContent>
            <Select value={type} onValueChange={(value) => setType(value as "string" | "number")}>
              <SelectTrigger id="variable-type" className="w-40" disabled={loading}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="string">Texto</SelectItem>
                <SelectItem value="number">Número</SelectItem>
              </SelectContent>
            </Select>
          </FieldContent>
        </Field>

        {hasRadar ? (
          <Field>
            <FieldLabel htmlFor="variable-source">Origem do valor</FieldLabel>
            <FieldContent>
              <Select
                value={valueSource}
                onValueChange={(value) => {
                  const next = value as EmailVariableValueSource
                  setValueSource(next)
                  if (next === "STATIC") setRadarFieldKey("")
                }}
              >
                <SelectTrigger id="variable-source" className="w-full" disabled={loading}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STATIC">Estático (mesmo valor para todos)</SelectItem>
                  <SelectItem value="RADAR">Radar (por destinatário)</SelectItem>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>
        ) : null}

        {valueSource === "RADAR" && hasRadar ? (
          <Field>
            <FieldLabel htmlFor="variable-cdp-field">Campo do Radar</FieldLabel>
            <FieldContent>
              <Select value={radarFieldKey || "__none"} onValueChange={(value) => setRadarFieldKey(value === "__none" ? "" : value)}>
                <SelectTrigger id="variable-cdp-field" className="w-full" disabled={loading}>
                  <SelectValue placeholder="Selecione o campo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Selecione...</SelectItem>
                  {[...grouped.entries()].map(([sourceType, items]) => (
                    <div key={sourceType}>
                      {items.map((field) => (
                        <SelectItem key={field.key} value={field.key}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
              {selectedFieldLabel ? (
                <FieldDescription>Valor vindo de: {selectedFieldLabel}</FieldDescription>
              ) : null}
            </FieldContent>
          </Field>
        ) : null}

        <Field>
          <FieldLabel htmlFor="variable-default">
            {valueSource === "RADAR" ? "Fallback quando vazio" : "Valor padrão"}
          </FieldLabel>
          <FieldContent>
            <Input
              id="variable-default"
              value={defaultValue}
              onChange={(event) => setDefaultValue(event.target.value)}
              disabled={loading}
              placeholder="Usado quando o destinatário não tem o valor"
            />
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="variable-description">Descrição</FieldLabel>
          <FieldContent>
            <Input
              id="variable-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={loading}
              placeholder="Opcional. Explica o uso da variável"
            />
          </FieldContent>
        </Field>
      </FieldGroup>

      {valueSource === "RADAR" && key.trim() ? <RadarInterpolationPreview variableKey={sanitizeKey(key)} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isDisabled}>
          {loading ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  )
}

function VariableRow({
  variable,
  isUpdating,
  isDeleting,
  onUpdate,
  onDelete,
}: {
  variable: EmailGlobalVariable
  isUpdating: boolean
  isDeleting: boolean
  onUpdate: (data: UpsertEmailVariableData) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/80 p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm font-semibold text-foreground">
              {`{{${variable.key}}}`}
            </code>
            <Badge variant="outline" className="text-muted-foreground">
              {variable.type === "number" ? "Número" : "Texto"}
            </Badge>
            {variable.valueSource === "RADAR" ? (
              <Badge variant="secondary">Radar</Badge>
            ) : (
              <Badge variant="outline">Estático</Badge>
            )}
          </div>
          {variable.valueSource === "RADAR" && variable.radarFieldKey ? (
            <p className="text-xs text-muted-foreground">Campo Radar: {variable.radarFieldKey}</p>
          ) : null}
          {variable.description ? (
            <p className="truncate text-sm text-muted-foreground">{variable.description}</p>
          ) : null}
          <p className="truncate text-xs text-muted-foreground">
            {variable.valueSource === "RADAR" ? "Fallback" : "Valor padrão"}:{" "}
            {variable.defaultValue ? variable.defaultValue : "—"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing((current) => !current)}
            disabled={isUpdating || isDeleting}
          >
            <Pencil data-icon="inline-start" />
            Editar
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="ghost" size="sm" disabled={isUpdating || isDeleting}>
                <Trash2 data-icon="inline-start" />
                Remover
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover variável global</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso removerá a variável <strong>{`{{${variable.key}}}`}</strong>. Templates que a utilizam deixarão de substituí-la automaticamente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => void onDelete()}>Remover</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {editing ? (
        <VariableForm
          initialValue={{
            key: variable.key,
            type: variable.type,
            valueSource: variable.valueSource,
            radarFieldKey: variable.radarFieldKey,
            defaultValue: variable.defaultValue,
            description: variable.description,
          }}
          loading={isUpdating}
          submitLabel="Salvar alterações"
          onSubmit={async (data) => {
            await onUpdate(data)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      ) : null}
    </div>
  )
}

export function GlobalVariablesCard() {
  const {
    loading,
    globalVariables,
    creatingVariable,
    updatingVariableId,
    deletingVariableId,
    handleCreateVariable,
    handleUpdateVariable,
    handleDeleteVariable,
  } = useEmailSettingsContext()
  const [adding, setAdding] = useState(false)

  return (
    <EmailSettingsSectionCard
      icon={Braces}
      title="Variáveis globais"
      description="Crie variáveis reutilizáveis em qualquer template de e-mail do time. Use a sintaxe {{chave}} no conteúdo."
      contentClassName="flex flex-col gap-5"
    >
      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">Lista de variáveis</p>
              <p className="text-sm text-muted-foreground">
                {globalVariables.length}{" "}
                {globalVariables.length === 1 ? "variável cadastrada" : "variáveis cadastradas"}
              </p>
            </div>
            <Button type="button" onClick={() => setAdding((current) => !current)} disabled={creatingVariable}>
              {creatingVariable ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin" />
              ) : (
                <Plus data-icon="inline-start" />
              )}
              Adicionar variável
            </Button>
          </div>

          {adding ? (
            <VariableForm
              loading={creatingVariable}
              submitLabel="Salvar variável"
              onSubmit={async (data) => {
                await handleCreateVariable(data)
                setAdding(false)
              }}
              onCancel={() => setAdding(false)}
            />
          ) : null}

          {globalVariables.length === 0 && !adding ? (
            <div className="rounded-2xl border border-dashed border-border bg-[color:var(--surface-1)] p-5 text-sm text-muted-foreground">
              Nenhuma variável global cadastrada. Crie variáveis como <code className="rounded bg-muted px-1 font-mono text-[11px]">{"{{corretora_nome}}"}</code> para reutilizá-las em todos os templates.
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            {globalVariables.map((variable) => (
              <VariableRow
                key={variable.id}
                variable={variable}
                isUpdating={updatingVariableId === variable.id}
                isDeleting={deletingVariableId === variable.id}
                onUpdate={(data) => handleUpdateVariable(variable.id, data)}
                onDelete={() => handleDeleteVariable(variable.id)}
              />
            ))}
          </div>
        </>
      )}
    </EmailSettingsSectionCard>
  )
}
