"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import type { CreateTemplateFormData, VariableFormItem } from "../services/IBackofficeEmailTemplatesService"

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
      variables: [...prev.variables, { key: "", type: "string", fallbackValue: "" }],
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
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Criar template de e-mail</DialogTitle>
        </DialogHeader>
        <form id="create-template-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 flex flex-col gap-4 px-1">
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="ct-html">HTML *</Label>
            <Textarea
              id="ct-html"
              value={form.html}
              onChange={(e) => handleChange("html", e.target.value)}
              placeholder="<p>Olá, {{{NOME}}}!</p>"
              rows={8}
              required
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
            {form.variables.length > 0 && (
              <div className="flex flex-col gap-2">
                {form.variables.map((v, i) => (
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
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isCreating}>
            Cancelar
          </Button>
          <Button type="submit" form="create-template-form" disabled={isCreating || !form.name || !form.html}>
            {isCreating ? "Criando..." : "Criar template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
