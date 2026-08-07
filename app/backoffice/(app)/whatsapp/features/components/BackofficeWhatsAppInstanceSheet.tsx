"use client"

import { useEffect, useState } from "react"
import { Loader2, RefreshCw, Unplug, History } from "lucide-react"
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
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates/formatters"
import { maskPhone } from "@/lib/masks"
import { useBackofficeWhatsAppInstances } from "../context/BackofficeWhatsAppInstancesHook"
import { BackofficeWhatsAppInstanceStatusBadge } from "./BackofficeWhatsAppInstanceStatusBadge"

function formatDate(value: string | null, tz: string) {
  if (!value) return "Nunca"
  return formatIntimezone(new Date(value), "dd/MM/yyyy HH:mm", tz)
}

export function BackofficeWhatsAppInstanceSheet() {
  const { tz } = useTimezone()
  const {
    selectedConfigId,
    selectedDetail,
    isLoadingDetail,
    isSaving,
    isReconnecting,
    isDisconnecting,
    isSyncing,
    canManage,
    closeDetail,
    updateInstance,
    reconnectInstance,
    disconnectInstance,
    syncHistory,
  } = useBackofficeWhatsAppInstances()

  const [usageLimitMonthly, setUsageLimitMonthly] = useState("2000")
  const [billingEnabled, setBillingEnabled] = useState(true)

  useEffect(() => {
    if (!selectedDetail) return
    setUsageLimitMonthly(String(selectedDetail.usageLimitMonthly))
    setBillingEnabled(selectedDetail.billingEnabled)
  }, [selectedDetail])

  const isOpen = Boolean(selectedConfigId)
  const isActionPending = isReconnecting || isDisconnecting || isSyncing

  async function handleSave() {
    if (!selectedDetail) return
    const limit = Number.parseInt(usageLimitMonthly, 10)
    if (!Number.isFinite(limit) || limit < 0) return
    await updateInstance(selectedDetail.id, {
      usageLimitMonthly: limit,
      billingEnabled,
    })
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeDetail()}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Instância WhatsApp</SheetTitle>
          <SheetDescription>
            Detalhes e configurações administrativas da instância.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {isLoadingDetail && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}

          {!isLoadingDetail && selectedDetail && (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <BackofficeWhatsAppInstanceStatusBadge status={selectedDetail.status} />
                </div>
                <div className="flex flex-col gap-1 text-sm">
                  <span>
                    <span className="text-muted-foreground">Master: </span>
                    {selectedDetail.team.master.fullName ?? "—"} (
                    {selectedDetail.team.master.email ?? "—"})
                  </span>
                  <span>
                    <span className="text-muted-foreground">Time: </span>
                    {selectedDetail.team.name}
                  </span>
                  <span>
                    <span className="text-muted-foreground">Motor: </span>
                    {selectedDetail.engine || "OPENWA"}
                  </span>
                  <span>
                    <span className="text-muted-foreground">Instância: </span>
                    {selectedDetail.instanceName}
                  </span>
                  <span>
                    <span className="text-muted-foreground">Motor: </span>
                    {selectedDetail.engine}
                  </span>
                  <span>
                    <span className="text-muted-foreground">Telefone: </span>
                    {selectedDetail.phoneNumber
                      ? maskPhone(selectedDetail.phoneNumber)
                      : "—"}
                  </span>
                </div>
              </div>

              {selectedDetail.qrCodeImageUrl && (
                <div className="flex flex-col items-center gap-2 rounded-md border p-4">
                  <span className="text-sm font-medium">QR Code</span>
                  <img
                    src={selectedDetail.qrCodeImageUrl}
                    alt="QR Code WhatsApp"
                    className="size-48 rounded-md border bg-background object-contain"
                  />
                  <span className="text-center text-xs text-muted-foreground">
                    Exibido apenas para suporte. O cliente deve escanear no app WhatsApp.
                  </span>
                </div>
              )}

              <Separator />

              <div className="flex flex-col gap-2 text-sm">
                <span className="font-medium">Uso mensal</span>
                <span>
                  {selectedDetail.usage.outboundCount.toLocaleString("pt-BR")} enviadas /{" "}
                  {selectedDetail.usage.usageLimitMonthly.toLocaleString("pt-BR")} (
                  {selectedDetail.usage.consumedPercentage}%)
                </span>
                <span className="text-muted-foreground">
                  {selectedDetail.usage.inboundCount.toLocaleString("pt-BR")} recebidas no período
                </span>
              </div>

              <Separator />

              <div className="flex flex-col gap-2 text-sm">
                <span className="font-medium">Sincronização</span>
                <span>Status: {selectedDetail.historySyncStatus}</span>
                <span>Última conexão: {formatDate(selectedDetail.lastConnectedAt, tz)}</span>
                <span>Última desconexão: {formatDate(selectedDetail.lastDisconnectedAt, tz)}</span>
                <span>Último sync: {formatDate(selectedDetail.lastSyncAt, tz)}</span>
                {selectedDetail.historySyncError && (
                  <span className="text-destructive">{selectedDetail.historySyncError}</span>
                )}
              </div>

              <Separator />

              <div className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Webhook</span>
                <span className="break-all text-muted-foreground">{selectedDetail.webhookUrl}</span>
              </div>

              {canManage && (
                <>
                  <Separator />
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="usage-limit">Limite mensal de mensagens</FieldLabel>
                      <Input
                        id="usage-limit"
                        type="number"
                        min={0}
                        value={usageLimitMonthly}
                        onChange={(event) => setUsageLimitMonthly(event.target.value)}
                        disabled={isSaving}
                      />
                    </Field>
                    <Field orientation="horizontal">
                      <Checkbox
                        id="billing-enabled"
                        checked={billingEnabled}
                        onCheckedChange={(checked) => setBillingEnabled(checked === true)}
                        disabled={isSaving}
                      />
                      <FieldLabel htmlFor="billing-enabled">Cobrança habilitada</FieldLabel>
                    </Field>
                  </FieldGroup>
                </>
              )}
            </>
          )}
        </div>

        {canManage && selectedDetail && !isLoadingDetail && (
          <SheetFooter className="flex-col gap-2 border-t p-4 sm:flex-col">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isActionPending}
                onClick={() => reconnectInstance(selectedDetail.id)}
              >
                {isReconnecting ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <RefreshCw data-icon="inline-start" />
                )}
                Reconectar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isActionPending}>
                    {isDisconnecting ? (
                      <Loader2 className="animate-spin" data-icon="inline-start" />
                    ) : (
                      <Unplug data-icon="inline-start" />
                    )}
                    Desconectar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Desconectar instância?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A sessão WhatsApp será encerrada no OpenWA Gateway. O cliente precisará escanear o
                      QR novamente para reconectar.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => disconnectInstance(selectedDetail.id)}>
                      Desconectar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                variant="outline"
                size="sm"
                disabled={isActionPending}
                onClick={() => syncHistory(selectedDetail.id)}
              >
                {isSyncing ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <History data-icon="inline-start" />
                )}
                Sync histórico
              </Button>
            </div>
            <Button onClick={handleSave} disabled={isSaving || isActionPending}>
              {isSaving && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Salvar alterações
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
