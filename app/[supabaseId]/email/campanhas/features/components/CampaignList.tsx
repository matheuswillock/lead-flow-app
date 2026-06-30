"use client"

import { useState } from "react"
import { MoreHorizontal, Send, Trash2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CampaignStatusBadge } from "./CampaignStatusBadge"
import { useCampanhasContext } from "../context/CampanhasContext"
import type { Campaign } from "../context/CampanhasTypes"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates"
import { useFeatureAccess } from "@/app/context/FeatureAccessContext"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"

function CampaignActionsMenu({
  campaign,
  canSendCampaign,
  deletingId,
  openEdit,
  handleSend,
  handleDeleteDraft,
}: {
  campaign: Campaign
  canSendCampaign: boolean
  deletingId: string | null
  openEdit: (campaign: Campaign) => void
  handleSend: (id: string) => Promise<void>
  handleDeleteDraft: (id: string) => Promise<void>
}) {
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const canSendByStatus = campaign.status === "draft" || campaign.status === "scheduled"
  const canEdit = true
  const canDelete = true

  async function handleSendConfirm() {
    setSending(true)
    try {
      await handleSend(campaign.id)
    } finally {
      setSending(false)
      setSendConfirmOpen(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Abrir menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Ações</DropdownMenuLabel>

          <DropdownMenuItem
            onClick={() => setSendConfirmOpen(true)}
            disabled={!canSendCampaign || !canSendByStatus}
            title={!canSendCampaign ? "Ative um plano em Assinaturas para disparar campanhas" : undefined}
          >
            <Send className="mr-2 h-4 w-4" />
            Disparar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void openEdit(campaign)} disabled={!canEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => handleDeleteDraft(campaign.id)}
            disabled={deletingId === campaign.id || !canDelete}
            className="text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deletingId === campaign.id ? "Excluindo..." : "Excluir"}
          </DropdownMenuItem>

        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar disparo?</AlertDialogTitle>
            <AlertDialogDescription>
              A campanha <strong>"{campaign.name}"</strong> será enviada para{" "}
              <strong>{campaign.totalRecipients.toLocaleString("pt-BR")}</strong>{" "}
              destinatário(s) ativo(s).
              Os créditos correspondentes serão deduzidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSendConfirm} disabled={sending}>
              {sending ? "Disparando..." : "Sim, disparar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function CampaignList() {
  const { tz } = useTimezone()
  const { isBeta } = useFeatureAccess()
  const {
    campaigns,
    total,
    page,
    totalPages,
    loading,
    deletingId,
    handleSend,
    handleDeleteDraft,
    handlePageChange,
    openEdit,
    credits,
  } = useCampanhasContext()
  const isCampaignsBetaAccess = isBeta(FEATURE_SLUGS.EMAIL_CAMPAIGNS)
  const canSendCampaign =
    !!credits?.hasSubscription || isCampaignsBetaAccess || !!credits?.isBetaExempt

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Criado por</TableHead>
              <TableHead>Template / Lista</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Destinatários</TableHead>
              <TableHead>Qtd. disparos</TableHead>
              <TableHead>Data de criação</TableHead>
              <TableHead>Último disparo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                  Nenhuma campanha encontrada
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="align-middle font-medium">{campaign.name}</TableCell>
                  <TableCell className="align-middle text-sm text-muted-foreground">
                    {campaign.creator?.fullName?.trim() || campaign.creator?.email || "—"}
                  </TableCell>
                  <TableCell className="align-middle text-sm text-muted-foreground">
                    <div>{campaign.template?.name ?? '—'}</div>
                    <div className="text-xs">{campaign.contactList?.name ?? '—'}</div>
                  </TableCell>
                  <TableCell className="align-middle">
                    <CampaignStatusBadge status={campaign.status} />
                  </TableCell>
                  <TableCell className="align-middle text-sm">
                    {campaign.totalRecipients.toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="align-middle text-sm text-muted-foreground">
                    {campaign.dispatchCount.toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="align-middle text-sm text-muted-foreground">
                    {formatIntimezone(new Date(campaign.createdAt), "dd/MM/yyyy", tz)}
                  </TableCell>
                  <TableCell className="align-middle text-sm text-muted-foreground">
                    {campaign.sentAt
                      ? formatIntimezone(new Date(campaign.sentAt), "dd/MM/yyyy HH:mm", tz)
                      : "—"}
                  </TableCell>
                  <TableCell className="align-middle">
                    <div className="flex items-center justify-end gap-1">
                      {campaign.status === "sending" ? (
                        <span className="text-xs text-muted-foreground">Enviando...</span>
                      ) : (
                        <CampaignActionsMenu
                          campaign={campaign}
                          canSendCampaign={canSendCampaign}
                          deletingId={deletingId}
                          openEdit={openEdit}
                          handleSend={handleSend}
                          handleDeleteDraft={handleDeleteDraft}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total.toLocaleString("pt-BR")} campanha(s)</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => handlePageChange(page - 1)}
          >
            Anterior
          </Button>
          <span>{page} / {totalPages || 1}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => handlePageChange(page + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  )
}
