"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Plus, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useBackofficePayments } from "../context/BackofficePaymentsContext"
import type { CreatePaymentFormData } from "../services/IBackofficePaymentsService"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone, parseDateKeyToUtc } from "@/lib/dates"

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pendente", variant: "outline" },
  AWAITING_RISK_ANALYSIS: { label: "Em análise", variant: "outline" },
  RECEIVED: { label: "Recebido", variant: "default" },
  CONFIRMED: { label: "Confirmado", variant: "default" },
  OVERDUE: { label: "Vencido", variant: "destructive" },
  REFUNDED: { label: "Reembolsado", variant: "secondary" },
  CANCELED: { label: "Cancelado", variant: "secondary" },
}

const BILLING_LABELS: Record<string, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão",
  UNDEFINED: "A definir",
}

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value)
  )
}

function formatDate(value: string | null, tz: string) {
  if (!value) return "—"
  return formatIntimezone(parseDateKeyToUtc(value, tz), "dd/MM/yyyy", tz)
}

interface PixDialogProps {
  open: boolean
  onClose: () => void
  pixQrCode: string | null
  pixPayload: string | null
}

function PixDialog({ open, onClose, pixQrCode, pixPayload }: PixDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Code PIX</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          {pixQrCode && (
            <img
              src={`data:image/png;base64,${pixQrCode}`}
              alt="QR Code PIX"
              className="w-48 h-48"
            />
          )}
          {pixPayload && (
            <div className="w-full space-y-2">
              <Label>Copia e Cola</Label>
              <Input value={pixPayload} readOnly className="text-xs" />
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => {
                  navigator.clipboard.writeText(pixPayload)
                  toast.success("Código copiado!")
                }}
              >
                Copiar código
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

const initialForm: CreatePaymentFormData = {
  clientId: "",
  billingType: "PIX",
  amount: 0,
  dueDate: "",
  description: "",
}

export function BackofficePaymentsContainer() {
  const { payments, clients, isLoading, isCreating, createPayment } = useBackofficePayments()
  const { tz } = useTimezone()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CreatePaymentFormData>(initialForm)
  const [pixDialog, setPixDialog] = useState<{
    open: boolean
    pixQrCode: string | null
    pixPayload: string | null
  }>({ open: false, pixQrCode: null, pixPayload: null })

  function handleChange(field: keyof CreatePaymentFormData, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.clientId) {
      toast.error("Selecione um cliente")
      return
    }
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error("Valor deve ser maior que zero")
      return
    }

    const result = await createPayment({ ...form, amount: Number(form.amount) })
    if (result.isValid) {
      toast.success("Cobrança criada com sucesso")
      setOpen(false)
      setForm(initialForm)

      if (form.billingType === "PIX" && result.result?.pixQrCode) {
        setPixDialog({
          open: true,
          pixQrCode: result.result.pixQrCode,
          pixPayload: result.result.pixPayload ?? null,
        })
      }
    } else {
      toast.error(result.errorMessages?.[0] ?? "Erro ao criar cobrança")
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Pagamentos</h1>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nova Cobrança
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Invoice</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhuma cobrança encontrada
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => {
                const client = clients.find((c) => c.id === payment.clientId)
                const statusInfo = STATUS_LABELS[payment.status] ?? { label: payment.status, variant: "outline" as const }
                return (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{client?.fullName ?? "—"}</TableCell>
                    <TableCell>{formatCurrency(payment.amount)}</TableCell>
                    <TableCell>{BILLING_LABELS[payment.billingType] ?? payment.billingType}</TableCell>
                    <TableCell>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(payment.dueDate, tz)}</TableCell>
                    <TableCell>
                      {payment.invoiceUrl ? (
                        <a
                          href={payment.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary text-xs hover:underline"
                        >
                          Ver <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Cobrança</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select
                value={form.clientId}
                onValueChange={(v) => handleChange("clientId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients
                    .filter((c) => c.asaasCustomerId)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.fullName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de cobrança</Label>
              <Select
                value={form.billingType}
                onValueChange={(v) => handleChange("billingType", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="BOLETO">Boleto</SelectItem>
                  <SelectItem value="CREDIT_CARD">Cartão de crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$) *</Label>
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount || ""}
                onChange={(e) => handleChange("amount", e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Vencimento</Label>
              <Input
                id="dueDate"
                type="date"
                value={form.dueDate}
                onChange={(e) => handleChange("dueDate", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Descrição opcional"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Criando..." : "Criar Cobrança"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <PixDialog
        open={pixDialog.open}
        onClose={() => setPixDialog((s) => ({ ...s, open: false }))}
        pixQrCode={pixDialog.pixQrCode}
        pixPayload={pixDialog.pixPayload}
      />
    </div>
  )
}
