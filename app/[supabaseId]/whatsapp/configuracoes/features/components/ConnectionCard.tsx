"use client"

import { useState } from 'react'
import {
  AlertTriangle,
  MessageCircle,
  Phone,
  PlugZap,
  QrCode,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useTimezone } from '@/app/context/TimezoneContext'
import { formatIntimezone } from '@/lib/dates'
import { useTeamContext } from '@/app/context/TeamContext'
import { isManagerLikeRole } from '@/lib/roles'
import { useWhatsAppSettingsContext } from '../context/WhatsAppSettingsContext'
import type { WhatsAppConnectionStatus, WhatsAppUsage } from '../context/WhatsAppSettingsTypes'

const STATUS_LABELS: Record<WhatsAppConnectionStatus, string> = {
  PENDING: 'Pendente',
  QR_READY: 'Aguardando QR',
  CONNECTED: 'Conectado',
  DISCONNECTED: 'Desconectado',
  ERROR: 'Erro',
  BANNED: 'Bloqueado',
}

const USAGE_STATUS_LABELS: Record<WhatsAppUsage['status'], string> = {
  WITHIN_LIMIT: 'Dentro do limite',
  ATTENTION: 'Atenção',
  EXCEEDED: 'Excedido',
}

function getStatusBadgeVariant(status: WhatsAppConnectionStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'CONNECTED') return 'default'
  if (status === 'QR_READY' || status === 'DISCONNECTED' || status === 'PENDING') return 'secondary'
  return 'destructive'
}

