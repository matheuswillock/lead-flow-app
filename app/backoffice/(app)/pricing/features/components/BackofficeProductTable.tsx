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
            <TableHead>Status</TableHead>
            <TableHead className="w-[80px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
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
                  {product.billingMode === "RECURRING" ? "Recorrente" : "Vitalício"}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatPrice(product.priceMonthly)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatPrice(product.priceQuarterly)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatPrice(product.priceSemiannual)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatPrice(product.priceLifetime)}
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
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
