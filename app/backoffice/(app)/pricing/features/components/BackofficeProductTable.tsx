import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
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
import type {
  BackofficeAdhesionBillingCycleKey,
  BackofficeProductItem,
} from "../context/BackofficePricingTypes"
import { BILLING_CYCLE_LABELS } from "../context/BackofficePricingTypes"
import { useBackofficePricing } from "../context/BackofficePricingContext"

function formatPrice(value: number | null): string {
  if (value == null) return "—"
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function getDefinedCycles(product: BackofficeProductItem): {
  key: BackofficeAdhesionBillingCycleKey
  price: number
  splitMode: "EQUAL" | "CUSTOM"
}[] {
  const order: BackofficeAdhesionBillingCycleKey[] = [
    "monthly",
    "quarterly",
    "semiannual",
    "annual",
  ]
  const result: {
    key: BackofficeAdhesionBillingCycleKey
    price: number
    splitMode: "EQUAL" | "CUSTOM"
  }[] = []
  for (const key of order) {
    const card = product.paymentRules.find(
      (r) => r.paymentMethod === "CREDIT_CARD" && r.billingCycle === key
    )
    const pix = product.paymentRules.find(
      (r) => r.paymentMethod === "PIX" && r.billingCycle === key
    )
    if (card) {
      result.push({
        key,
        price: card.price,
        splitMode: card.installmentSplitMode,
      })
    } else if (pix) {
      result.push({ key, price: pix.price, splitMode: "EQUAL" })
    }
  }
  return result
}

interface Props {
  products: BackofficeProductItem[]
  onCreate?: () => void
}

export function BackofficeProductTable({ products, onCreate }: Props) {
  const { canManage, openEditDialog, openDuplicateDialog, openDeleteDialog } = useBackofficePricing()

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-16 text-center">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">Nenhuma precificação cadastrada</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Crie tabelas de preço para as adesões. Uma precificação pode ter só um ciclo (ex.:
            CRM - Radar só com trimestral) ou vários.
          </p>
        </div>
        {canManage && onCreate ? (
          <Button type="button" onClick={onCreate}>
            Criar primeira precificação
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Slug</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead className="text-center">Tipo</TableHead>
            <TableHead className="text-center">Modo</TableHead>
            <TableHead>Ciclos</TableHead>
            <TableHead className="text-center">Vitalício</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const cycles = getDefinedCycles(product)

            return (
              <TableRow key={product.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap gap-1">
                      {product.featureSlugs.map((slug) => (
                        <Badge key={slug} variant="outline" className="font-mono text-[10px]">
                          {slug}
                        </Badge>
                      ))}
                    </div>
                    {product.isDefault && <Badge variant="secondary">Padrão</Badge>}
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  <div>
                    <p>{product.name}</p>
                    {product.description && (
                      <p className="text-xs text-muted-foreground">{product.description}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={product.type === "PLAN" ? "default" : "secondary"}>
                    {product.type === "PLAN" ? "Plano" : "Add-on"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">
                    {product.billingMode === "RECURRING" ? "Parcelado" : "Vitalício"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {product.billingMode !== "RECURRING" ? (
                    <span className="text-sm text-muted-foreground">—</span>
                  ) : cycles.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Sem ciclos</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {cycles.map((cycle) => (
                        <Badge key={cycle.key} variant="outline" className="font-normal">
                          {BILLING_CYCLE_LABELS[cycle.key]}
                          {cycle.splitMode === "CUSTOM" ? " · CUSTOM" : ""}
                          {" · "}
                          {formatPrice(cycle.price)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-center font-mono text-sm">
                  {formatPrice(product.priceLifetime)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={product.isActive ? "default" : "secondary"}>
                    {product.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {canManage && (
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
                          <DropdownMenuItem onClick={() => openDuplicateDialog(product)}>
                            <Copy data-icon="inline-start" />
                            Duplicar
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
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
