"use client"

import Link from "next/link"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { useParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useBackofficeClientInvoiceDetails } from "../context/BackofficeClientInvoiceDetailsContext"

const STATUS_BADGES: Record<
  "paid" | "overdue" | "upcoming" | "other",
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  paid: { label: "Paga", variant: "default" },
  overdue: { label: "Vencida", variant: "destructive" },
  upcoming: { label: "A vencer", variant: "outline" },
  other: { label: "Em processamento", variant: "secondary" },
}

const BILLING_LABELS: Record<string, string> = {
  PIX: "Pix",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão de crédito",
  UNDEFINED: "Não definido",
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("pt-BR")
}

export function BackofficeClientInvoiceDetailsContainer() {
  const { invoice, isLoading, error, reload } = useBackofficeClientInvoiceDetails()
  const params = useParams()
  const masterId = params.masterId as string
  const backHref = `/backoffice/clients/${masterId}?tab=invoices`

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para faturas
          </Link>
        </Button>
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground flex items-center justify-between">
            <span>{error || "Não foi possível carregar a fatura."}</span>
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              Recarregar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const statusBadge = STATUS_BADGES[invoice.statusGroup]

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para faturas
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          {invoice.invoiceUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={invoice.invoiceUrl} target="_blank" rel="noopener noreferrer">
                Ver fatura no Asaas
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          ) : null}

          {invoice.transactionReceiptUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={invoice.transactionReceiptUrl} target="_blank" rel="noopener noreferrer">
                Comprovante
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="flex flex-wrap items-center gap-2">
            Fatura {invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : invoice.id}
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">Cliente: {invoice.customerName}</p>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Resumo financeiro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Valor: </span>
              <span className="font-medium">{formatCurrency(invoice.value)}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Valor líquido: </span>
              <span className="font-medium">{formatCurrency(invoice.netValue)}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Valor original: </span>
              <span className="font-medium">{formatCurrency(invoice.originalValue)}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Juros: </span>
              <span className="font-medium">{formatCurrency(invoice.interestValue)}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Forma de pagamento: </span>
              <span className="font-medium">{BILLING_LABELS[invoice.billingType] ?? invoice.billingType}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Data da fatura: </span>
              <span className="font-medium">{formatDate(invoice.dateCreated)}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Vencimento: </span>
              <span className="font-medium">{formatDate(invoice.dueDate)}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Pagamento: </span>
              <span className="font-medium">{formatDate(invoice.paymentDate)}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Confirmação: </span>
              <span className="font-medium">{formatDate(invoice.confirmedDate)}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações adicionais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Descrição: </span>
            <span className="font-medium">{invoice.description}</span>
          </p>
          <p>
            <span className="text-muted-foreground">ID da fatura: </span>
            <span className="font-mono text-xs">{invoice.id}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Referência externa: </span>
            <span className="font-medium">{invoice.externalReference ?? "—"}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Parcela: </span>
            <span className="font-medium">{invoice.installmentNumber ?? "—"}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Linha excluída no Asaas: </span>
            <span className="font-medium">{invoice.deleted ? "Sim" : "Não"}</span>
          </p>
          {invoice.bankSlipUrl ? (
            <p>
              <span className="text-muted-foreground">Boleto: </span>
              <a
                href={invoice.bankSlipUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Abrir boleto
              </a>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
