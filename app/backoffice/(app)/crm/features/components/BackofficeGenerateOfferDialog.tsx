"use client"

import { useEffect, useState } from "react"
import { Check, Copy, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { toastUserError } from "@/lib/ui/to-user-toast-message"
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

type WizardStep = 1 | 2 | 3 | 4

function formatPrice(value: number | null): string | null {
  if (value === null) return null
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function defaultPreContractDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseInsuranceInput(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/\./g, "").replace(",", ".")
  const amount = Number(normalized)
  if (Number.isNaN(amount)) return Number.NaN
  return amount
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
  const [preContractExpiresAt, setPreContractExpiresAt] = useState(defaultPreContractDate)
  const [insuranceAmountInput, setInsuranceAmountInput] = useState("")
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
    setPreContractExpiresAt(defaultPreContractDate())
    setInsuranceAmountInput("")
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
        toastUserError(error)
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
    const insuranceAmount = parseInsuranceInput(insuranceAmountInput)
    if (Number.isNaN(insuranceAmount)) {
      toast.error("Valor do seguro é inválido")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createOffer(lead.id, {
        productIds: selectedProductIds,
        contactName,
        contactPhone,
        preContractExpiresAt: new Date(`${preContractExpiresAt}T23:59:59`).toISOString(),
        insuranceAmount,
      })
      setShareUrl(result.shareUrl)
      setExpiresAt(result.expiresAt)
      setStep(4)
      onGenerated?.()
      toast.success("Oferta gerada com sucesso")
    } catch (error) {
      console.error("[BackofficeGenerateOfferDialog][handleGenerate]", error)
      toastUserError(error)
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
  const canGoToStep3 =
    contactName.trim().length > 0 && contactPhone.trim().length >= 10
  const canGenerate =
    preContractExpiresAt.trim().length > 0 && !isSubmitting

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar oferta</DialogTitle>
          <DialogDescription>
            {lead
              ? `Crie um link público de 24h para ${lead.name}. Apenas uma oferta pode ficar ativa por lead.`
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

          {step === 3 ? (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="offer-precontract-expires">
                  Vencimento do pré-contrato
                </FieldLabel>
                <Input
                  id="offer-precontract-expires"
                  type="date"
                  value={preContractExpiresAt}
                  onChange={(event) => setPreContractExpiresAt(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="offer-insurance-amount">
                  Valor do seguro (opcional)
                </FieldLabel>
                <Input
                  id="offer-insurance-amount"
                  value={insuranceAmountInput}
                  onChange={(event) => setInsuranceAmountInput(event.target.value)}
                  placeholder="Ex.: 1500,00"
                  inputMode="decimal"
                />
              </Field>
            </FieldGroup>
          ) : null}

          {step === 4 && shareUrl ? (
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
                    Link expira em{" "}
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(expiresAt))}{" "}
                    (24 horas). Ofertas anteriores ativas foram revogadas.
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
              <Button type="button" disabled={!canGoToStep3} onClick={() => setStep(3)}>
                Continuar
              </Button>
            </>
          ) : null}
          {step === 3 ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep(2)}>
                Voltar
              </Button>
              <Button type="button" disabled={!canGenerate} onClick={() => void handleGenerate()}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : <Check data-icon="inline-start" />}
                Gerar link
              </Button>
            </>
          ) : null}
          {step === 4 ? (
            <Button type="button" onClick={() => onOpenChange(false)}>
              Concluir
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
