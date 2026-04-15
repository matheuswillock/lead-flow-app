"use client"

import { useState } from "react"
import { Send, X, Trash2 } from "lucide-react"
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

function SendConfirmDialog({ campaign, onConfirm }: { campaign: Campaign; onConfirm: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)

  async function handleConfirm() {
    setSending(true)
    try {
      await onConfirm()
    } finally {
      setSending(false)
      setOpen(false)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={sending}
        className="h-7 px-2 text-xs"
      >
        <Send className="mr-1 h-3 w-3" />
        Disparar
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar disparo?</AlertDialogTitle>
            <AlertDialogDescription>
              A campanha <strong>"{campaign.name}"</strong> será enviada para{" "}
              <strong>{campaign.totalRecipients.toLocaleString("pt-BR")}</strong> destinatário(s).
              Os créditos correspondentes serão deduzidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={sending}>
              {sending ? "Disparando..." : "Sim, disparar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function CampaignList() {
  const {
    campaigns,
    total,
    page,
    totalPages,
    loading,
    cancelingId,
    deletingId,
    handleSend,
    handleCancel,
    handleDeleteDraft,
    handlePageChange,
  } = useCampanhasContext()

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Template / Lista</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Destinatários</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  Nenhuma campanha encontrada
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div>{campaign.template.name}</div>
                    <div className="text-xs">{campaign.contactList.name}</div>
                  </TableCell>
                  <TableCell>
                    <CampaignStatusBadge status={campaign.status} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {campaign.totalRecipients.toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {campaign.sentAt
                      ? new Date(campaign.sentAt).toLocaleDateString("pt-BR")
                      : campaign.scheduledAt
                      ? new Date(campaign.scheduledAt).toLocaleDateString("pt-BR")
                      : new Date(campaign.createdAt).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {(campaign.status === "draft" || campaign.status === "scheduled") && (
                        <SendConfirmDialog
                          campaign={campaign}
                          onConfirm={() => handleSend(campaign.id)}
                        />
                      )}
                      {campaign.status === "sending" && (
                        <span className="text-xs text-muted-foreground">Enviando...</span>
                      )}
                      {campaign.status === "scheduled" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancel(campaign.id)}
                          disabled={cancelingId === campaign.id}
                          className="h-7 px-2 text-xs text-muted-foreground"
                        >
                          <X className="mr-1 h-3 w-3" />
                          {cancelingId === campaign.id ? "..." : "Cancelar"}
                        </Button>
                      )}
                      {campaign.status === "draft" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteDraft(campaign.id)}
                          disabled={deletingId === campaign.id}
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          {deletingId === campaign.id ? "..." : "Excluir"}
                        </Button>
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
