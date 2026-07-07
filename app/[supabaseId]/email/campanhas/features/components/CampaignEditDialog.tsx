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
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { useCampanhasContext } from "../context/CampanhasContext"
import { useTimezone } from "@/app/context/TimezoneContext"
import type { ContactList } from "../context/CampanhasTypes"

function formatContactListLabel(list: ContactList): string {
  const activeCount = list.activeContacts ?? list.totalContacts
  return `${list.name} (${activeCount.toLocaleString("pt-BR")} ativos)`
}

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

  return (
    <Dialog open={!!editingCampaign} onOpenChange={(open) => { if (!open) closeEdit() }}>
      <DialogContent className="max-h-[90vh] flex flex-col max-w-md">
        <DialogHeader>
          <DialogTitle>Editar campanha</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-name">Nome da campanha *</Label>
            <Input
              id="edit-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              disabled={editSaving}
              placeholder="Ex: Newsletter Junho 2026"
            />
          </div>

          <div className="flex flex-col gap-2">
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

          <div className="flex flex-col gap-2">
            <Label>Lista de contatos</Label>
            <Select value={editContactListId} onValueChange={setEditContactListId} disabled={editSaving}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma lista..." />
              </SelectTrigger>
              <SelectContent>
                {contactLists.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {formatContactListLabel(l)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <DateTimePicker
              date={editScheduledAt}
              onDateChange={setEditScheduledAt}
              label="Agendar envio (opcional)"
              disabled={editSaving}
              disablePastDates
              tz={tz}
            />
            {editScheduledAt ? (
              <button
                type="button"
                onClick={() => setEditScheduledAt(undefined)}
                className="text-xs text-muted-foreground underline underline-offset-2"
              >
                Remover agendamento
              </button>
            ) : null}
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
