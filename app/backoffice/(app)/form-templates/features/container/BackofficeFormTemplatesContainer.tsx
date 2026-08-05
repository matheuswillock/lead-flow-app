"use client"

import Link from "next/link"
import { toast } from "sonner"
import { MoreHorizontal, Pencil, Plus, Upload, Download } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useBackofficeFormTemplates } from "../context/BackofficeFormTemplatesContext"

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function BackofficeFormTemplatesContainer() {
  const { items, isLoading, isSaving, canManage, publishItem, unpublishItem } =
    useBackofficeFormTemplates()

  async function handlePublish(id: string) {
    const result = await publishItem(id)
    if (result.isValid) {
      toast.success("Template publicado com sucesso")
    } else {
      toast.error(result.errorMessages?.[0] ?? "Erro ao publicar template")
    }
  }

  async function handleUnpublish(id: string) {
    const result = await unpublishItem(id)
    if (result.isValid) {
      toast.success("Template despublicado com sucesso")
    } else {
      toast.error(result.errorMessages?.[0] ?? "Erro ao despublicar template")
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold">Templates de formulário</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie templates globais disponíveis no catálogo de formulários públicos.
          </p>
        </div>
        {canManage ? (
          <Button size="sm" asChild>
            <Link href="/backoffice/form-templates/new">
              <Plus data-icon="inline-start" />
              Novo template
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Ordem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Atualizado em</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 7 }).map((__, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Nenhum template cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="font-mono text-sm">{item.slug}</TableCell>
                  <TableCell>{item.formKind}</TableCell>
                  <TableCell>{item.sortOrder}</TableCell>
                  <TableCell>
                    <Badge variant={item.isActive ? "default" : "outline"}>
                      {item.isActive ? "Publicado" : "Rascunho"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(item.updatedAt)}
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Abrir ações">
                            <MoreHorizontal data-icon="inline-start" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuGroup>
                            <DropdownMenuItem asChild>
                              <Link href={`/backoffice/form-templates/${item.id}`}>
                                <Pencil data-icon="inline-start" />
                                Editar
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                            {item.isActive ? (
                              <DropdownMenuItem
                                disabled={isSaving}
                                onSelect={() => void handleUnpublish(item.id)}
                              >
                                <Download data-icon="inline-start" />
                                Despublicar
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                disabled={isSaving}
                                onSelect={() => void handlePublish(item.id)}
                              >
                                <Upload data-icon="inline-start" />
                                Publicar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
