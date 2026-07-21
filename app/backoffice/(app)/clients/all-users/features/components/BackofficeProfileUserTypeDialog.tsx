"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useBackofficeAllUsers } from "../context/BackofficeAllUsersContext"
import type {
  BackofficeAllUsersItem,
  BackofficeAllUsersUserTypeFilter,
  BackofficeSponsorMasterOption,
} from "../context/BackofficeAllUsersTypes"

const MIN_DAYS = 1
const MAX_DAYS = 365
const DAY_MS = 24 * 60 * 60 * 1000

interface FormState {
  userType: BackofficeAllUsersUserTypeFilter
  accessDays: string
  sponsorMasterId: string
}

function initForm(item: BackofficeAllUsersItem | null): FormState {
  return {
    userType: item?.userType.slug ?? "common",
    accessDays: "",
    sponsorMasterId: item?.userType.sponsorMasterId ?? "",
  }
}

function parsePositiveInt(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

interface BackofficeProfileUserTypeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: BackofficeAllUsersItem | null
  onSuccess: () => void
}

export function BackofficeProfileUserTypeDialog({
  open,
  onOpenChange,
  item,
  onSuccess,
}: BackofficeProfileUserTypeDialogProps) {
  const { service } = useBackofficeAllUsers()
  const [form, setForm] = useState<FormState>(() => initForm(item))
  const [sponsorOptions, setSponsorOptions] = useState<BackofficeSponsorMasterOption[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inFlight = useRef(false)

  useEffect(() => {
    if (open && item) {
      setForm(initForm(item))
      void service.listSponsorMasters().then(setSponsorOptions).catch(() => setSponsorOptions([]))
    }
  }, [open, item, service])

  if (!item) return null

  const isMemberPro = form.userType === "member_pro"
  const isAssociate = form.userType === "associate"
  const isGuest = form.userType === "guest"
  const needsSponsor = isAssociate || isGuest
  const accessDaysValue = parsePositiveInt(form.accessDays)
  const accessDaysValid =
    !isMemberPro || (accessDaysValue !== null && accessDaysValue >= MIN_DAYS && accessDaysValue <= MAX_DAYS)
  const sponsorValid = !needsSponsor || form.sponsorMasterId.length > 0
  const isValid = accessDaysValid && sponsorValid

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!item || !isValid || inFlight.current) return

    inFlight.current = true
    setIsSubmitting(true)

    try {
      if (form.userType === "common") {
        await service.updateUserType(item.id, { userType: "common" })
        toast.success("Tipo de usuário atualizado para Comum")
      } else if (form.userType === "associate") {
        await service.updateUserType(item.id, {
          userType: "associate",
          sponsorMasterId: form.sponsorMasterId,
        })
        toast.success("Tipo de usuário atualizado para Associado")
      } else if (form.userType === "guest") {
        await service.updateUserType(item.id, {
          userType: "guest",
          sponsorMasterId: form.sponsorMasterId,
        })
        toast.success("Tipo de usuário atualizado para Convidado")
      } else {
        const accessExpiresAt = new Date(Date.now() + (accessDaysValue as number) * DAY_MS).toISOString()
        await service.updateUserType(item.id, {
          userType: "member_pro",
          accessExpiresAt,
        })
        toast.success("Tipo de usuário atualizado para Member PRO")
      }

      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar tipo de usuário")
    } finally {
      setIsSubmitting(false)
      inFlight.current = false
    }
  }

  const filteredSponsors = sponsorOptions.filter((option) => option.id !== item.id)

  return (
    <Dialog open={open} onOpenChange={isSubmitting ? undefined : onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-120">
        <DialogHeader>
          <DialogTitle>Gerenciar tipo de usuário</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 pr-1">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="user-type-select">Tipo de usuário</FieldLabel>
                <Select
                  value={form.userType}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, userType: value as BackofficeAllUsersUserTypeFilter }))
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="user-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="common">Comum</SelectItem>
                      <SelectItem value="member_pro">Member PRO</SelectItem>
                      <SelectItem value="associate">Associado</SelectItem>
                      <SelectItem value="guest">Convidado</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {item.userType.slug === "member_pro" && item.userType.accessExpiresAt && (
                  <FieldDescription>
                    Acesso atual expira em{" "}
                    {new Date(item.userType.accessExpiresAt).toLocaleDateString("pt-BR")}
                    {item.userType.isExpired ? " (expirado)" : ""}.
                  </FieldDescription>
                )}
                {(item.userType.slug === "associate" || item.userType.slug === "guest") && item.userType.sponsorMasterName && (
                  <FieldDescription>
                    Patrocinador atual: {item.userType.sponsorMasterName}
                  </FieldDescription>
                )}
              </Field>

              {isMemberPro && (
                <Field>
                  <FieldLabel htmlFor="user-type-days">Validade do acesso (dias)</FieldLabel>
                  <Input
                    id="user-type-days"
                    type="number"
                    min={MIN_DAYS}
                    max={MAX_DAYS}
                    placeholder="Ex.: 30"
                    value={form.accessDays}
                    onChange={(event) => setForm((prev) => ({ ...prev, accessDays: event.target.value }))}
                    disabled={isSubmitting}
                  />
                  <FieldDescription>Entre 1 e 365 dias a partir de agora.</FieldDescription>
                  {form.accessDays.length > 0 && !accessDaysValid && (
                    <FieldError>Informe um número entre 1 e 365</FieldError>
                  )}
                </Field>
              )}

              {needsSponsor && (
                <Field>
                  <FieldLabel htmlFor="sponsor-master-select">Patrocinador</FieldLabel>
                  <Select
                    value={form.sponsorMasterId}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, sponsorMasterId: value }))}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="sponsor-master-select">
                      <SelectValue placeholder="Selecione o master patrocinador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {filteredSponsors.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.fullName ?? option.email}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {isAssociate && (
                    <FieldDescription>
                      Conta Associado exige CPF/CNPJ válido no master para sincronizar cliente Asaas.
                    </FieldDescription>
                  )}
                  {!sponsorValid && <FieldError>Selecione um patrocinador</FieldError>}
                </Field>
              )}
            </FieldGroup>
          </div>

          <DialogFooter className="pt-4 mt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
