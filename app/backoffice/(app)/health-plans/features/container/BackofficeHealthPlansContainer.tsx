"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Check, Pencil, Plus, Trash2, Upload, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useBackofficeHealthPlans } from "../context/BackofficeHealthPlansContext"
import type { BackofficeHealthPlanItem } from "../services/IBackofficeHealthPlansService"

type FormState = {
  id?: string
  name: string
  iconUrl: string
  isDefault: boolean
}

const emptyForm: FormState = {
  name: "",
  iconUrl: "",
  isDefault: false,
}

export function BackofficeHealthPlansContainer() {
  const { items, isLoading, isSaving, createItem, updateItem, deactivateItem, uploadIcon } = useBackofficeHealthPlans()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)

  const defaultItem = useMemo(() => items.find((item) => item.isDefault && item.isActive) ?? null, [items])

  function startCreate() {
    setForm(emptyForm)
    setOpen(true)
  }

  function startEdit(item: BackofficeHealthPlanItem) {
    setForm({
      id: item.id,
      name: item.name,
      iconUrl: item.iconUrl ?? "",
      isDefault: item.isDefault,
    })
    setOpen(true)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const payload = {
      name: form.name,
      iconUrl: form.iconUrl.trim() || null,
      isDefault: form.isDefault,
    }
    const result = form.id ? await updateItem(form.id, payload) : await createItem(payload)
    if (!result.isValid) {
      toast.error(result.errorMessages?.[0] ?? "Erro ao salvar operadora")
      return
    }
    toast.success(form.id ? "Operadora atualizada com sucesso" : "Operadora criada com sucesso")
    setOpen(false)
    setForm(emptyForm)
  }

  async function handleDeactivate(item: BackofficeHealthPlanItem) {
    const result = await deactivateItem(item.id)
    if (!result.isValid) {
      toast.error(result.errorMessages?.[0] ?? "Erro ao inativar operadora")
      return
    }
    toast.success("Operadora inativada com sucesso")
  }

  async function handleIconUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const result = await uploadIcon(file)
    if (!result.isValid || !result.result?.iconUrl) {
      toast.error(result.errorMessages?.[0] ?? "Erro ao enviar ícone")
      return
    }
    setForm((prev) => ({ ...prev, iconUrl: result.result?.iconUrl ?? "" }))
    toast.success("Ícone enviado com sucesso")
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold">Operadoras</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie catálogo de operadoras, ícone e tag default.
          </p>
        </div>
        <Button size="sm" onClick={startCreate}>
          <Plus data-icon="inline-start" />
          Nova operadora
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Operadora</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 4 }).map((__, skeletonIndex) => (
                    <TableCell key={skeletonIndex}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  Nenhuma operadora cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {item.iconUrl ? (
                        <img src={item.iconUrl} alt={item.name} className="size-6 rounded-md border object-cover" />
                      ) : (
                        <div className="size-6 rounded-md border bg-muted" />
                      )}
                      <span className="font-medium">{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.isActive ? "default" : "secondary"}>
                      {item.isActive ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.isDefault ? (
                      <Badge variant="outline">Default</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(item)} aria-label={`Editar ${item.name}`}>
                        <Pencil />
                      </Button>
                      {item.isActive ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleDeactivate(item)}
                          aria-label={`Inativar ${item.name}`}
                        >
                          <Trash2 />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar operadora" : "Nova operadora"}</DialogTitle>
            <DialogDescription>
              {defaultItem && !form.isDefault ? `Default atual: ${defaultItem.name}.` : "Configure nome, ícone e default."}
            </DialogDescription>
          </DialogHeader>
          <form className="flex flex-col gap-4 overflow-y-auto" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="operadora-name">Nome</Label>
              <Input
                id="operadora-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="operadora-icon-url">URL do ícone</Label>
              <Input
                id="operadora-icon-url"
                value={form.iconUrl}
                placeholder="https://..."
                onChange={(event) => setForm((prev) => ({ ...prev, iconUrl: event.target.value }))}
              />
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="operadora-icon-file"
                  className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm"
                >
                  <Upload className="size-4" />
                  Upload ícone
                </Label>
                <Input id="operadora-icon-file" type="file" className="hidden" accept="image/*" onChange={handleIconUpload} />
                {form.iconUrl ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setForm((prev) => ({ ...prev, iconUrl: "" }))}>
                    <X />
                    Remover URL
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={form.isDefault ? "default" : "outline"}
                onClick={() => setForm((prev) => ({ ...prev, isDefault: !prev.isDefault }))}
              >
                <Check data-icon="inline-start" />
                Marcar como default
              </Button>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
