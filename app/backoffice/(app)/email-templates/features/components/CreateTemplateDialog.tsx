"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import type { CreateTemplateFormData, VariableFormItem } from "../services/IBackofficeEmailTemplatesService"
import { HtmlEmailPreview } from "./HtmlEmailPreview"

const EDITOR_HEIGHT = 480

const EMPTY_FORM: CreateTemplateFormData = {
  name: "",
  html: "",
  alias: "",
  from: "",
  subject: "",
  replyTo: "",
  text: "",
  variables: [],
}

interface Props {
  open: boolean
  isCreating: boolean
  onOpenChange(open: boolean): void
  onSubmit(data: CreateTemplateFormData): Promise<void>
}

export function CreateTemplateDialog({ open, isCreating, onOpenChange, onSubmit }: Props) {
  const [form, setForm] = useState<CreateTemplateFormData>(EMPTY_FORM)

  function handleChange(field: keyof Omit<CreateTemplateFormData, "variables">, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function addVariable() {
    setForm((prev) => ({
      ...prev,
      variables: [{ key: "", type: "string", fallbackValue: "" }, ...prev.variables],
    }))
  }

  function removeVariable(index: number) {
    setForm((prev) => ({
      ...prev,
      variables: prev.variables.filter((_, i) => i !== index),
    }))
  }

  function updateVariable(index: number, field: keyof VariableFormItem, value: string) {
    setForm((prev) => {
      const variables = [...prev.variables]
      variables[index] = { ...variables[index], [field]: value }
      return { ...prev, variables }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await onSubmit(form)
  }

  function handleOpenChange(next: boolean) {
    if (!next) setForm(EMPTY_FORM)
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>Criar template de e-mail</DialogTitle>
        </DialogHeader>
        <form
          id="create-template-form"
          onSubmit={handleSubmit}
          className="flex flex-1 gap-6 overflow-hidden min-h-0"
        >
          <div className="w-80 shrink-0 flex flex-col gap-4 overflow-y-auto pr-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ct-name">Nome *</Label>
              <Input
                id="ct-name"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="ex: boas-vindas"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ct-alias">Alias</Label>
              <Input
                id="ct-alias"
                value={form.alias}
                onChange={(e) => handleChange("alias", e.target.value)}
                placeholder="ex: welcome-email"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ct-subject">Assunto padrão</Label>
              <Input
                id="ct-subject"
                value={form.subject}
                onChange={(e) => handleChange("subject", e.target.value)}
                placeholder="ex: Bem-vindo ao Corretor Studio!"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ct-from">Remetente padrão</Label>
              <Input
                id="ct-from"
                value={form.from}
                onChange={(e) => handleChange("from", e.target.value)}
                placeholder="ex: Corretor Studio <nao-responda@corretorstudio.com>"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ct-reply-to">Reply-to</Label>
              <Input
                id="ct-reply-to"
                value={form.replyTo}
                onChange={(e) => handleChange("replyTo", e.target.value)}
                placeholder="ex: suporte@corretorstudio.com"
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
              {form.variables.map((v, i) => (
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
                    value={form.html}
                    onChange={(val) => handleChange("html", val)}
                    language="html"
                    height={480}
                    themeVariant="resend-dark"
                    placeholder="<p>Olá, {{{NOME}}}!</p>"
                  />
                </div>
              </TabsContent>
              <TabsContent value="preview" className="mt-2 flex-1">
                <div className="h-120">
                  <HtmlEmailPreview html={form.html} variables={form.variables} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isCreating}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="create-template-form"
            disabled={isCreating || !form.name || !form.html}
          >
            {isCreating ? "Criando..." : "Criar template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