function getUsageBadgeVariant(status: WhatsAppUsage['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'WITHIN_LIMIT') return 'default'
  if (status === 'ATTENTION') return 'secondary'
  return 'destructive'
}

function StatusIcon({ status }: { status: WhatsAppConnectionStatus }) {
  if (status === 'CONNECTED') return <Wifi className={cn('size-5', 'text-semantic-success')} />
  if (status === 'ERROR' || status === 'BANNED') return <WifiOff className={cn('size-5', 'text-semantic-danger')} />
  return <WifiOff className={cn('size-5', 'text-muted-foreground')} />
}

function formatSyncDate(value: string | null, tz: string): string {
  if (!value) return 'Nunca'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data inválida'
  return formatIntimezone(date, 'dd/MM/yyyy HH:mm', tz)
}

export function ConnectionCard() {
  const { tz } = useTimezone()
  const { isTeamMaster, activeTeam } = useTeamContext()
  const canManageInfrastructure = isTeamMaster || isManagerLikeRole(activeTeam?.role)
  const {
    config,
    usage,
    reusableNumbers,
    isLoading,
    isLoadingReusableNumbers,
    isRefreshing,
    isConnecting,
    isReconnecting,
    isDisconnecting,
    isSyncingContacts,
    isPurgingConversations,
    connect,
    reconnect,
    disconnect,
    syncPhoneContacts,
    purgeConversations,
  } = useWhatsAppSettingsContext()

  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false)
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false)

  const isSharedNumber = Boolean(config?.primaryConfigId)
  const isAwaitingQrAfterDisconnect =
    config?.status === 'DISCONNECTED' && !config.qrCodeImageUrl && !isSharedNumber
  const showQrCode =
    Boolean(config?.qrCodeImageUrl) && config?.status !== 'CONNECTED'
  const showReconnectActions =
    canManageInfrastructure && !isSharedNumber && config?.status !== 'CONNECTED'
  const reconnectButtonVariant = config?.status === 'CONNECTED' ? 'outline' : 'default'
  const phoneLabel =
    config?.phoneNumber ??
    (config?.status === 'CONNECTED' ? 'Sincronizando número...' : 'Número não conectado')

  if (isLoading && !config) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-9 w-36" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <MessageCircle className="size-5 text-primary" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>WhatsApp Business</CardTitle>
              {config ? (
                <Badge variant={getStatusBadgeVariant(config.status)}>{STATUS_LABELS[config.status]}</Badge>
              ) : (
                <Badge variant="outline">Não configurado</Badge>
              )}
              {config?.primaryConfigId ? (
                <Badge variant="outline">Número compartilhado</Badge>
              ) : null}
              {isRefreshing ? (
                <RefreshCw className="size-4 animate-spin text-muted-foreground" />
              ) : null}
            </div>
            <CardDescription>
              Conecte um número WhatsApp Business para enviar e receber mensagens com seus leads.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!config ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="rounded-full bg-muted p-4">
              <PlugZap className="size-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-base font-semibold">Conecte seu WhatsApp</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Configure a integração para enviar mensagens e acompanhar seus leads diretamente pelo WhatsApp.
              </p>
            </div>
            {canManageInfrastructure ? (
              <div className="flex flex-col items-center gap-3">
                <Button onClick={() => void connect()} disabled={isConnecting}>
                  {isConnecting ? <RefreshCw className="animate-spin" /> : <PlugZap />}
                  {isConnecting ? 'Conectando...' : 'Conectar WhatsApp'}
                </Button>
                {isTeamMaster && reusableNumbers.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">Ou reutilize um número já conectado:</p>
                    {reusableNumbers.map((item) => (
                      <Button
                        key={item.teamId}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isConnecting || isLoadingReusableNumbers}
                        onClick={() => void connect(item.teamId)}
                      >
                        <Phone />
                        Usar número do time {item.teamName} ({item.phoneNumber})
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Apenas gestores podem configurar a integração do WhatsApp.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <StatusIcon status={config.status} />
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <Phone className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{phoneLabel}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Última sincronização: {formatSyncDate(config.lastSyncAt, tz)}
                </span>
              </div>
            </div>

            {isSharedNumber && config.status !== 'CONNECTED' ? (
              <>
                <Separator />
                <Alert>
                  <AlertTriangle className="size-4" />
                  <AlertDescription>
                    Este time usa um número compartilhado. A reconexão deve ser feita pelo time que
                    gerencia a instância principal.
                  </AlertDescription>
                </Alert>
              </>
            ) : null}

            {isAwaitingQrAfterDisconnect ? (
              <>
                <Separator />
                <Alert>
                  <AlertTriangle className="size-4" />
                  <AlertDescription>
                    Conexão encerrada. Estamos gerando um novo QR Code para você reconectar o
                    WhatsApp.
                  </AlertDescription>
                </Alert>
                <div className="flex flex-col items-center gap-3 py-2">
                  <Skeleton className="size-48 rounded-lg" />
                  <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
                </div>
              </>
            ) : null}

            {showQrCode ? (
              <>
                <Separator />
                <div className="flex flex-col items-center gap-4 py-2">
                  <div className="flex items-center gap-2">
                    <QrCode className="size-5 text-primary" />
                    <p className="text-sm font-semibold">Escaneie o QR Code</p>
                  </div>
                  <img
                    src={config.qrCodeImageUrl!}
                    alt="QR Code WhatsApp"
                    className="size-48 rounded-lg border bg-background object-contain"
                  />
                  <p className="max-w-sm text-center text-sm text-muted-foreground">
                    No celular: WhatsApp → Aparelhos conectados → Conectar aparelho. Escaneie em até 60
                    segundos. Se falhar, clique em Atualizar QR Code e tente de novo.
                  </p>
                </div>
              </>
            ) : null}

            {config.provider === 'EVOLUTION' ? (
              <>
                <Separator />
                <Alert>
                  <AlertTriangle className="size-4" />
                  <AlertDescription>
                    Este módulo usa Evolution API (conexão via QR Code). Podem ocorrer desconexões, reconexões e risco
                    de bloqueio do número.
                  </AlertDescription>
                </Alert>
              </>
            ) : null}

            {config.status === 'CONNECTED' && usage ? (
              <>
                <Separator />
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Uso do período — {usage.periodKey}</p>
                    <Badge variant={getUsageBadgeVariant(usage.status)}>{USAGE_STATUS_LABELS[usage.status]}</Badge>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(usage.consumedPercentage, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{usage.outboundCount} mensagens enviadas</span>
                    <span>limite: {usage.usageLimitMonthly}</span>
                  </div>
                </div>
              </>
            ) : null}

            <Separator />

            {canManageInfrastructure ? (
            <div className="flex flex-wrap gap-2">
              {config.status === 'CONNECTED' && canManageInfrastructure ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSyncingContacts}
                  onClick={() => void syncPhoneContacts()}
                >
                  <RefreshCw className={cn(isSyncingContacts && 'animate-spin')} data-icon="inline-start" />
                  {isSyncingContacts ? 'Sincronizando...' : 'Sincronizar contatos do celular'}
                </Button>
              ) : null}
              {showReconnectActions ? (
                showQrCode ? (
                  <Button
                    variant={reconnectButtonVariant}
                    size="sm"
                    onClick={() => void reconnect()}
                    disabled={isReconnecting}
                  >
                    <RefreshCw className={cn(isReconnecting && 'animate-spin')} data-icon="inline-start" />
                    {isReconnecting ? 'Atualizando...' : 'Atualizar QR Code'}
                  </Button>
                ) : (
                  <Button
                    variant={reconnectButtonVariant}
                    size="sm"
                    onClick={() => void reconnect()}
                    disabled={isReconnecting}
                  >
                    <RefreshCw className={cn(isReconnecting && 'animate-spin')} data-icon="inline-start" />
                    {isReconnecting ? 'Reconectando...' : 'Reconectar'}
                  </Button>
                )
              ) : null}

              {config.status === 'CONNECTED' ? (
                <AlertDialog open={purgeDialogOpen} onOpenChange={setPurgeDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={isPurgingConversations}>
                      <Trash2 data-icon="inline-start" />
                      {isPurgingConversations ? 'Zerando...' : 'Zerar conversas'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Zerar conversas do time</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação remove todas as conversas ativas da inbox deste time. As mensagens
                        deixam de aparecer na lista, mas o WhatsApp permanece conectado.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          setPurgeDialogOpen(false)
                          void purgeConversations()
                        }}
                      >
                        Zerar conversas
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}

              {config.status !== 'DISCONNECTED' ? (
              <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isDisconnecting}>
                    <WifiOff data-icon="inline-start" />
                    {isDisconnecting ? 'Desconectando...' : 'Desconectar'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Desconectar WhatsApp</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação irá desconectar o número WhatsApp vinculado ao time. Um novo QR Code
                      será gerado automaticamente para reconectar quando você quiser.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        setDisconnectDialogOpen(false)
                        void disconnect()
                      }}
                    >
                      Desconectar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              ) : null}
            </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
