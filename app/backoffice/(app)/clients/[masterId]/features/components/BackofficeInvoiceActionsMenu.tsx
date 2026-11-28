"use client"

import Link from "next/link"
import { CheckCircle2, Eye, ExternalLink, MoreHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { BackofficeClientInvoice } from "../context/BackofficeClientDetailsTypes"
import { canCancelInvoice, canMarkInvoicePaidExternally } from "../utils/invoiceActions"

type BackofficeInvoiceActionsMenuProps = {
  invoice: BackofficeClientInvoice
  clientId: string
  onCancel: (invoice: BackofficeClientInvoice) => void
  onMarkPaidExternally?: (invoice: BackofficeClientInvoice) => void
  triggerClassName?: string
}

export function BackofficeInvoiceActionsMenu({
  invoice,
  clientId,
  onCancel,
  onMarkPaidExternally,
  triggerClassName,
}: BackofficeInvoiceActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("size-8", triggerClassName)}>
          <MoreHorizontal />
          <span className="sr-only">Ações da fatura</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/backoffice/clients/${clientId}/invoices/${invoice.id}`}>
            <Eye />
            Visualizar
          </Link>
        </DropdownMenuItem>
        {invoice.checkoutUrl ? (
          <DropdownMenuItem asChild>
            <a href={invoice.checkoutUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
              Checkout
            </a>
          </DropdownMenuItem>
        ) : null}
        {onMarkPaidExternally && canMarkInvoicePaidExternally(invoice) ? (
          <DropdownMenuItem onClick={() => onMarkPaidExternally(invoice)}>
            <CheckCircle2 />
            Marcar como paga externamente
          </DropdownMenuItem>
        ) : null}
        {canCancelInvoice(invoice) ? (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
            onClick={() => onCancel(invoice)}
          >
            <X />
            Cancelar
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
