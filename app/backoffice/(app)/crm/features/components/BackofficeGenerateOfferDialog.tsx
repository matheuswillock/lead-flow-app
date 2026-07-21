"use client"

import { useEffect, useState } from "react"
import { Check, Copy, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useBackofficeCrm } from "../context/BackofficeCrmHook"
import type {
  BackofficeLeadItem,
  BackofficeOfferProductOption,
} from "../context/BackofficeCrmTypes"

type WizardStep = 1 | 2 | 3

function formatPrice(value: number | null): string | null {
  if (value === null) return null
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function BackofficeGenerateOfferDialog({
  lead,
  open,
  onOpenChange,
  onGenerated,
}: {
  lead: BackofficeLeadItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerated?: () => void
}) {
  const { createOffer, listActiveProducts } = useBackofficeCrm()
  const [step, setStep] = useState<WizardStep>(1)
  const [products, setProducts] = useState<BackofficeOfferProductOption[]>([])
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [contactName, setContactName] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    setStep(1)
    setSelectedProductIds([])
    setContactName("")
    setContactPhone("")
    setShareUrl(null)
    setExpiresAt(null)
    setIsSubmitting(false)

    let cancelled = false
    setIsLoadingProducts(true)
    void listActiveProducts()
      .then((items) => {
        if (!cancelled) setProducts(items)
      })
      .catch((error) => {
        console.error("[BackofficeGenerateOfferDialog][listActiveProducts]", error)
        toast.error(error instanceof Error ? error.message : "Erro ao carregar produtos")
      })
      .finally(() => {
        if (!cancelled) setIsLoadingProducts(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, listActiveProducts])

  function toggleProduct(productId: string) {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    )
  }

  async function handleGenerate() {
    if (!lead || isSubmitting) return
    setIsSubmitting(true)
    try {
      const result = await createOffer(lead.id, {
        productIds: selectedProductIds,
        contactName,
        contactPhone,
      })
      setShareUrl(result.shareUrl)
      setExpiresAt(result.expiresAt)
      setStep(3)
      onGenerated?.()
      toast.success("Oferta gerada com sucesso")
    } catch (error) {
      console.error("[BackofficeGenerateOfferDialog][handleGenerate]", error)
      toast.error(error instanceof Error ? error.message : "Erro ao gerar oferta")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCopy() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    toast.success("Link copiado")
  }

  const canGoToStep2 = selectedProductIds.length > 0
  const canGenerate =
    contactName.trim().length > 0 && contactPhone.trim().length >= 10 && !isSubmitting

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar oferta</DialogTitle>
          <DialogDescription>
            {lead
              ? `Crie um link público de 24h para ${lead.name}.`
              : "Crie um link público de oferta."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {step === 1 ? (
            <FieldGroup>
              <Field>
                <FieldLabel>Produtos da oferta</FieldLabel>
                {isLoadingProducts ? (
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : products.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum produto ativo encontrado no catálogo.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {products.map((product) => {
                      const checked = selectedProductIds.includes(product.id)
                      const monthly = formatPrice(product.priceMonthly)
                      return (
                        <label
                          key={product.id}
                          className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleProduct(product.id)}
                          />
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="text-sm font-medium">{product.name}</span>
                            {product.description ? (
                              <span className="text-xs text-muted-foreground">
                                {product.description}
                              </span>
                            ) : null}
                            {monthly ? (
                              <span className="text-xs text-muted-foreground">
                                A partir de {monthly}/mês
                              </span>
                            ) : null}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </Field>
            </FieldGroup>
          ) : null}

          {step === 2 ? (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="offer-contact-name">Nome do contato (CTA)</FieldLabel>
                <Input
                  id="offer-contact-name"
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  placeholder="Ex.: Ana Silva"
                  autoComplete="name"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="offer-contact-phone">WhatsApp do contato</FieldLabel>
                <Input
                  id="offer-contact-phone"
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  placeholder="Ex.: 11999999999"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </Field>
            </FieldGroup>
          ) : null}

          {step === 3 && shareUrl ? (
            <FieldGroup>
              <Field>
                <FieldLabel>Link da oferta</FieldLabel>
                <div className="flex gap-2">
                  <Input value={shareUrl} readOnly />
                  <Button type="button" variant="outline" onClick={() => void handleCopy()}>
                    <Copy data-icon="inline-start" />
                    Copiar
                  </Button>
                </div>
                {expiresAt ? (
                  <p className="text-xs text-muted-foreground">
                    Expira em{" "}
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(expiresAt))}{" "}
                    (24 horas). Guarde o link agora — ele não poderá ser recuperado depois.
                  </p>
                ) : null}
              </Field>
            </FieldGroup>
          ) : null}
        </div>

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" disabled={!canGoToStep2} onClick={() => setStep(2)}>
                Continuar
              </Button>
            </>
          ) : null}
          {step === 2 ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button type="button" disabled={!canGenerate} onClick={() => void handleGenerate()}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : <Check data-icon="inline-start" />}
                Gerar link
              </Button>
            </>
          ) : null}
          {step === 3 ? (
            <Button type="button" onClick={() => onOpenChange(false)}>
              Concluir
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
