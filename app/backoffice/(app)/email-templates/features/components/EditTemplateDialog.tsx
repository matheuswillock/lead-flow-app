"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  TemplateDetail,
  UpdateTemplateFormData,
  VariableFormItem,
} from "../services/IBackofficeEmailTemplatesService"

interface Props {
  open: boolean
  templateId: string | null
  isUpdating: boolean
  isPublishing: boolean
  onOpenChange(open: boolean): void
  onLoadTemplate(id: string): Promise<TemplateDetail | null>
  onUpdate(id: string, data: UpdateTemplateFormData): Promise<void>
  onPublish(id: string): Promise<void>
}

export function EditTemplateDialog({
  open,
  templateId,
  isUpdating,
  isPublishing,
  onOpenChange,
  onLoadTemplate,
  onUpdate,
  onPublish,
}: Props) {
  const [template, setTemplate] = useState<TemplateDetail | null>(null)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false)
  const [form, setForm] = useState<UpdateTemplateFormData>({})

  useEffect(() => {
    if (!open || !templateId) return
    setIsLoadingTemplate(true)
    onLoadTemplate(templateId).then((t) => {
      setTemplate(t)
      if (t) {
        setForm({
          name: t.name,
          html: t.html ?? "",
          alias: t.alias ?? "",
          from: t.from ?? "",
          subject: t.subject ?? "",
          replyTo: Array.isArray(t.reply_to) ? t.reply_to.join(", ") : (t.reply_to ?? ""),
          text: t.text ?? "",
          variables: (t.variables ?? []).map((v) => ({
            key: v.key,
            type: v.type,
            fallbackValue: v.fallback_value !== null ? String(v.fallback_value) : "",
          })),
        })
      }
      setIsLoadingTemplate(false)
    })
  }, [open, templateId, onLoadTemplate])

  function handleChange(field: keyof Omit<UpdateTemplateFormData, "variables">, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function addVariable() {
    setForm((prev) => ({
      ...prev,
      variables: [...(prev.variables ?? []), { key: "", type: "string", fallbackValue: "" }],
    }))
  }

  function removeVariable(index: number) {
    setForm((prev) => ({
      ...prev,
      variables: (prev.variables ?? []).filter((_, i) => i !== index),
    }))
  }

  function updateVariable(index: number, field: keyof VariableFormItem, value: string) {
    setForm((prev) => {
      const variables = [...(prev.variables ?? [])]
      variables[index] = { ...variables[index], [field]: value }
      return { ...prev, variables }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!templateId) return
    await onUpdate(templateId, form)
  }

  async function handlePublish() {
    if (!templateId) return
    await onPublish(templateId)
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setTemplate(null)
      setForm({})
    }
    onOpenChange(next)
  }

  const isDraft = template?.status === "draft"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar template de e-mail</DialogTitle>
        </DialogHeader>
        {isLoadingTemplate ? (
          <div className="flex flex-col gap-3 flex-1 px-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <form id="edit-template-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 flex flex-col gap-4 px-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="et-name">Nome</Label>
              <Input
                id="et-name"
                value={form.name ?? ""}
                onChange={(e) => handleChange("name", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="et-alias">Alias</Label>
              <Input
                id="et-alias"
                value={form.alias ?? ""}
                onChange={(e) => handleChange("alias", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="et-subject">Assunto</Label>
              <Input
                id="et-subject"
                value={form.subject ?? ""}
                onChange={(e) => handleChange("subject", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="et-from">Remetente</Label>
              <Input
                id="et-from"
                value={form.from ?? ""}
                onChange={(e) => handleChange("from", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="et-reply-to">Reply-to</Label>
              <Input
                id="et-reply-to"
                value={form.replyTo ?? ""}
                onChange={(e) => handleChange("replyTo", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="et-html">HTML</Label>
              <Textarea
                id="et-html"
                value={form.html ?? ""}
                onChange={(e) => handleChange("html", e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Variáveis</Label>
                <Button type="button" variant="outline" size="sm" onClick={addVariable}>
                  <Plus data-icon="inline-start" />
                  Adicionar variável
                </Button>
              </div>
              {(form.variables ?? []).length > 0 && (
                <div className="flex flex-col gap-2">
                  {(form.variables ?? []).map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        placeholder="CHAVE"
                        value={v.key}
                        onChange={(e) => updateVariable(i, "key", e.target.value)}
                        className="font-mono text-xs uppercase"
                      />
                      <Select value={v.type} onValueChange={(val) => updateVariable(i, "type", val)}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="string">string</SelectItem>
                          <SelectItem value="number">number</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Valor padrão"
                        value={v.fallbackValue ?? ""}
                        onChange={(e) => updateVariable(i, "fallbackValue", e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        onClick={() => removeVariable(i)}
                        aria-label="Remover variável"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        )}
        <DialogFooter className="flex-wrap gap-2">
          {isDraft && (
            <Button
              type="button"
              variant="outline"
              onClick={handlePublish}
              disabled={isPublishing || isLoadingTemplate}
              className="mr-auto"
            >
              {isPublishing ? "Publicando..." : "Publicar"}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isUpdating}>
            Cancelar
          </Button>
          <Button type="submit" form="edit-template-form" disabled={isUpdating || isLoadingTemplate}>
            {isUpdating ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
