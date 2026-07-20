"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Loader2, MessageSquare, Link2, ShieldCheck, Radio, Power, PowerOff, ServerCog, ScrollText } from "lucide-react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { useBackofficeStudioBot } from "../context/BackofficeStudioBotHook"
import { BackofficeBotChannelStatusBadge } from "../components/BackofficeBotChannelStatusBadge"
import { formatWhatsappPhoneDisplay } from "@/lib/studio-bot/phone"

export function BackofficeStudioBotOverviewContainer() {
  const {
    channel,
    isLoadingChannel,
    isTestingPing,
    canManage,
    loadChannel,
    testPing,
    loadUserLinks,
    updateChannel,
    userLinksPagination,
    conversationsPagination,
  } = useBackofficeStudioBot()

  const [disableDialogOpen, setDisableDialogOpen] = useState(false)
  const [isTogglingBot, setIsTogglingBot] = useState(false)
  const isBotEnabled = channel?.isActive ?? false

  useEffect(() => {
    void loadChannel()
    void loadUserLinks()
  }, [loadChannel, loadUserLinks])

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
        <h1 className="text-2xl font-semibold">Bethânia</h1>
        <p className="text-sm text-muted-foreground">
          Assistente conversacional do Corretor Studio — operação e auditoria do canal.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status do canal</CardTitle>
            <CardDescription>Conexão e identidade da Bethânia no WhatsApp.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {isLoadingChannel ? (
              <>
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-40" />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  {channel ? (
                    <BackofficeBotChannelStatusBadge status={channel.status} />
                  ) : (
                    <span className="text-sm text-muted-foreground">Canal não configurado</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">Disponível em Conexões</span>
                  <span className="text-sm font-medium">
                    {channel ? (isBotEnabled ? "Habilitada" : "Desabilitada") : "—"}
                  </span>
                </div>
                {channel?.phoneNumber ? (
                  <span className="text-sm text-muted-foreground">
                    {formatWhatsappPhoneDisplay(channel.phoneNumber) ?? channel.phoneNumber}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Telefone não configurado</span>
                )}
                {channel?.displayName ? (
                  <span className="text-sm font-medium">{channel.displayName}</span>
                ) : null}
                {!isBotEnabled && channel ? (
                  <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
                    Card de vínculo oculto em Conexões. Novas vinculações bloqueadas.
                  </p>
                ) : null}
              </>
            )}
            {canManage && channel ? (
              isBotEnabled ? (
                <AlertDialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-foreground/20 text-destructive hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
                      disabled={isTogglingBot}
                    >
                      {isTogglingBot ? (
                        <Loader2 className="animate-spin" data-icon="inline-start" />
                      ) : (
                        <PowerOff data-icon="inline-start" />
                      )}
                      {isTogglingBot ? "Desabilitando..." : "Desabilitar para usuários"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-h-[90vh] flex flex-col border-destructive/40">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-destructive">
                        Desabilitar a Bethânia para usuários?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        O card de vínculo some da aba Conexões do Corretor Studio e ninguém consegue
                        gerar código `VINCULAR`. A conexão WhatsApp não é derrubada.
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
                  size="sm"
                  disabled={isTogglingBot}
                  onClick={() => void handleToggleBotEnabled(true)}
                >
                  {isTogglingBot ? (
                    <Loader2 className="animate-spin" data-icon="inline-start" />
                  ) : (
                    <Power data-icon="inline-start" />
                  )}
                  {isTogglingBot ? "Habilitando..." : "Habilitar para usuários"}
                </Button>
              )
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <Link href="/backoffice/studio-bot/canal">
                <Radio data-icon="inline-start" />
                Gerenciar canal
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vínculos ativos</CardTitle>
            <CardDescription>Usuários verificados conversando com a Bethânia.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <span className="text-3xl font-semibold tabular-nums">
              {userLinksPagination.totalItems || "—"}
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/backoffice/studio-bot/vinculacoes">
                <Link2 data-icon="inline-start" />
                Ver vinculações
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversas</CardTitle>
            <CardDescription>Threads agregadas por usuário vinculado.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <span className="text-3xl font-semibold tabular-nums">
              {conversationsPagination.totalItems || "—"}
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/backoffice/studio-bot/conversas">
                <MessageSquare data-icon="inline-start" />
                Abrir inbox
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saúde N8N</CardTitle>
          <CardDescription>Teste de conectividade com o orquestrador de workflows.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {canManage ? (
            <Button type="button" disabled={isTestingPing} onClick={() => void testPing()}>
              {isTestingPing ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              {isTestingPing ? "Testando..." : "Testar ping N8N"}
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">Somente leitura para operators.</span>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/backoffice/studio-bot/verificacoes">
              <ShieldCheck data-icon="inline-start" />
              Auditoria de verificações
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/backoffice/studio-bot/ops">
              <ServerCog data-icon="inline-start" />
              Ops / Host
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/backoffice/studio-bot/ia">
              <ScrollText data-icon="inline-start" />
              IA
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/backoffice/studio-bot/ops?tab=logs">
              <ScrollText data-icon="inline-start" />
              Ver logs
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
