"use client"

import { useState } from "react"
import { Mail, Search, Globe, CheckCircle2, Clock, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useBackofficeEmailSettings } from "../context/BackofficeEmailSettingsContext"
import type { EmailSettings, BackofficeTeamEmailEntry } from "../context/BackofficeEmailSettingsTypes"
import type { ResendDomainStatus } from "@/app/[supabaseId]/email/configuracoes/features/context/EmailSettingsTypes"

function DomainStatusBadge({ status }: { status: ResendDomainStatus | null }) {
  if (!status) return <Badge variant="secondary" className="text-xs">Sem domínio</Badge>
  if (status === "verified") return <Badge variant="outline" className="text-xs border-semantic-success/20 bg-semantic-success/10 text-semantic-success gap-1"><CheckCircle2 className="size-3" />Verificado</Badge>
  if (status === "pending") return <Badge variant="outline" className="text-xs border-amber-500/20 bg-amber-500/10 text-amber-600 gap-1"><Clock className="size-3" />Pendente</Badge>
  return <Badge variant="outline" className="text-xs border-destructive/20 bg-destructive/10 text-destructive gap-1"><AlertCircle className="size-3" />{status}</Badge>
}

function TeamRow({ item, isSelected, onSelect }: { item: BackofficeTeamEmailEntry; isSelected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left px-4 py-3 rounded-lg border transition-colors hover:bg-accent",
        isSelected && "bg-accent border-primary/30"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium truncate">{item.teamName}</span>
          <span className="text-xs text-muted-foreground truncate">{item.masterEmail ?? "—"}</span>
        </div>
        <DomainStatusBadge status={item.settings?.resendDomainStatus ?? null} />
      </div>
    </button>
  )
}

function SettingsOverrideForm({
  settings,
  isSaving,
  onSave,
}: {
  settings: EmailSettings | null
  isSaving: boolean
  onSave: (data: Partial<EmailSettings>) => void
}) {
  const [fromName, setFromName] = useState(settings?.fromName ?? "")
  const [fromEmail, setFromEmail] = useState(settings?.fromEmail ?? "")
  const [replyTo, setReplyTo] = useState(settings?.replyTo ?? "")
  const [templateApprovalRequired, setTemplateApprovalRequired] = useState(settings?.templateApprovalRequired ?? false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium">Remetente</p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bo-fromName" className="text-xs">Nome do remetente</Label>
          <Input id="bo-fromName" value={fromName} onChange={(e) => setFromName(e.target.value)} disabled={isSaving} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bo-fromEmail" className="text-xs">Email do remetente</Label>
          <Input id="bo-fromEmail" type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} disabled={isSaving} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bo-replyTo" className="text-xs">Reply-to (opcional)</Label>
          <Input id="bo-replyTo" type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} disabled={isSaving} />
        </div>
      </div>

      <Separator />

      <div className="flex items-center gap-3">
        <Switch
          id="bo-approval"
          checked={templateApprovalRequired}
          onCheckedChange={setTemplateApprovalRequired}
          disabled={isSaving}
        />
        <Label htmlFor="bo-approval" className="cursor-pointer text-sm">
          Exigir aprovação de templates por operadores
        </Label>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-muted-foreground">Domínio Resend</p>
        <div className="flex items-center gap-2">
          {settings?.resendDomainName ? (
            <>
              <Globe className="size-4 text-muted-foreground" />
              <span className="text-sm">{settings.resendDomainName}</span>
              <DomainStatusBadge status={settings.resendDomainStatus ?? null} />
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Sem domínio conectado</span>
          )}
        </div>
      </div>

      <Button
        onClick={() => onSave({ fromName, fromEmail, replyTo: replyTo || null, templateApprovalRequired })}
        disabled={isSaving || !fromName.trim() || !fromEmail.trim()}
      >
        {isSaving ? "Salvando..." : "Salvar alterações para este time"}
      </Button>
    </div>
  )
}

export function BackofficeEmailSettingsContainer() {
  const {
    items,
    total,
    page,
    totalPages,
    isLoading,
    isSaving,
    search,
    setSearch,
    handlePageChange,
    selectedTeamId,
    handleSelectTeam,
    selectedSettings,
    handleUpdateTeam,
  } = useBackofficeEmailSettings()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-2">
        <Mail className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Email · Configurações</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        {/* Team list */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Times</CardTitle>
            <CardDescription className="text-xs">{total} time{total !== 1 ? "s" : ""}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            {isLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum time encontrado</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {items.map((item) => (
                  <TeamRow
                    key={item.teamId}
                    item={item}
                    isSelected={selectedTeamId === item.teamId}
                    onSelect={() => handleSelectTeam(item.teamId)}
                  />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                >
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                >
                  Próxima
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Settings panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedTeamId
                ? items.find((i) => i.teamId === selectedTeamId)?.teamName ?? "Configurações"
                : "Selecione um time"}
            </CardTitle>
            {selectedTeamId && (
              <CardDescription className="text-xs">
                {items.find((i) => i.teamId === selectedTeamId)?.masterEmail}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!selectedTeamId ? (
              <p className="text-sm text-muted-foreground">
                Selecione um time na lista ao lado para ver e editar suas configurações de email.
              </p>
            ) : (
              <SettingsOverrideForm
                settings={selectedSettings}
                isSaving={isSaving}
                onSave={(data) => void handleUpdateTeam(data as Parameters<typeof handleUpdateTeam>[0])}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
