import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import type { BackofficeProductItem } from "../context/BackofficePricingTypes"
import { useBackofficePricing } from "../context/BackofficePricingContext"

function formatPrice(value: number | null): string {
  if (value == null) return "—"
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function getCardPrice(
  product: BackofficeProductItem,
  cycle: "monthly" | "quarterly" | "semiannual" | "annual"
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
            <TableHead className="text-right">Anual</TableHead>
            <TableHead className="text-right">Vitalício</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const cardMonthly = getCardPrice(product, "monthly")
            const cardQuarterly = getCardPrice(product, "quarterly")
            const cardSemiannual = getCardPrice(product, "semiannual")
            const cardAnnual = getCardPrice(product, "annual")
            const total =
              product.billingMode === "LIFETIME"
                ? product.priceLifetime
                : cardAnnual != null
                  ? cardAnnual * 12
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
                  {product.billingMode === "RECURRING" ? formatPrice(cardAnnual) : "—"}
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
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Ações de ${product.name}`}>
                        <MoreHorizontal data-icon="inline-start" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Ações</DropdownMenuLabel>
                      <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => openEditDialog(product)}>
                          <Pencil data-icon="inline-start" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => openDeleteDialog(product)}
                        >
                          <Trash2 data-icon="inline-start" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
