"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MonacoCodeEditor } from "@/components/editors/MonacoCodeEditor"
import type {
  TemplateDetail,
  UpdateTemplateFormData,
  VariableFormItem,
} from "../services/IBackofficeEmailTemplatesService"
import { HtmlEmailPreview } from "./HtmlEmailPreview"

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
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>Editar template de e-mail</DialogTitle>
        </DialogHeader>
        {isLoadingTemplate ? (
          <div className="flex flex-1 gap-6 overflow-hidden min-h-0">
            <div className="w-80 shrink-0 flex flex-col gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
            <Skeleton className="flex-1 h-120" />
          </div>
        ) : (
          <form
            id="edit-template-form"
            onSubmit={handleSubmit}
            className="flex flex-1 gap-6 overflow-hidden min-h-0"
          >
            <div className="w-80 shrink-0 flex flex-col gap-4 overflow-y-auto pr-2">
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
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label>Variáveis</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addVariable}>
                    <Plus data-icon="inline-start" />
                    Adicionar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">
                  Use{" "}
                  <code className="font-mono bg-muted px-1 rounded text-[11px]">
                    {"{{{CHAVE}}}"}
                  </code>{" "}
                  no HTML para inserir variáveis.
                </p>
                {(form.variables ?? []).map((v, i) => (
                  <div key={i} className="flex flex-col gap-1.5 rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="NOME_DA_VARIAVEL"
                        value={v.key}
                        onChange={(e) => updateVariable(i, "key", e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                        className="font-mono text-xs flex-1"
                      />
                      <Select
                        value={v.type}
                        onValueChange={(val) => updateVariable(i, "type", val)}
                      >
                        <SelectTrigger className="w-24 shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="string">string</SelectItem>
                          <SelectItem value="number">number</SelectItem>
                        </SelectContent>
                      </Select>
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
                    <Input
                      placeholder="Valor padrão (usado no preview)"
                      value={v.fallbackValue ?? ""}
                      onChange={(e) => updateVariable(i, "fallbackValue", e.target.value)}
                      className="text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-2 min-h-0">
              <Tabs defaultValue="html" className="flex flex-col flex-1">
                <TabsList className="self-start">
                  <TabsTrigger value="html">HTML</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                <TabsContent value="html" className="mt-2 flex-1">
                  <div className="h-120 rounded-md overflow-hidden border">
                    <MonacoCodeEditor
                      value={form.html ?? ""}
                      onChange={(val) => handleChange("html", val)}
                      language="html"
                      height={480}
                      themeVariant="resend-dark"
                    />
                  </div>
                </TabsContent>
                <TabsContent value="preview" className="mt-2 flex-1">
                  <div className="h-120">
                    <HtmlEmailPreview
                      html={form.html ?? ""}
                      variables={form.variables ?? []}
                    />
                  </div>
                </TabsContent>
              </Tabs>
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
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isUpdating}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="edit-template-form"
            disabled={isUpdating || isLoadingTemplate}
          >
            {isUpdating ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
