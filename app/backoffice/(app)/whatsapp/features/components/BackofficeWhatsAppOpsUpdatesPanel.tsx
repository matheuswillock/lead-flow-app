"use client"

import { useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Skeleton } from "@/components/ui/skeleton"
import { useBackofficeWhatsAppInstances } from "../context/BackofficeWhatsAppInstancesHook"

export function BackofficeWhatsAppOpsUpdatesPanel() {
  const {
    canManage,
    isResyncingWebhooks,
    webhookResyncResult,
    previewResyncWebhooks,
    confirmResyncWebhooks,
  } = useBackofficeWhatsAppInstances()

  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    void previewResyncWebhooks()
  }, [previewResyncWebhooks])

  const handleConfirm = async () => {
    const result = await confirmResyncWebhooks()
    setConfirmOpen(false)
    if (!result.isValid) {
      toast.error(result.errorMessages[0] ?? "Falha ao reaplicar webhooks")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Reaplicar webhooks OpenWA</CardTitle>
          <CardDescription>
            Reaplica a URL de webhook de todas as instâncias primárias do produto (OpenWA Gateway).
            No OpenWA o webhook é configurado em <code className="text-xs">startSession</code> — esta
            ação tenta <code className="text-xs">setWebhook</code> e ignora capability errors esperados.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={isResyncingWebhooks}
              onClick={() => void previewResyncWebhooks()}
            >
              {isResyncingWebhooks ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              Atualizar prévia
            </Button>

            {canManage && (
              <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogTrigger asChild>
                  <Button disabled={isResyncingWebhooks || !webhookResyncResult?.total}>
                    Reaplicar webhooks
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-h-[90vh] flex flex-col">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar reaplicação</AlertDialogTitle>
                    <AlertDialogDescription>
                      Serão atualizados {webhookResyncResult?.total ?? 0} webhook(s) no OpenWA Gateway.
                      Continuar?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isResyncingWebhooks}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={isResyncingWebhooks}
                      onClick={(event) => {
                        event.preventDefault()
                        void handleConfirm()
                      }}
                    >
                      {isResyncingWebhooks ? "Aplicando…" : "Confirmar"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {isResyncingWebhooks && !webhookResyncResult ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : webhookResyncResult ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">modo: {webhookResyncResult.mode}</Badge>
                <Badge variant="outline">total: {webhookResyncResult.total}</Badge>
                <Badge variant="outline">ok: {webhookResyncResult.ok}</Badge>
                {webhookResyncResult.failed > 0 && (
                  <Badge variant="destructive">failed: {webhookResyncResult.failed}</Badge>
                )}
              </div>
              <ul className="max-h-80 overflow-y-auto rounded-md border text-sm">
                {webhookResyncResult.results.map((item) => (
                  <li
                    key={item.configId}
                    className="flex flex-col gap-1 border-b px-3 py-2 last:border-b-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.instanceName}</span>
                      <Badge variant="outline">{item.status}</Badge>
                      <Badge variant={item.ok ? "secondary" : "destructive"}>
                        {item.ok ? "ok" : "falhou"}
                      </Badge>
                    </div>
                    {item.error && (
                      <p className="text-xs text-destructive">{item.error}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma prévia carregada.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
