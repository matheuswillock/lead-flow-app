"use client"

import { useState } from "react"
import { CheckCircle2, Globe, LoaderCircle, Mail, Plus, Star, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { useBackofficeSettings } from "../hooks/useBackofficeSettings"

type SettingsState = ReturnType<typeof useBackofficeSettings>

function DomainCard({
  loading,
  domainInput,
  setDomainInput,
  domainName,
  domainStatus,
  domainRecords,
  connectingDomain,
  verifyingDomain,
  loadingRecords,
  onConnect,
  onVerify,
  onLoadRecords,
}: {
  loading: boolean
  domainInput: string
  setDomainInput: (value: string) => void
  domainName: string | null
  domainStatus: SettingsState["domainStatus"]
  domainRecords: SettingsState["domainRecords"]
  connectingDomain: boolean
  verifyingDomain: boolean
  loadingRecords: boolean
  onConnect: () => Promise<void>
  onVerify: () => Promise<void>
  onLoadRecords: () => Promise<void>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="size-4" />
          Domínio personalizado
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <>
            <FieldGroup>
              <Field>
                <FieldLabel>Domínio</FieldLabel>
                <Input
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="mail.exemplo.com"
                />
              </Field>
            </FieldGroup>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void onConnect()} disabled={connectingDomain}>
                {connectingDomain ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
                Conectar domínio
              </Button>
              {domainName ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void onVerify()}
                    disabled={verifyingDomain}
                  >
                    {verifyingDomain ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
                    Verificar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void onLoadRecords()}
                    disabled={loadingRecords}
                  >
                    Atualizar registros DNS
                  </Button>
                </>
              ) : null}
            </div>
            {domainName ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant="outline">{domainStatus ?? "—"}</Badge>
              </div>
            ) : null}
            {domainRecords.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domainRecords.map((record, index) => (
                    <TableRow key={`${record.type}-${record.name}-${index}`}>
                      <TableCell>{record.type}</TableCell>
                      <TableCell className="font-mono text-xs">{record.name}</TableCell>
                      <TableCell className="font-mono text-xs">{record.value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function SendersCard({
  loading,
  senders,
  creatingSender,
  deletingSenderId,
  settingDefaultSenderId,
  onCreate,
  onDelete,
  onSetDefault,
}: {
  loading: boolean
  senders: SettingsState["senders"]
  creatingSender: boolean
  deletingSenderId: string | null
  settingDefaultSenderId: string | null
  onCreate: SettingsState["handleCreateSender"]
  onDelete: SettingsState["handleDeleteSender"]
  onSetDefault: SettingsState["handleSetDefaultSender"]
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [replyTo, setReplyTo] = useState("")

  const submit = async () => {
    if (!name.trim() || !email.trim()) return
    await onCreate({
      name: name.trim(),
      email: email.trim(),
      replyTo: replyTo.trim() ? replyTo.trim() : null,
    })
    setName("")
    setEmail("")
    setReplyTo("")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="size-4" />
          Remetentes
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {senders.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum remetente cadastrado.</p>
              ) : (
                senders.map((sender) => (
                  <div
                    key={sender.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{sender.name}</p>
                      <p className="text-xs text-muted-foreground">{sender.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {sender.isDefault ? (
                        <Badge variant="outline">Padrão</Badge>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={settingDefaultSenderId === sender.id}
                          onClick={() => void onSetDefault(sender.id)}
                        >
                          <Star data-icon="inline-start" />
                          Definir padrão
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={deletingSenderId === sender.id}
                        onClick={() => void onDelete(sender.id)}
                      >
                        <Trash2 data-icon="inline-start" />
                        Remover
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <FieldGroup>
              <Field>
                <FieldLabel>Nome</FieldLabel>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>E-mail</FieldLabel>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>Reply-to (opcional)</FieldLabel>
                <Input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} />
              </Field>
            </FieldGroup>
            <Button type="button" onClick={() => void submit()} disabled={creatingSender}>
              {creatingSender ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Plus data-icon="inline-start" />}
              Adicionar remetente
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function VariablesCard({
  loading,
  variables,
  creatingVariable,
  deletingVariableId,
  onCreate,
  onDelete,
}: {
  loading: boolean
  variables: SettingsState["variables"]
  creatingVariable: boolean
  deletingVariableId: string | null
  onCreate: SettingsState["handleCreateVariable"]
  onDelete: SettingsState["handleDeleteVariable"]
}) {
  const [key, setKey] = useState("")
  const [defaultValue, setDefaultValue] = useState("")

  const submit = async () => {
    if (!key.trim()) return
    await onCreate({ key: key.trim(), defaultValue: defaultValue.trim() || null })
    setKey("")
    setDefaultValue("")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Variáveis globais</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            {variables.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma variável cadastrada.</p>
            ) : (
              variables.map((variable) => (
                <div
                  key={variable.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-mono text-sm">{variable.key}</p>
                    <p className="text-xs text-muted-foreground">
                      {variable.defaultValue ?? "Sem valor padrão"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={deletingVariableId === variable.id}
                    onClick={() => void onDelete(variable.id)}
                  >
                    <Trash2 data-icon="inline-start" />
                    Remover
                  </Button>
                </div>
              ))
            )}
            <FieldGroup>
              <Field>
                <FieldLabel>Chave</FieldLabel>
                <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="nome_cliente" />
              </Field>
              <Field>
                <FieldLabel>Valor padrão</FieldLabel>
                <Input value={defaultValue} onChange={(e) => setDefaultValue(e.target.value)} />
              </Field>
            </FieldGroup>
            <Button type="button" onClick={() => void submit()} disabled={creatingVariable}>
              {creatingVariable ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Plus data-icon="inline-start" />}
              Adicionar variável
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function BackofficeSettingsCards(settings: SettingsState) {
  return (
    <div className="flex flex-col gap-4">
      <DomainCard
        loading={settings.loading}
        domainInput={settings.domainInput}
        setDomainInput={settings.setDomainInput}
        domainName={settings.domainName}
        domainStatus={settings.domainStatus}
        domainRecords={settings.domainRecords}
        connectingDomain={settings.connectingDomain}
        verifyingDomain={settings.verifyingDomain}
        loadingRecords={settings.loadingRecords}
        onConnect={settings.handleConnectDomain}
        onVerify={settings.handleVerifyDomain}
        onLoadRecords={settings.handleLoadDomainRecords}
      />
      <SendersCard
        loading={settings.loading}
        senders={settings.senders}
        creatingSender={settings.creatingSender}
        deletingSenderId={settings.deletingSenderId}
        settingDefaultSenderId={settings.settingDefaultSenderId}
        onCreate={settings.handleCreateSender}
        onDelete={settings.handleDeleteSender}
        onSetDefault={settings.handleSetDefaultSender}
      />
      <VariablesCard
        loading={settings.loading}
        variables={settings.variables}
        creatingVariable={settings.creatingVariable}
        deletingVariableId={settings.deletingVariableId}
        onCreate={settings.handleCreateVariable}
        onDelete={settings.handleDeleteVariable}
      />
    </div>
  )
}

export function BackofficeSettingsStickySave({
  saving,
  loading,
  onSave,
}: {
  saving: boolean
  loading: boolean
  onSave: () => Promise<void>
}) {
  return (
    <div className="sticky bottom-4 z-10 mt-2">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/95 p-4 shadow-[var(--precision-shadow-2)] backdrop-blur md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-semantic-success/10 text-semantic-success">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-foreground">Configuração do time</p>
            <p className="text-sm text-muted-foreground">
              Domínio, remetentes e variáveis são salvos individualmente. Use salvar para confirmar ajustes gerais.
            </p>
          </div>
        </div>
        <Button type="button" onClick={() => void onSave()} disabled={saving || loading} className="md:min-w-52">
          {saving ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
          {saving ? "Salvando..." : "Salvar configurações"}
        </Button>
      </div>
    </div>
  )
}
