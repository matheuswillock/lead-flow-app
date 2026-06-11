'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { useDialerContext } from '../context/DialerContext'

export function CreateCampaignDialog() {
  const { creating, handleCreateCampaign } = useDialerContext()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const isValid = name.trim().length > 0

  const handleSubmit = async () => {
    if (!isValid || creating) return
    const campaign = await handleCreateCampaign({
      name: name.trim(),
      description: description.trim() || null,
    })
    if (campaign) {
      setName('')
      setDescription('')
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          Nova campanha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Nova campanha de discagem</DialogTitle>
          <DialogDescription>
            Crie a campanha e depois importe a base de contatos (.xlsx ou .json).
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="dialer-campaign-name">Nome</FieldLabel>
              <Input
                id="dialer-campaign-name"
                value={name}
                maxLength={200}
                placeholder="Ex.: Prospecção PME junho"
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="dialer-campaign-description">Descrição (opcional)</FieldLabel>
              <Textarea
                id="dialer-campaign-description"
                value={description}
                maxLength={2000}
                placeholder="Objetivo da campanha, origem da base, observações..."
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </FieldGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={creating}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || creating}>
            {creating && <Spinner data-icon="inline-start" />}
            Criar campanha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
