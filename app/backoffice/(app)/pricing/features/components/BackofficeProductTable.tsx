import { Pencil, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { BackofficeProductItem } from "../context/BackofficePricingTypes"
import { useBackofficePricing } from "../context/BackofficePricingContext"

function formatPrice(value: number | null): string {
  if (value == null) return "—"
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function getCardPrice(
  product: BackofficeProductItem,
  cycle: "monthly" | "quarterly" | "semiannual"
): number | null {
  const rule = product.paymentRules.find(
    (r) => r.paymentMethod === "CREDIT_CARD" && r.billingCycle === cycle
  )
  return rule ? rule.price : null
}

interface Props {
  products: BackofficeProductItem[]
}

export function BackofficeProductTable({ products }: Props) {
  const { openEditDialog, openDeleteDialog } = useBackofficePricing()

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-sm gap-2">
        <p>Nenhum produto cadastrado.</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Modo</TableHead>
            <TableHead className="text-right">Mensal</TableHead>
            <TableHead className="text-right">Trimestral</TableHead>
            <TableHead className="text-right">Semestral</TableHead>
            <TableHead className="text-right">Vitalício</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const cardMonthly = getCardPrice(product, "monthly")
            const cardQuarterly = getCardPrice(product, "quarterly")
            const cardSemiannual = getCardPrice(product, "semiannual")
            const total =
              product.billingMode === "LIFETIME"
                ? product.priceLifetime
                : cardSemiannual != null
                  ? cardSemiannual * 6
                  : null

            return (
              <TableRow key={product.id}>
                <TableCell className="font-medium">
                  <div>
                    <p>{product.name}</p>
                    {product.description && (
                      <p className="text-xs text-muted-foreground">{product.description}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={product.type === "PLAN" ? "default" : "secondary"}>
                    {product.type === "PLAN" ? "Plano" : "Add-on"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {product.billingMode === "RECURRING" ? "Parcelado" : "Vitalício"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {product.billingMode === "RECURRING" ? formatPrice(cardMonthly) : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {product.billingMode === "RECURRING" ? formatPrice(cardQuarterly) : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {product.billingMode === "RECURRING" ? formatPrice(cardSemiannual) : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatPrice(product.priceLifetime)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-medium">
                  {formatPrice(total)}
                </TableCell>
                <TableCell>
                  <Badge variant={product.isActive ? "default" : "secondary"}>
                    {product.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(product)}
                      aria-label="Editar produto"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(product)}
                      aria-label="Excluir produto"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
