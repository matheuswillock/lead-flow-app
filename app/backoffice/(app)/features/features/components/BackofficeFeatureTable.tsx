"use client"

import { Pencil, Trash2, GitBranch } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { isBetaGroupEligible } from "@/lib/features/is-beta-group-eligible"
import type { BackofficeFeatureItem } from "../context/BackofficeFeatureTypes"
import { useBackofficeFeature } from "../context/BackofficeFeatureContext"

const ACCESS_MODE_LABEL: Record<string, string> = {
  PUBLIC: "Público",
  PAID: "Pago",
  ADDON: "Adicional",
}

const ACCESS_LEVEL_LABEL: Record<string, string> = {
  NONE: "Nenhum",
  READ: "Leitura",
  FULL: "Total",
}

interface FeatureRowProps {
  feature: BackofficeFeatureItem
  parent?: BackofficeFeatureItem
  isChild?: boolean
}

function FeatureRow({ feature, parent, isChild }: FeatureRowProps) {
  const { canManage, openEditDialog, openDeleteDialog } = useBackofficeFeature()

  const inheritsAccess = Boolean(isChild && parent && feature.inheritParentSettings)
  const billingLabel = isChild
    ? feature.billedSeparately
      ? "cobrado à parte"
      : "incluso"
    : null

  return (
    <TableRow className={cn(isChild && "bg-muted/20")}>
      <TableCell className={cn("font-mono text-xs text-muted-foreground", isChild && "pl-8")}>
        {isChild && <GitBranch className="inline size-3 mr-1.5 opacity-40" />}
        {feature.slug}
      </TableCell>
      <TableCell className="font-medium">{feature.name}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Badge variant={feature.accessMode === "PAID" ? "default" : "secondary"}>
            {ACCESS_MODE_LABEL[feature.accessMode] ?? feature.accessMode}
          </Badge>
          {inheritsAccess && (
            <span className="text-[10px] text-muted-foreground/60">herdado</span>
          )}
          {billingLabel && (
            <Badge variant="outline" className="text-[10px]">
              {billingLabel}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {inheritsAccess ? (
          <span className="text-muted-foreground/80">Herdadas do pai</span>
        ) : feature.accessRules.length > 0 ? (
          <span
            className="cursor-help"
            title={feature.accessRules.map((rule) => `${rule.principal}: ${rule.accessLevel}`).join(" | ")}
          >
            {feature.accessRules.length} regra(s)
          </span>
        ) : (
          ACCESS_LEVEL_LABEL[feature.defaultAccessLevel] ?? feature.defaultAccessLevel
        )}
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {feature.productSlug ?? <span className="text-muted-foreground/40">—</span>}
      </TableCell>
      <TableCell>
        {isBetaGroupEligible(feature) ? (
          <Badge variant="outline" className="text-orange-500 border-orange-500/40">
            Beta
          </Badge>
        ) : (
          <span className="text-muted-foreground/40 text-xs">—</span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={feature.isActive ? "default" : "secondary"}>
          {feature.isActive ? "Ativo" : "Inativo"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        {canManage && (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openEditDialog(feature)}
              aria-label={`Editar ${feature.name}`}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openDeleteDialog(feature)}
              aria-label={`Excluir ${feature.name}`}
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}

const TABLE_HEADER = (
  <TableHeader>
    <TableRow>
      <TableHead>Slug</TableHead>
      <TableHead>Nome</TableHead>
      <TableHead>Modo</TableHead>
      <TableHead>Regras</TableHead>
      <TableHead>Produto</TableHead>
      <TableHead>Beta</TableHead>
      <TableHead>Status</TableHead>
      <TableHead className="text-right">Ações</TableHead>
    </TableRow>
  </TableHeader>
)

interface GroupProps {
  umbrella: BackofficeFeatureItem
  children: BackofficeFeatureItem[]
}

function FeatureGroup({ umbrella, children }: GroupProps) {
  const childCount = children.length

  return (
    <AccordionItem value={umbrella.id} className="border rounded-md overflow-hidden">
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-accent/40 [&>svg]:shrink-0">
        <div className="flex items-center gap-3 text-left">
          <span className="font-semibold text-sm">{umbrella.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{umbrella.slug}</span>
          {childCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {childCount} sub-{childCount === 1 ? "feature" : "features"}
            </Badge>
          )}
          {umbrella.betaEnabled && (
            <Badge variant="outline" className="text-orange-500 border-orange-500/40 text-xs">
              Beta
            </Badge>
          )}
          <Badge variant={umbrella.isActive ? "default" : "secondary"} className="text-xs">
            {umbrella.isActive ? "Ativo" : "Inativo"}
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="p-0">
        <div className="rounded-md border-t overflow-hidden">
          <Table>
            {TABLE_HEADER}
            <TableBody>
              <FeatureRow feature={umbrella} />
              {children.map((child) => (
                <FeatureRow key={child.id} feature={child} parent={umbrella} isChild />
              ))}
            </TableBody>
          </Table>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

interface Props {
  features: BackofficeFeatureItem[]
}

export function BackofficeFeatureTable({ features }: Props) {
  if (features.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhuma funcionalidade cadastrada.
      </p>
    )
  }

  // Split into umbrella (no parent) and children (has parentId)
  const umbrellas = features.filter((f) => !f.parentId)
  const childrenByParent = new Map<string, BackofficeFeatureItem[]>()
  for (const f of features) {
    if (f.parentId) {
      const list = childrenByParent.get(f.parentId) ?? []
      list.push(f)
      childrenByParent.set(f.parentId, list)
    }
  }

  // Features that have children → accordion groups
  // Umbrella features without children (and no parentId) → plain table
  const groups = umbrellas.filter((f) => (childrenByParent.get(f.id)?.length ?? 0) > 0)
  const standalone = umbrellas.filter((f) => (childrenByParent.get(f.id)?.length ?? 0) === 0)

  return (
    <div className="flex flex-col gap-3">
      {groups.length > 0 && (
        <Accordion type="multiple" defaultValue={groups.map((g) => g.id)} className="flex flex-col gap-2">
          {groups.map((umbrella) => (
            <FeatureGroup
              key={umbrella.id}
              umbrella={umbrella}
              children={childrenByParent.get(umbrella.id) ?? []}
            />
          ))}
        </Accordion>
      )}

      {standalone.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <Table>
            {TABLE_HEADER}
            <TableBody>
              {standalone.map((f) => (
                <FeatureRow key={f.id} feature={f} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
