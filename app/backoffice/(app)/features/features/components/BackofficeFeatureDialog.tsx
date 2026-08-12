"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { useBackofficeFeature } from "../context/BackofficeFeatureContext"
import {
  CHARGE_DURING_BETA_HINT,
  getChargeDuringBetaClientHint,
  isChargeDuringBetaSaveBlocked,
  isChargeDuringBetaVisible,
} from "../utils/backofficeFeatureForm"

const ACCESS_PRINCIPALS = [
  { principal: "MASTER", label: "Master" },
  { principal: "MANAGER", label: "Manager" },
  { principal: "BACKOFFICE", label: "Backoffice" },
  { principal: "OPERATOR", label: "Operator" },
  { principal: "SDR", label: "SDR" },
  { principal: "CLOSER", label: "Closer" },
  { principal: "CAN_MANAGE_TEAMS", label: "Ger. Times" },
  { principal: "CAN_CREATE_USERS", label: "Cad. Usuários" },
] as const

const ACCESS_LEVELS = ["NONE", "READ", "FULL"] as const

export function BackofficeFeatureDialog() {
  const {
    dialogOpen,
    dialogMode,
    dialogFeature,
    formData,
    isSaving,
    closeDialog,
    setFormField,
    setAccessRule,
    submitForm,
  } = useBackofficeFeature()

  const isEdit = dialogMode === "edit"
  const title = isEdit ? "Editar funcionalidade" : "Nova funcionalidade"
  const isChildFeature = Boolean(formData.parentId || dialogFeature?.parentId)
  const isInheritingFromParent = isChildFeature && formData.inheritParentSettings
  const isBilledSeparatelyDisabled = isSaving || !isChildFeature || isInheritingFromParent
  const showChargeDuringBeta =
    isChargeDuringBetaVisible(formData.betaEnabled) || isInheritingFromParent
  const chargeDuringBetaHint = getChargeDuringBetaClientHint(formData)
  const chargeDuringBetaInvalid = chargeDuringBetaHint !== null
  const saveBlocked =
    isSaving || !formData.name.trim() || isChargeDuringBetaSaveBlocked(formData)

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog() }}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 flex flex-col gap-4 px-1 py-2">
          {isEdit && dialogFeature && (
            <div className="flex flex-col gap-1.5">
              <Label>Slug</Label>
              <Input value={dialogFeature.slug} disabled className="font-mono text-xs" />
              <p className="text-xs text-muted-foreground">O slug é imutável após a criação.</p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="feature-name">Nome *</Label>
            <Input
              id="feature-name"
              value={formData.name}
              onChange={(e) => setFormField("name", e.target.value)}
              placeholder="Ex: CRM Dashboard"
              disabled={isSaving}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="feature-description">Descrição</Label>
            <Textarea
              id="feature-description"
              value={formData.description}
              onChange={(e) => setFormField("description", e.target.value)}
              placeholder="Descrição opcional da funcionalidade"
              rows={2}
              disabled={isSaving}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Regras de acesso</Label>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Principal</th>
                    <th className="px-3 py-2 text-center font-medium">NONE</th>
                    <th className="px-3 py-2 text-center font-medium">READ</th>
                    <th className="px-3 py-2 text-center font-medium">FULL</th>
                  </tr>
                </thead>
                <tbody>
                  {ACCESS_PRINCIPALS.map((principal) => {
                    const currentLevel =
                      formData.accessRules.find((rule) => rule.principal === principal.principal)
                        ?.accessLevel ?? "NONE"

                    return (
                      <tr key={principal.principal} className="border-t">
                        <td className="px-3 py-2">{principal.label}</td>
                        {ACCESS_LEVELS.map((level) => (
                          <td key={level} className="px-3 py-2 text-center">
                            <Input
                              type="radio"
                              name={`principal-${principal.principal}`}
                              value={level}
                              checked={currentLevel === level}
                              disabled={isSaving || isInheritingFromParent}
                              onChange={() => setAccessRule(principal.principal, level)}
                            />
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {isInheritingFromParent && (
              <p className="text-xs text-muted-foreground">
                Regras herdadas da funcionalidade pai.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Herdar configurações do pai</span>
              <span className="text-xs text-muted-foreground">
                Sub-funcionalidades podem usar modo, produto, beta, cobrança beta e regras do pai automaticamente.
              </span>
            </div>
            <Switch
              checked={isChildFeature ? formData.inheritParentSettings : false}
              onCheckedChange={(value) => setFormField("inheritParentSettings", value)}
              disabled={isSaving || !isChildFeature}
            />
          </div>

          {isChildFeature && (
            <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Cobrado separadamente do pai</span>
                <span className="text-xs text-muted-foreground">
                  Desligado = incluso na assinatura do produto do pai. Ligado = exige assinatura do produto próprio.
                </span>
              </div>
              <Switch
                checked={formData.billedSeparately}
                onCheckedChange={(value) => setFormField("billedSeparately", value)}
                disabled={isBilledSeparatelyDisabled}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="feature-access-mode">Modo de acesso</Label>
              <Select
                value={formData.accessMode}
                onValueChange={(v) => setFormField("accessMode", v)}
                disabled={isSaving || isInheritingFromParent}
              >
                <SelectTrigger id="feature-access-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">Público</SelectItem>
                  <SelectItem value="PAID">Pago</SelectItem>
                  <SelectItem value="ADDON">Adicional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="feature-product-slug">Produto (slug)</Label>
            <Input
              id="feature-product-slug"
              value={formData.productSlug}
              onChange={(e) => setFormField("productSlug", e.target.value)}
              placeholder="Ex: crm"
              disabled={isSaving || isInheritingFromParent}
              className={cn(
                "font-mono text-xs",
                chargeDuringBetaInvalid && "border-destructive"
              )}
            />
            <p
              className={cn(
                "text-xs",
                chargeDuringBetaInvalid ? "text-amber-600" : "text-muted-foreground"
              )}
            >
              {chargeDuringBetaInvalid
                ? "Informe um produto para cobrar esta funcionalidade durante o beta."
                : "Slug de um produto cadastrado em Precificação. Deixe vazio para acesso sem produto."}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="feature-sort-order">Ordem de exibição</Label>
            <Input
              id="feature-sort-order"
              type="number"
              min={0}
              value={formData.sortOrder}
              onChange={(e) => setFormField("sortOrder", e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Beta</span>
              <span className="text-xs text-muted-foreground">
                Liberar apenas para masters configurados no Grupo Beta e respeitar o escopo de times.
              </span>
            </div>
            <Switch
              checked={formData.betaEnabled}
              onCheckedChange={(v) => setFormField("betaEnabled", v)}
              disabled={isSaving || isInheritingFromParent}
            />
          </div>

          {showChargeDuringBeta && (
            <div
              className={cn(
                "flex items-center justify-between rounded-md border px-3 py-2.5",
                chargeDuringBetaInvalid && "border-destructive/50 bg-destructive/5"
              )}
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Cobrar durante o beta</span>
                <span
                  className={cn(
                    "text-xs",
                    chargeDuringBetaInvalid ? "text-amber-600" : "text-muted-foreground"
                  )}
                >
                  {chargeDuringBetaHint ?? CHARGE_DURING_BETA_HINT}
                </span>
                {isInheritingFromParent && (
                  <span className="text-xs text-muted-foreground">
                    Cobrança beta herdada da funcionalidade pai.
                  </span>
                )}
              </div>
              <Switch
                checked={formData.chargeDuringBeta}
                onCheckedChange={(v) => setFormField("chargeDuringBeta", v)}
                disabled={isSaving || isInheritingFromParent}
              />
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Ativo</span>
              <span className="text-xs text-muted-foreground">
                Funcionalidade desativada não é avaliada no acesso.
              </span>
            </div>
            <Switch
              checked={formData.isActive}
              onCheckedChange={(v) => setFormField("isActive", v)}
              disabled={isSaving}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeDialog} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={submitForm} disabled={saveBlocked}>
            {isSaving && <Loader2 data-icon="inline-start" className="animate-spin" />}
            {isEdit ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
