"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Power, PowerOff, RefreshCw, Unplug } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates/formatters"
import { formatWhatsappPhoneDisplay } from "@/lib/studio-bot/phone"
import { useBackofficeStudioBot } from "../context/BackofficeStudioBotHook"
import { BackofficeBotChannelStatusBadge } from "../components/BackofficeBotChannelStatusBadge"
import { BackofficeBotProfileForm } from "../components/BackofficeBotProfileForm"

const QR_POLL_INTERVAL_MS = 3000
const QR_POLL_MAX_TICKS = 40

export function BackofficeStudioBotCanalContainer() {
  const { tz } = useTimezone()
  const {
    channel,
    qrCode,
    isLoadingChannel,
    isTestingPing,
    isReconnecting,
    isDisconnecting,
    isSyncingProfile,
    canManage,
    loadChannel,
    testPing,
    reconnectChannel,
    refreshChannelConnection,
    replaceChannelConnection,
    clearQrCode,
    syncChannelProfile,
    updateChannel,
    isSavingProfile,
  } = useBackofficeStudioBot()

  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false)
  const [disableDialogOpen, setDisableDialogOpen] = useState(false)
  const [isTogglingBot, setIsTogglingBot] = useState(false)
  const qrPollTicksRef = useRef(0)
  const connectionBusy =
    isTestingPing || isReconnecting || isDisconnecting || isSyncingProfile || isTogglingBot
  const isConnected = channel?.status === "connected"
  const isBotEnabled = channel?.isActive ?? false

  useEffect(() => {
    void loadChannel()
  }, [loadChannel])

  useEffect(() => {
    if (!qrCode) {
      qrPollTicksRef.current = 0
      return
    }

    qrPollTicksRef.current = 0
    const timer = window.setInterval(() => {
      qrPollTicksRef.current += 1
      if (qrPollTicksRef.current > QR_POLL_MAX_TICKS) {
        window.clearInterval(timer)
        return
      }
      void refreshChannelConnection()
    }, QR_POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [qrCode, refreshChannelConnection])

  const handleReplaceConnection = async () => {
    const ok = await replaceChannelConnection()
    if (ok) {
      setReplaceDialogOpen(false)
    }
  }

  const handleToggleBotEnabled = async (nextEnabled: boolean) => {
    setIsTogglingBot(true)
    try {
      const ok = await updateChannel({ isActive: nextEnabled })
      if (ok && !nextEnabled) {
        setDisableDialogOpen(false)
      }
    } finally {
      setIsTogglingBot(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Canal e perfil</h1>
        <p className="text-sm text-muted-foreground">
          Identidade da Bethânia no WhatsApp e configuração do canal N8N.
        </p>
      </div>

      {isLoadingChannel ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conexão</CardTitle>
              <CardDescription>Status e metadados do canal ativo.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Status</span>
                {channel ? (
                  <BackofficeBotChannelStatusBadge status={channel.status} />
                ) : (
                  <span className="text-sm">Não configurado</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Disponível para usuários</span>
                <span className="text-sm font-medium">
                  {channel ? (isBotEnabled ? "Habilitada" : "Desabilitada") : "—"}
                </span>
              </div>
              {!isBotEnabled && channel ? (
                <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
                  A Bethânia está desabilitada. O card de vínculo em Conexões fica oculto e novas
                  vinculações são bloqueadas.
                </p>
              ) : null}
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Número atual do bot</p>
                {channel?.phoneNumber ? (
                  <p className="mt-1 font-mono text-base font-semibold tracking-wide text-foreground">
                    {formatWhatsappPhoneDisplay(channel.phoneNumber) ?? channel.phoneNumber}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Nenhum WhatsApp conectado no momento. Use &quot;Conectar novo WhatsApp&quot; e
                    escaneie o QR Code.
                  </p>
                )}
              </div>
              {channel?.lastProfileSyncAt ? (
                <div className="flex flex-col gap-1 text-sm">
                  <span className="text-muted-foreground">Última sincronização de perfil</span>
                  <span>
                    {formatIntimezone(new Date(channel.lastProfileSyncAt), "dd/MM/yyyy HH:mm", tz)}
                  </span>
                </div>
              ) : null}
              {canManage ? (
                <>
                <div className="flex flex-col gap-2">
                  {channel ? (
                    isBotEnabled ? (
                      <AlertDialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="border-foreground/20 text-destructive hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
                            disabled={connectionBusy}
                          >
                            {isTogglingBot ? (
                              <Loader2 className="animate-spin" data-icon="inline-start" />
                            ) : (
                              <PowerOff data-icon="inline-start" />
                            )}
                            {isTogglingBot ? "Desabilitando..." : "Desabilitar Bethânia"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-h-[90vh] flex flex-col border-destructive/40">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-destructive">
                              Desabilitar a Bethânia para usuários?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              O card de vínculo some de Conexões e ninguém consegue gerar código
                              `VINCULAR` enquanto estiver desabilitada. A conexão WhatsApp/Evolution
                              não é derrubada.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={isTogglingBot}>Cancelar</AlertDialogCancel>
                            <Button
                              variant="destructive"
                              disabled={isTogglingBot}
                              onClick={() => void handleToggleBotEnabled(false)}
                            >
                              {isTogglingBot ? "Desabilitando..." : "Confirmar desabilitação"}
                            </Button>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={connectionBusy}
                        onClick={() => void handleToggleBotEnabled(true)}
                      >
                        {isTogglingBot ? (
                          <Loader2 className="animate-spin" data-icon="inline-start" />
                        ) : (
                          <Power data-icon="inline-start" />
                        )}
                        {isTogglingBot ? "Habilitando..." : "Habilitar Bethânia"}
                      </Button>
                    )
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={connectionBusy}
                    onClick={() => void testPing()}
                  >
                    {isTestingPing ? (
                      <Loader2 className="animate-spin" data-icon="inline-start" />
                    ) : null}
                    {isTestingPing ? "Testando..." : "Testar ping N8N"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={connectionBusy}
                    onClick={() => void reconnectChannel()}
                  >
                    {isReconnecting && !isDisconnecting ? (
                      <Loader2 className="animate-spin" data-icon="inline-start" />
                    ) : (
                      <RefreshCw data-icon="inline-start" />
                    )}
                    {isReconnecting && !isDisconnecting
                      ? "Conectando..."
                      : isConnected
                        ? "Reconectar Evolution"
                        : "Conectar novo WhatsApp"}
                  </Button>
                  {isConnected ? (
                    <AlertDialog open={replaceDialogOpen} onOpenChange={setReplaceDialogOpen}>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-foreground/20 text-destructive hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
                          disabled={connectionBusy}
                        >
                          {isDisconnecting ? (
                            <Loader2 className="animate-spin" data-icon="inline-start" />
                          ) : (
                            <Unplug data-icon="inline-start" />
                          )}
                          {isDisconnecting ? "Desconectando..." : "Trocar WhatsApp"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="max-h-[90vh] flex flex-col border-destructive/40">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-destructive">
                            Derrubar vinculação atual?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Isso desconecta o WhatsApp atual da Bethânia
                            {channel?.phoneNumber
                              ? ` (${formatWhatsappPhoneDisplay(channel.phoneNumber) ?? channel.phoneNumber})`
                              : ""}{" "}
                            e gera um novo QR Code para conectar outro número. Vínculos de usuários
                            na Account não são removidos automaticamente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={connectionBusy}>Cancelar</AlertDialogCancel>
                          <Button
                            variant="destructive"
                            disabled={connectionBusy}
                            onClick={() => void handleReplaceConnection()}
                          >
                            {connectionBusy ? "Processando..." : "Desconectar e gerar QR"}
                          </Button>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={connectionBusy}
                    onClick={() => void syncChannelProfile()}
                  >
                    {isSyncingProfile ? (
                      <Loader2 className="animate-spin" data-icon="inline-start" />
                    ) : null}
                    {isSyncingProfile ? "Sincronizando..." : "Sincronizar perfil no WhatsApp"}
                  </Button>
                </div>
                <p className="text-muted-foreground text-sm">
                  Se a conexão falhar, aguarde e tente uma vez. Persistindo, limpe a instância
                  bethania na Evolution (ver runbook em n8n/README) e reconecte.
                </p>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Perfil da Bethânia</CardTitle>
              <CardDescription>Nome exibido e texto sobre no WhatsApp.</CardDescription>
            </CardHeader>
            <CardContent>
              <BackofficeBotProfileForm channel={channel} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Integração N8N</CardTitle>
              <CardDescription>URL de entrada para webhooks do orquestrador.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  const formData = new FormData(e.currentTarget)
                  const n8nInboundUrl = String(formData.get("n8nInboundUrl") ?? "").trim()
                  void updateChannel({ n8nInboundUrl: n8nInboundUrl || null })
                }}
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="n8n-inbound-url">URL inbound N8N</FieldLabel>
                    <Input
                      id="n8n-inbound-url"
                      name="n8nInboundUrl"
                      type="url"
                      defaultValue={channel?.n8nInboundUrl ?? ""}
                      placeholder="http://n8n:5678/webhook/bethania-inbound"
                      disabled={!canManage || isSavingProfile}
                    />
                    <FieldDescription>
                      Em produção (VPS, mesma rede Docker do N8N):{" "}
                      <span className="font-mono text-foreground">
                        http://n8n:5678/webhook/bethania-inbound
                      </span>
                      . Em dev local, a Evolution precisa alcançar o host:{" "}
                      <span className="font-mono text-foreground">
                        http://host.docker.internal:5678/webhook/bethania-inbound
                      </span>
                      . Salve antes de clicar em &quot;Reconectar Evolution&quot;.
                    </FieldDescription>
                  </Field>
                </FieldGroup>
                {canManage ? (
                  <Button type="submit" disabled={isSavingProfile}>
                    {isSavingProfile ? (
                      <Loader2 className="animate-spin" data-icon="inline-start" />
                    ) : null}
                    Salvar URL
                  </Button>
                ) : null}
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog
        open={Boolean(qrCode)}
        onOpenChange={(open) => {
          if (!open) clearQrCode()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escaneie o QR Code</DialogTitle>
            <DialogDescription>
              No WhatsApp da Bethânia: Aparelhos conectados → Conectar aparelho. Escaneie em até 60
              segundos. Se falhar, use &quot;Trocar WhatsApp&quot; ou &quot;Conectar novo
              WhatsApp&quot;.
            </DialogDescription>
          </DialogHeader>
          {qrCode ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <img
                src={qrCode.imageUrl}
                alt="QR Code WhatsApp da Bethânia"
                className="size-56 rounded-lg border bg-background object-contain"
              />
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Aguardando confirmação da conexão...
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
