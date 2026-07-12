"use client"

import Link from "next/link"
import { useEffect } from "react"
import { Loader2, MessageSquare, Link2, ShieldCheck, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
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
    userLinksPagination,
    conversationsPagination,
  } = useBackofficeStudioBot()

  useEffect(() => {
    void loadChannel()
    void loadUserLinks()
  }, [loadChannel, loadUserLinks])

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
              </>
            )}
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
            <span className="text-sm text-muted-foreground">Somente leitura para operadores.</span>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/backoffice/studio-bot/verificacoes">
              <ShieldCheck data-icon="inline-start" />
              Auditoria de verificações
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
