"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Ban, Copy, ExternalLink, Loader2, Plus, Tag } from "lucide-react"
import { toast } from "sonner"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useBackofficeCrm } from "../context/BackofficeCrmHook"
import type {
  BackofficeLeadItem,
  BackofficeLeadOfferListItem,
  BackofficeLeadOfferStatusKey,
} from "../context/BackofficeCrmTypes"

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}

function formatCurrency(value: number | null): string | null {
  if (value === null) return null
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function statusLabel(status: BackofficeLeadOfferStatusKey): string {
  switch (status) {
    case "active":
      return "Ativa (única)"
    case "expired":
      return "Expirada"
    case "revoked":
      return "Revogada"
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

function statusVariant(
  status: BackofficeLeadOfferStatusKey
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default"
    case "expired":
      return "secondary"
    case "revoked":
      return "destructive"
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

export function BackofficeLeadOffersSheet({
  lead,
  open,
  onOpenChange,
  onGenerateNew,
}: {
  lead: BackofficeLeadItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerateNew: () => void
}) {
  const { canManage, listOffers, revokeOffer } = useBackofficeCrm()
  const [offers, setOffers] = useState<BackofficeLeadOfferListItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [pendingOfferId, setPendingOfferId] = useState<string | null>(null)
  const [offerToRevoke, setOfferToRevoke] = useState<BackofficeLeadOfferListItem | null>(null)
  const activeLeadIdRef = useRef<string | null>(null)

  useEffect(() => {
    activeLeadIdRef.current = lead?.id ?? null
  }, [lead])

  const loadOffers = useCallback(async () => {
    if (!lead) return
    const requestedLeadId = lead.id
    setIsLoading(true)
    try {
      const items = await listOffers(requestedLeadId)
      if (activeLeadIdRef.current !== requestedLeadId) return
      setOffers(items)
    } catch (error) {
      if (activeLeadIdRef.current !== requestedLeadId) return
      console.error("[BackofficeLeadOffersSheet][loadOffers]", error)
      toast.error(error instanceof Error ? error.message : "Erro ao carregar ofertas")
    } finally {
      if (activeLeadIdRef.current === requestedLeadId) {
        setIsLoading(false)
      }
    }
  }, [lead, listOffers])

  useEffect(() => {
    if (open && lead) {
      void loadOffers()
    } else {
      setOffers([])
      setOfferToRevoke(null)
    }
  }, [open, lead, loadOffers])

  async function handleRevoke() {
    if (!lead || !offerToRevoke || pendingOfferId) return
    setPendingOfferId(offerToRevoke.id)
    try {
      await revokeOffer(lead.id, offerToRevoke.id)
      toast.success("Link revogado")
      setOfferToRevoke(null)
      await loadOffers()
    } catch (error) {
      console.error("[BackofficeLeadOffersSheet][handleRevoke]", error)
      toast.error(error instanceof Error ? error.message : "Erro ao revogar oferta")
    } finally {
      setPendingOfferId(null)
    }
  }

  async function handleCopy(shareUrl: string) {
    await navigator.clipboard.writeText(shareUrl)
    toast.success("Link copiado")
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Histórico de ofertas</SheetTitle>
            <SheetDescription>
              {lead
                ? `Ofertas geradas para ${lead.name}. Apenas uma oferta pode estar ativa por vez.`
                : "Ofertas do lead."}
            </SheetDescription>
          </SheetHeader>

          {canManage ? (
            <div className="flex justify-end">
              <Button type="button" onClick={onGenerateNew}>
                <Plus data-icon="inline-start" />
                Gerar nova oferta
              </Button>
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : offers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
              <Tag className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma oferta gerada ainda.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {offers.map((offer) => (
                <div key={offer.id} className="flex flex-col gap-3 rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1">
                      <Badge variant={statusVariant(offer.status)}>
                        {statusLabel(offer.status)}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        Gerada em {formatDateTime(offer.generatedAt)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Link expira em {formatDateTime(offer.expiresAt)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pré-contrato até {formatDateTime(offer.preContractExpiresAt)}
                      </p>
                    </div>
                    {canManage && offer.status === "active" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pendingOfferId === offer.id}
                        onClick={() => setOfferToRevoke(offer)}
                      >
                        {pendingOfferId === offer.id ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Ban data-icon="inline-start" />
                        )}
                        Revogar
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">Produtos: </span>
                      {offer.productNames.join(", ") || "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">CTA: </span>
                      {offer.contactName} · {offer.contactPhone}
                    </p>
                    {formatCurrency(offer.insuranceAmount) ? (
                      <p>
                        <span className="text-muted-foreground">Seguro: </span>
                        {formatCurrency(offer.insuranceAmount)}
                      </p>
                    ) : null}
                  </div>
                  {offer.status === "active" && offer.shareUrl ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleCopy(offer.shareUrl!)}
                      >
                        <Copy data-icon="inline-start" />
                        Copiar link
                      </Button>
                      <Button type="button" variant="outline" size="sm" asChild>
                        <a href={offer.shareUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink data-icon="inline-start" />
                          Abrir
                        </a>
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={Boolean(offerToRevoke)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setOfferToRevoke(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar link da oferta?</AlertDialogTitle>
            <AlertDialogDescription>
              O link deixará de exibir os produtos imediatamente. O lead ainda verá a mensagem de
              expiração com o CTA de contato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(pendingOfferId)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(pendingOfferId)}
              onClick={(event) => {
                event.preventDefault()
                void handleRevoke()
              }}
            >
              {pendingOfferId ? <Loader2 className="animate-spin" /> : null}
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
