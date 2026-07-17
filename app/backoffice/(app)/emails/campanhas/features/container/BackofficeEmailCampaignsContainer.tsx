"use client"

import { useState } from "react"
import { Loader2, MoreVertical, Send, History, Ban } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatDateTime } from "@/lib/dates"
import { DEFAULT_TZ } from "@/lib/dates/DEFAULT_TZ"
import { useBackofficeEmailCampaigns } from "../context/BackofficeEmailCampaignsHook"
import { CreateEmailCampaignDialog } from "../components/CreateEmailCampaignDialog"
import { EmailCampaignStatusBadge } from "../components/EmailCampaignStatusBadge"
import { EmailCampaignDispatchHistoryPanel } from "../components/EmailCampaignDispatchHistoryPanel"
import type { BackofficeEmailCampaignItem } from "../context/BackofficeEmailCampaignsTypes"

type ConfirmAction = { type: "send-now" | "cancel"; campaign: BackofficeEmailCampaignItem } | null

export function BackofficeEmailCampaignsContainer() {
  const { campaigns, isLoading, error, sendNow, cancelCampaign } = useBackofficeEmailCampaigns()
  const [historyCampaign, setHistoryCampaign] = useState<BackofficeEmailCampaignItem | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const showLoader = isLoading && campaigns.length === 0

  async function handleConfirm() {
    if (!confirmAction) return
    setIsProcessing(true)
    try {
      if (confirmAction.type === "send-now") {
        await sendNow(confirmAction.campaign.id)
      } else {
        await cancelCampaign(confirmAction.campaign.id)
      }
    } finally {
      setIsProcessing(false)
      setConfirmAction(null)
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Campanhas de E-mail</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie as campanhas de e-mail marketing do Backoffice, incluindo a Live semanal.
          </p>
        </div>
        <CreateEmailCampaignDialog />
      </div>

      {showLoader && (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Carregando campanhas...
        </div>
      )}

      {!showLoader && error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!showLoader && !error && campaigns.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma campanha criada ainda.
        </p>
      )}

      {!showLoader && !error && campaigns.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Agendada para</TableHead>
              <TableHead className="text-right">Destinatários</TableHead>
              <TableHead className="text-right">Enviados</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((campaign) => {
              const canOperate = campaign.status === "draft" || campaign.status === "scheduled"
              return (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>
                    <EmailCampaignStatusBadge status={campaign.status} />
                  </TableCell>
                  <TableCell>{formatDateTime(campaign.scheduledAt, DEFAULT_TZ)}</TableCell>
                  <TableCell className="text-right">{campaign.totalRecipients}</TableCell>
                  <TableCell className="text-right">{campaign.totalSent}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8" aria-label="Ações">
                          <MoreVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setHistoryCampaign(campaign)}>
                          <History data-icon="inline-start" />
                          Histórico de disparos
                        </DropdownMenuItem>
                        {canOperate && (
                          <DropdownMenuItem
                            onClick={() => setConfirmAction({ type: "send-now", campaign })}
                          >
                            <Send data-icon="inline-start" />
                            Enviar agora
                          </DropdownMenuItem>
                        )}
                        {canOperate && (
                          <DropdownMenuItem
                            onClick={() => setConfirmAction({ type: "cancel", campaign })}
                            className="text-destructive focus:text-destructive"
                          >
                            <Ban data-icon="inline-start" />
                            Cancelar campanha
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      <EmailCampaignDispatchHistoryPanel
        campaignId={historyCampaign?.id ?? null}
        campaignName={historyCampaign?.name ?? ""}
        onOpenChange={(open) => {
          if (!open) setHistoryCampaign(null)
        }}
      />

      <AlertDialog
        open={Boolean(confirmAction)}
        onOpenChange={isProcessing ? undefined : (open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "send-now" ? "Enviar campanha agora?" : "Cancelar campanha?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "send-now"
                ? `A campanha "${confirmAction.campaign.name}" será enviada imediatamente para todos os contatos ativos da lista.`
                : `A campanha "${confirmAction?.campaign.name}" será cancelada e não poderá mais ser disparada.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleConfirm()
              }}
              disabled={isProcessing}
              className={
                confirmAction?.type === "cancel"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {isProcessing ? "Processando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
