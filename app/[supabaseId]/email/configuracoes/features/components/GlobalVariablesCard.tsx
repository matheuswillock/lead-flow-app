"use client"

import { useState } from "react"
import { Braces, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react"
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
import type { EmailGlobalVariable } from "../context/EmailSettingsTypes"
import { EmailSettingsSectionCard } from "./EmailSettingsSectionCard"

function sanitizeKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_]/g, "")
}

type VariableFormProps = {
  initialValue?: UpsertEmailVariableData
  loading: boolean
  submitLabel: string
  onSubmit: (data: UpsertEmailVariableData) => Promise<void>
  onCancel?: () => void
}

function VariableForm({ initialValue, loading, submitLabel, onSubmit, onCancel }: VariableFormProps) {
  const [key, setKey] = useState(initialValue?.key ?? "")
  const [type, setType] = useState<"string" | "number">(initialValue?.type ?? "string")
  const [defaultValue, setDefaultValue] = useState(initialValue?.defaultValue ?? "")
  const [description, setDescription] = useState(initialValue?.description ?? "")

  const isDisabled = loading || !key.trim()

  return (
    <form
      className="flex flex-col gap-5 rounded-2xl border border-border/70 bg-[color:var(--surface-1)] p-5"
      onSubmit={(event) => {
        event.preventDefault()
        void onSubmit({
          key: sanitizeKey(key),
          type,
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

        <Field>
          <FieldLabel htmlFor="variable-default">Valor padrão</FieldLabel>
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
          </div>
          {variable.description ? (
            <p className="truncate text-sm text-muted-foreground">{variable.description}</p>
          ) : null}
          <p className="truncate text-xs text-muted-foreground">
            Valor padrão: {variable.defaultValue ? variable.defaultValue : "—"}
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
