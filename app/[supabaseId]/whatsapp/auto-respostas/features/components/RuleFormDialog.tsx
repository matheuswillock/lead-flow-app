"use client"

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  OffHoursSchedule,
  WhatsAppAutoResponseMatchMode,
  WhatsAppAutoResponseRule,
} from '../context/WhatsAppAutoResponsesTypes'
import { useWhatsAppAutoResponsesContext } from '../context/WhatsAppAutoResponsesContext'
import { OffHoursScheduleEditor } from './OffHoursScheduleEditor'

interface RuleFormDialogProps {
  rule: WhatsAppAutoResponseRule
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RuleFormDialog({ rule, open, onOpenChange }: RuleFormDialogProps) {
  const { updateRule, isSaving } = useWhatsAppAutoResponsesContext()
  const [replyMessage, setReplyMessage] = useState(rule.replyMessage)
  const [keywordsText, setKeywordsText] = useState(rule.triggerKeywords.join(', '))
  const [matchMode, setMatchMode] = useState<WhatsAppAutoResponseMatchMode>(rule.matchMode)
  const [offHoursSchedule, setOffHoursSchedule] = useState<OffHoursSchedule | null>(
    rule.offHoursSchedule
  )

  useEffect(() => {
    if (!open) return
    setReplyMessage(rule.replyMessage)
    setKeywordsText(rule.triggerKeywords.join(', '))
    setMatchMode(rule.matchMode)
    setOffHoursSchedule(rule.offHoursSchedule)
  }, [open, rule])

  const handleSave = async () => {
    const payload: Parameters<typeof updateRule>[1] = {
      replyMessage: replyMessage.trim(),
    }

    if (rule.type === 'KEYWORD') {
      payload.triggerKeywords = keywordsText
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
      payload.matchMode = matchMode
    }

    if (rule.type === 'OFF_HOURS') {
      payload.offHoursSchedule = offHoursSchedule
    }

    await updateRule(rule.id, payload)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar regra</DialogTitle>
          <DialogDescription>
            Configure a mensagem automática enviada pelo WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="replyMessage">Mensagem de resposta</FieldLabel>
              <Textarea
                id="replyMessage"
                value={replyMessage}
                onChange={(event) => setReplyMessage(event.target.value)}
                rows={5}
                placeholder="Digite a mensagem que será enviada automaticamente"
              />
            </Field>

            {rule.type === 'KEYWORD' && (
              <>
                <Field>
                  <FieldLabel htmlFor="keywords">Palavras-chave (separadas por vírgula)</FieldLabel>
                  <Input
                    id="keywords"
                    value={keywordsText}
                    onChange={(event) => setKeywordsText(event.target.value)}
                    placeholder="preço, plano, cotação"
                  />
                </Field>
                <Field>
                  <FieldLabel>Modo de correspondência</FieldLabel>
                  <Select value={matchMode} onValueChange={(value) => setMatchMode(value as WhatsAppAutoResponseMatchMode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CONTAINS">Contém</SelectItem>
                      <SelectItem value="STARTS_WITH">Começa com</SelectItem>
                      <SelectItem value="EXACT">Exata</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </>
            )}

            {rule.type === 'OFF_HOURS' && (
              <OffHoursScheduleEditor value={offHoursSchedule} onChange={setOffHoursSchedule} />
            )}
          </FieldGroup>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={isSaving || !replyMessage.trim()}
            onClick={() => {
              handleSave().catch(() => undefined)
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
