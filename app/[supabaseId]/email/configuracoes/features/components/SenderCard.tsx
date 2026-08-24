"use client"

import { useMemo, useState } from "react"
import {
  CheckCircle2,
  LoaderCircle,
  Mail,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react"
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
import { Skeleton } from "@/components/ui/skeleton"
import type { UpsertEmailSenderData } from "../services/IEmailSettingsService"
import { useEmailSettingsContext } from "../context/EmailSettingsContext"
import type { EmailSender } from "../context/EmailSettingsTypes"
import { EmailSettingsSectionCard } from "./EmailSettingsSectionCard"
import { isResendDomainSendCapable } from "@/lib/email/campaign-dispatch-guards"
import { buildDeliveryFromEmail } from "@/lib/email/resolve-campaign-from"

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

type SenderFormProps = {
  initialValue?: UpsertEmailSenderData
  loading: boolean
  submitLabel: string
  lockEmail?: boolean
  onSubmit: (data: UpsertEmailSenderData) => Promise<void>
  onCancel?: () => void
}

function SenderForm({
  initialValue,
  loading,
  submitLabel,
  lockEmail = false,
  onSubmit,
  onCancel,
}: SenderFormProps) {
  const [name, setName] = useState(initialValue?.name ?? "")
  const [email, setEmail] = useState(initialValue?.email ?? "")
  const [replyTo, setReplyTo] = useState(initialValue?.replyTo ?? "")

  const isDisabled = loading || !name.trim() || !email.trim()

  return (
    <form
      className="flex flex-col gap-5 rounded-2xl border border-border/70 bg-[color:var(--surface-1)] p-5"
      onSubmit={(event) => {
        event.preventDefault()
        void onSubmit({
          name,
          email,
          replyTo: replyTo.trim() ? replyTo : null,
        })
      }}
    >
      <FieldGroup className="gap-5">
        <Field>
          <FieldLabel htmlFor="sender-name">Nome do remetente</FieldLabel>
          <FieldContent>
            <Input
              id="sender-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={loading}
              placeholder="Ex: Corretor Studio"
            />
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="sender-email">E-mail do remetente</FieldLabel>
          <FieldContent>
            <Input
              id="sender-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={loading || lockEmail}
              placeholder="Ex: contato@mail.suaempresa.com.br"
            />
            {lockEmail ? (
              <FieldDescription>
                Verifique um domínio nas configurações antes de alterar o e-mail do remetente.
              </FieldDescription>
            ) : null}
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="sender-reply-to">Reply-to</FieldLabel>
          <FieldContent>
            <Input
              id="sender-reply-to"
              type="email"
              value={replyTo}
              onChange={(event) => setReplyTo(event.target.value)}
              disabled={loading}
              placeholder="Ex: contato@empresa.com.br"
            />
            <FieldDescription>Opcional. Define para onde as respostas dos destinatários serão enviadas.</FieldDescription>
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

function SenderRow({
  sender,
  isUpdating,
  isDeleting,
  isSettingDefault,
  lockEmail,
  onUpdate,
  onDelete,
  onSetDefault,
}: {
  sender: EmailSender
  isUpdating: boolean
  isDeleting: boolean
  isSettingDefault: boolean
  lockEmail: boolean
  onUpdate: (data: UpsertEmailSenderData) => Promise<void>
  onDelete: () => Promise<void>
  onSetDefault: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/80 p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 font-[family-name:var(--font-poppins)] text-sm font-semibold text-primary">
          {getInitials(sender.name)}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-[family-name:var(--font-poppins)] text-sm font-semibold text-foreground">
              {sender.name}
            </p>
            {sender.isDefault ? (
              <Badge variant="outline" className="gap-1 border-semantic-success/30 bg-semantic-success/10 text-semantic-success">
                <CheckCircle2 className="size-3" />
                Padrão
              </Badge>
            ) : null}
          </div>
          <p className="truncate text-sm text-muted-foreground">{sender.email}</p>
          {sender.replyTo ? (
            <p className="truncate text-xs text-muted-foreground">Reply-to: {sender.replyTo}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!sender.isDefault ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void onSetDefault()}
              disabled={isSettingDefault || isUpdating || isDeleting}
            >
              {isSettingDefault ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Star data-icon="inline-start" />}
              Tornar padrão
            </Button>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing((current) => !current)}
            disabled={isUpdating || isDeleting || isSettingDefault}
          >
            <Pencil data-icon="inline-start" />
            Editar
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="ghost" size="sm" disabled={isUpdating || isDeleting || isSettingDefault}>
                <Trash2 data-icon="inline-start" />
                Remover
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover remetente</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso removerá o remetente <strong>{sender.name}</strong>. Se ele for o padrão e existir outro remetente, o sistema escolherá um novo padrão automaticamente.
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
        <SenderForm
          initialValue={{ name: sender.name, email: sender.email, replyTo: sender.replyTo }}
          loading={isUpdating}
          lockEmail={lockEmail}
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

export function SenderCard() {
  const {
    loading,
    senders,
    defaultSenderId,
    creatingSender,
    updatingSenderId,
    deletingSenderId,
    settingDefaultSenderId,
    handleCreateSender,
    handleUpdateSender,
    handleDeleteSender,
    handleSetDefaultSender,
    domainName,
    domainStatus,
  } = useEmailSettingsContext()
  const [adding, setAdding] = useState(false)

  const domainSendCapable = isResendDomainSendCapable(domainStatus)

  const defaultSender = useMemo(
    () => senders.find((sender) => sender.id === defaultSenderId) ?? null,
    [defaultSenderId, senders]
  )

  const fallbackFromHint = buildDeliveryFromEmail(domainName)

  return (
    <EmailSettingsSectionCard
      icon={Mail}
      title="Remetentes"
      description="Gerencie os remetentes usados nas campanhas. Sem remetente cadastrado, o sistema usa o endereço contato do domínio (ou da plataforma)."
      contentClassName="flex flex-col gap-5"
    >
      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          {defaultSender ? (
            <div className="rounded-2xl border border-semantic-success/25 bg-semantic-success/10 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1 border-semantic-success/30 bg-background/90 text-semantic-success">
                  <CheckCircle2 className="size-3" />
                  Remetente ativo
                </Badge>
                <p className="font-[family-name:var(--font-poppins)] text-sm font-semibold text-foreground">
                  {defaultSender.name}
                </p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Os disparos usarão <strong>{defaultSender.email}</strong>
                {defaultSender.replyTo ? ` com respostas em ${defaultSender.replyTo}` : ""}.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-[color:var(--surface-1)] p-5 text-sm text-muted-foreground">
              Nenhum remetente configurado. Os disparos usarão{" "}
              <span className="font-mono text-xs text-foreground">{fallbackFromHint}</span> até você
              cadastrar um remetente próprio
              {domainName ? " no domínio conectado" : ""}.
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-foreground">Lista de remetentes</p>
                <p className="text-sm text-muted-foreground">
                  {senders.length} {senders.length === 1 ? "remetente cadastrado" : "remetentes cadastrados"}
                </p>
              </div>
              <Button
                type="button"
                onClick={() => setAdding((current) => !current)}
                disabled={creatingSender || !domainSendCapable}
              >
                {creatingSender ? (
                  <LoaderCircle data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Plus data-icon="inline-start" />
                )}
                Adicionar remetente
              </Button>
            </div>
            {!domainSendCapable ? (
              <p className="text-sm text-muted-foreground">
                Verifique um domínio nas configurações antes de cadastrar um remetente.
              </p>
            ) : null}
          </div>

          {adding && domainSendCapable ? (
            <SenderForm
              loading={creatingSender}
              submitLabel="Salvar remetente"
              onSubmit={async (data) => {
                await handleCreateSender(data)
                setAdding(false)
              }}
              onCancel={() => setAdding(false)}
            />
          ) : null}

          <div className="flex flex-col gap-3">
            {senders.map((sender) => (
              <SenderRow
                key={sender.id}
                sender={sender}
                isUpdating={updatingSenderId === sender.id}
                isDeleting={deletingSenderId === sender.id}
                isSettingDefault={settingDefaultSenderId === sender.id}
                lockEmail={!domainSendCapable}
                onUpdate={(data) => handleUpdateSender(sender.id, data)}
                onDelete={() => handleDeleteSender(sender.id)}
                onSetDefault={() => handleSetDefaultSender(sender.id)}
              />
            ))}
          </div>
        </>
      )}
    </EmailSettingsSectionCard>
  )
}
