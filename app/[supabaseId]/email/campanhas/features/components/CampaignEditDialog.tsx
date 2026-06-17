"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCampanhasContext } from "../context/CampanhasContext"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatLocalInputValue } from "@/lib/dates"

export function CampaignEditDialog() {
  const { tz } = useTimezone()
  const {
    editingCampaign,
    editName,
    editTemplateId,
    editContactListId,
    editScheduledAt,
    editSaving,
    templates,
    contactLists,
    closeEdit,
    setEditName,
    setEditTemplateId,
    setEditContactListId,
    setEditScheduledAt,
    handleUpdateCampaign,
  } = useCampanhasContext()

  const minDateTime = formatLocalInputValue(new Date(), tz)

  return (
    <Dialog open={!!editingCampaign} onOpenChange={(open) => { if (!open) closeEdit() }}>
      <DialogContent className="max-h-[90vh] flex flex-col max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Rascunho</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nome da campanha *</Label>
            <Input
              id="edit-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              disabled={editSaving}
              placeholder="Ex: Newsletter Junho 2026"
            />
          </div>

          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={editTemplateId} onValueChange={setEditTemplateId} disabled={editSaving}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Lista de contatos</Label>
            <Select value={editContactListId} onValueChange={setEditContactListId} disabled={editSaving}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma lista..." />
              </SelectTrigger>
              <SelectContent>
                {contactLists.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name} ({l.totalContacts.toLocaleString("pt-BR")} contatos)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-scheduled">Agendar envio (opcional)</Label>
            <Input
              id="edit-scheduled"
              type="datetime-local"
              value={editScheduledAt}
              min={minDateTime}
              onChange={(e) => setEditScheduledAt(e.target.value)}
              disabled={editSaving}
            />
            {editScheduledAt && (
              <button
                type="button"
                onClick={() => setEditScheduledAt("")}
                className="text-xs text-muted-foreground underline underline-offset-2"
              >
                Remover agendamento
              </button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeEdit} disabled={editSaving}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleUpdateCampaign()}
            disabled={editSaving || !editName.trim()}
          >
            {editSaving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
