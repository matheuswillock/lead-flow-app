"use client"

import { useCallback, useEffect, useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useTeamContext } from "@/app/context/TeamContext"
import { useUserContext } from "@/app/context/UserContext"
import { isManagerLikeRole } from "@/lib/roles"
import {
  WHATSAPP_TAG_COLOR_TOKENS,
  whatsAppTagBadgeClassName,
  type WhatsAppTagColorToken,
} from "@/lib/whatsapp/tag-colors"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { API_CLIENT_BASE } from "@/lib/route-map";

interface WhatsAppTag {
  id: string
  name: string
  color: string
  sortOrder: number
}

export function TagManagerCard() {
  const { activeTeamId, activeTeam, isTeamMaster } = useTeamContext()
  const { user } = useUserContext()
  const canManage = isTeamMaster || isManagerLikeRole(activeTeam?.role)

  const [tags, setTags] = useState<WhatsAppTag[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<WhatsAppTag | null>(null)
  const [name, setName] = useState("")
  const [color, setColor] = useState<WhatsAppTagColorToken>("primary")
  const [isSaving, setIsSaving] = useState(false)

  const loadTags = useCallback(async () => {
    if (!activeTeamId || !user?.id) return

    setIsLoading(true)
    try {
      const response = await fetch(`${API_CLIENT_BASE}/teams/${activeTeamId}/whatsapp/tags`, {
        headers: {
          "x-supabase-user-id": user.id,
          "x-team-id": activeTeamId,
        },
      })
      const output = (await response.json()) as {
        isValid?: boolean
        result?: { tags?: WhatsAppTag[] }
        errorMessages?: string[]
      }
      if (!response.ok || !output.isValid) {
        throw new Error(output.errorMessages?.join(", ") ?? "Não foi possível carregar as tags")
      }
      setTags(output.result?.tags ?? [])
    } catch (error) {
      console.error("[TagManagerCard] loadTags", error)
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar as tags")
    } finally {
      setIsLoading(false)
    }
  }, [activeTeamId, user?.id])

  useEffect(() => {
    void loadTags()
  }, [loadTags])

  const openCreateDialog = () => {
    setEditingTag(null)
    setName("")
    setColor("primary")
    setDialogOpen(true)
  }

  const openEditDialog = (tag: WhatsAppTag) => {
    setEditingTag(tag)
    setName(tag.name)
    setColor(
      WHATSAPP_TAG_COLOR_TOKENS.includes(tag.color as WhatsAppTagColorToken)
        ? (tag.color as WhatsAppTagColorToken)
        : "primary"
    )
    setDialogOpen(true)
  }

  const saveTag = async () => {
    if (!activeTeamId || !user?.id || isSaving) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error("Informe o nome da tag")
      return
    }

    setIsSaving(true)
    try {
      const url = editingTag
        ? `${API_CLIENT_BASE}/teams/${activeTeamId}/whatsapp/tags/${editingTag.id}`
        : `${API_CLIENT_BASE}/teams/${activeTeamId}/whatsapp/tags`
      const response = await fetch(url, {
        method: editingTag ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": user.id,
          "x-team-id": activeTeamId,
        },
        body: JSON.stringify({ name: trimmedName, color }),
      })
      const output = (await response.json()) as {
        isValid?: boolean
        errorMessages?: string[]
      }
      if (!response.ok || !output.isValid) {
        throw new Error(output.errorMessages?.join(", ") ?? "Não foi possível salvar a tag")
      }
      toast.success(editingTag ? "Tag atualizada" : "Tag criada")
      setDialogOpen(false)
      await loadTags()
    } catch (error) {
      console.error("[TagManagerCard] saveTag", error)
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a tag")
    } finally {
      setIsSaving(false)
    }
  }

  const deleteTag = async (tag: WhatsAppTag) => {
    if (!activeTeamId || !user?.id || isSaving) return

    setIsSaving(true)
    try {
      const response = await fetch(`${API_CLIENT_BASE}/teams/${activeTeamId}/whatsapp/tags/${tag.id}`, {
        method: "DELETE",
        headers: {
          "x-supabase-user-id": user.id,
          "x-team-id": activeTeamId,
        },
      })
      const output = (await response.json()) as {
        isValid?: boolean
        errorMessages?: string[]
      }
      if (!response.ok || !output.isValid) {
        throw new Error(output.errorMessages?.join(", ") ?? "Não foi possível excluir a tag")
      }
      toast.success("Tag excluída")
      await loadTags()
    } catch (error) {
      console.error("[TagManagerCard] deleteTag", error)
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir a tag")
    } finally {
      setIsSaving(false)
    }
  }

  if (!canManage) {
    return null
  }

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Tags de conversa</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize conversas do inbox com tags visíveis para todo o time.
          </p>
        </div>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus data-icon="inline-start" />
          Nova tag
        </Button>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando tags...</p>
        ) : tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma tag cadastrada.</p>
        ) : (
          tags.map((tag) => (
            <div key={tag.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
              <Badge variant="outline" className={cn("font-normal", whatsAppTagBadgeClassName(tag.color))}>
                {tag.name}
              </Badge>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEditDialog(tag)} disabled={isSaving}>
                  <Pencil />
                  <span className="sr-only">Editar tag</span>
                </Button>
                <Button variant="ghost" size="icon" onClick={() => void deleteTag(tag)} disabled={isSaving}>
                  <Trash2 />
                  <span className="sr-only">Excluir tag</span>
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingTag ? "Editar tag" : "Nova tag"}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="tag-name">Nome</FieldLabel>
                <Input
                  id="tag-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ex.: Urgente"
                />
              </Field>
              <Field>
                <FieldLabel>Cor</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {WHATSAPP_TAG_COLOR_TOKENS.map((token) => (
                    <Button
                      key={token}
                      type="button"
                      variant={color === token ? "default" : "outline"}
                      size="sm"
                      onClick={() => setColor(token)}
                    >
                      <Badge variant="outline" className={cn("font-normal", whatsAppTagBadgeClassName(token))}>
                        {token}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </Field>
            </FieldGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={() => void saveTag()} disabled={isSaving || !name.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
