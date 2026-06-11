"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Copy, MoreHorizontal, Pencil, Plus, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { useBackofficeEmailTemplates } from "../context/BackofficeEmailTemplatesHook"
import type { CreateTemplateFormData, UpdateTemplateFormData } from "../services/IBackofficeEmailTemplatesService"
import { CreateTemplateDialog } from "../components/CreateTemplateDialog"
import { EditTemplateDialog } from "../components/EditTemplateDialog"
import { DeleteTemplateConfirmDialog } from "../components/DeleteTemplateConfirmDialog"

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "outline" | "secondary" }> = {
  published: { label: "Publicado", variant: "default" },
  draft: { label: "Rascunho", variant: "outline" },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function BackofficeEmailTemplatesContainer() {
  const {
    templates,
    isLoading,
    isCreating,
    isUpdating,
    isRemoving,
    isPublishing,
    isDuplicating,
    canManage,
    getTemplate,
    createTemplate,
    updateTemplate,
    removeTemplate,
    publishTemplate,
    duplicateTemplate,
  } = useBackofficeEmailTemplates()

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [selectedTemplateName, setSelectedTemplateName] = useState("")

  async function handleCreate(data: CreateTemplateFormData) {
    const result = await createTemplate(data)
    if (result.isValid) {
      toast.success("Template criado com sucesso")
      setCreateOpen(false)
    } else {
      toast.error(result.errorMessages?.[0] ?? "Erro ao criar template")
    }
  }

  function handleEditOpen(id: string) {
    setSelectedTemplateId(id)
    setEditOpen(true)
  }

  function handleEditOpenChange(next: boolean) {
    setEditOpen(next)
    if (!next) setSelectedTemplateId(null)
  }

  async function handleUpdate(id: string, data: UpdateTemplateFormData) {
    const result = await updateTemplate(id, data)
    if (result.isValid) {
      toast.success("Template atualizado com sucesso")
      setEditOpen(false)
      setSelectedTemplateId(null)
    } else {
      toast.error(result.errorMessages?.[0] ?? "Erro ao atualizar template")
    }
  }

  async function handlePublish(id: string) {
    const result = await publishTemplate(id)
    if (result.isValid) {
      toast.success("Template publicado com sucesso")
      setEditOpen(false)
      setSelectedTemplateId(null)
    } else {
      toast.error(result.errorMessages?.[0] ?? "Erro ao publicar template")
    }
  }

  async function handlePublishFromList(id: string) {
    const result = await publishTemplate(id)
    if (result.isValid) {
      toast.success("Template publicado com sucesso")
    } else {
      toast.error(result.errorMessages?.[0] ?? "Erro ao publicar template")
    }
  }

  function handleDeleteOpen(id: string, name: string) {
    setSelectedTemplateId(id)
    setSelectedTemplateName(name)
    setDeleteOpen(true)
  }

  function handleDeleteOpenChange(next: boolean) {
    setDeleteOpen(next)
    if (!next) {
      setSelectedTemplateId(null)
      setSelectedTemplateName("")
    }
  }

  async function handleDelete() {
    if (!selectedTemplateId) return
    const result = await removeTemplate(selectedTemplateId)
    if (result.isValid) {
      toast.success("Template excluído com sucesso")
      setDeleteOpen(false)
      setSelectedTemplateId(null)
      setSelectedTemplateName("")
    } else {
      toast.error(result.errorMessages?.[0] ?? "Erro ao excluir template")
    }
  }

  async function handleDuplicate(id: string, name: string) {
    const result = await duplicateTemplate(id)
    if (result.isValid) {
      toast.success(`"${name}" duplicado com sucesso`)
    } else {
      toast.error(result.errorMessages?.[0] ?? "Erro ao duplicar template")
    }
  }

  async function handleCopyId(id: string) {
    try {
      await navigator.clipboard.writeText(id)
      toast.success("ID copiado")
    } catch {
      toast.error("Não foi possível copiar o ID")
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Templates de E-mail</h1>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)} disabled={isDuplicating}>
            <Plus data-icon="inline-start" />
            Criar template
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Alias</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assunto</TableHead>
              <TableHead>Publicado em</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum template de e-mail encontrado
                </TableCell>
              </TableRow>
            ) : (
              templates.map((t) => {
                const statusInfo = STATUS_LABELS[t.status] ?? { label: t.status, variant: "secondary" as const }
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {t.alias ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">—</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {t.published_at ? formatDate(t.published_at) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(t.created_at)}
                    </TableCell>
                    <TableCell>
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Ações de ${t.name}`}>
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                              <DropdownMenuItem onClick={() => handleEditOpen(t.id)}>
                                <Pencil />
                                Editar
                              </DropdownMenuItem>
                              {t.status === "draft" && (
                                <DropdownMenuItem onClick={() => handlePublishFromList(t.id)} disabled={isPublishing}>
                                  <Upload />
                                  Publicar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleDuplicate(t.id, t.name)} disabled={isDuplicating}>
                                <Copy />
                                Duplicar
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuItem onClick={() => handleCopyId(t.id)}>
                                <Copy />
                                Copiar ID
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteOpen(t.id, t.name)}
                              disabled={isRemoving}
                              className="text-destructive focus:text-destructive"
                            >
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <CreateTemplateDialog
        open={createOpen}
        isCreating={isCreating}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
      />

      <EditTemplateDialog
        open={editOpen}
        templateId={selectedTemplateId}
        isUpdating={isUpdating}
        isPublishing={isPublishing}
        onOpenChange={handleEditOpenChange}
        onLoadTemplate={getTemplate}
        onUpdate={handleUpdate}
        onPublish={handlePublish}
      />

      <DeleteTemplateConfirmDialog
        open={deleteOpen}
        templateName={selectedTemplateName}
        isRemoving={isRemoving}
        onOpenChange={handleDeleteOpenChange}
        onConfirm={handleDelete}
      />
    </div>
  )
}
