"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { AlertTriangle, ShieldBan, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { BanUserDialog } from "@/app/backoffice/(app)/clients/all-users/features/components/BanUserDialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { maskPhone, maskCEP, unmask, formatDocumentInput } from "@/lib/masks"
import type { BackofficeClientDetails } from "../context/BackofficeClientDetailsTypes"
import type { IBackofficeClientDetailsService } from "../services/IBackofficeClientDetailsService"

const FUNCTIONS = [
  { value: "SDR", label: "SDR", description: "Qualifica leads e organiza o funil." },
  { value: "CLOSER", label: "Closer", description: "Conduz reuniões e fechamento." },
] as const

const MEMBER_PRO_MIN_DAYS = 1
const MEMBER_PRO_MAX_DAYS = 365
const MEMBER_PRO_DAY_MS = 24 * 60 * 60 * 1000

type EditableUserType = "common" | "member_pro"

interface FormState {
  fullName: string
  phone: string
  cpfCnpj: string
  postalCode: string
  address: string
  addressNumber: string
  neighborhood: string
  complement: string
  city: string
  state: string
  functions: string[]
  userType: EditableUserType
  memberProAccessDays: string
}

function remainingAccessDays(accessExpiresAt: string | null): number {
  if (!accessExpiresAt) return MEMBER_PRO_MAX_DAYS
  const ms = new Date(accessExpiresAt).getTime() - Date.now()
  if (!Number.isFinite(ms) || ms <= 0) return MEMBER_PRO_MAX_DAYS
  return Math.min(
    MEMBER_PRO_MAX_DAYS,
    Math.max(MEMBER_PRO_MIN_DAYS, Math.ceil(ms / MEMBER_PRO_DAY_MS))
  )
}

function initForm(details: BackofficeClientDetails): FormState {
  const slug = details.userType.slug === "member_pro" ? "member_pro" : "common"
  return {
    fullName: details.fullName ?? "",
    phone: details.phone ?? "",
    cpfCnpj: details.cpfCnpj ?? "",
    postalCode: details.postalCode ?? "",
    address: details.address ?? "",
    addressNumber: details.addressNumber ?? "",
    neighborhood: details.neighborhood ?? "",
    complement: details.complement ?? "",
    city: details.city ?? "",
    state: details.state ?? "",
    functions: details.functions ?? [],
    userType: slug,
    memberProAccessDays:
      slug === "member_pro" ? String(remainingAccessDays(details.userType.accessExpiresAt)) : "",
  }
}

function nullOrTrim(v: string): string | null {
  const s = v.trim()
  return s.length > 0 ? s : null
}

function parsePositiveInt(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  masterId: string
  details: BackofficeClientDetails
  service: IBackofficeClientDetailsService
  canManage?: boolean
  onSuccess: () => void
  onDeleteRequest: () => void
}

export function BackofficeClientEditDialog({
  open,
  onOpenChange,
  masterId,
  details,
  service,
  canManage = true,
  onSuccess,
  onDeleteRequest,
}: Props) {
  const [form, setForm] = useState<FormState>(() => initForm(details))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [banDialogOpen, setBanDialogOpen] = useState(false)
  const [isBanning, setIsBanning] = useState(false)
  const inFlight = useRef(false)

  useEffect(() => {
    if (open) {
      setForm(initForm(details))
    }
  }, [open, details])

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleFunction(fn: string) {
    setForm((prev) => ({
      ...prev,
      functions: prev.functions.includes(fn)
        ? prev.functions.filter((f) => f !== fn)
        : [...prev.functions, fn],
    }))
  }

  const memberProAccessDaysValue = parsePositiveInt(form.memberProAccessDays)
  const memberProAccessDaysValid =
    form.userType !== "member_pro" ||
    (memberProAccessDaysValue !== null &&
      memberProAccessDaysValue >= MEMBER_PRO_MIN_DAYS &&
      memberProAccessDaysValue <= MEMBER_PRO_MAX_DAYS)

  const isValid = form.fullName.trim().length >= 2 && memberProAccessDaysValid

  const initialUserType: EditableUserType =
    details.userType.slug === "member_pro" ? "member_pro" : "common"
  const userTypeChanged = form.userType !== initialUserType
  const memberProDaysChanged =
    form.userType === "member_pro" &&
    memberProAccessDaysValue !== null &&
    memberProAccessDaysValue !== remainingAccessDays(details.userType.accessExpiresAt)
  const shouldUpdateUserType = userTypeChanged || memberProDaysChanged

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || inFlight.current) return

    inFlight.current = true
    setIsSubmitting(true)

    try {
      await service.updateClient(masterId, {
        fullName: form.fullName.trim(),
        phone: nullOrTrim(unmask(form.phone)),
        cpfCnpj: nullOrTrim(unmask(form.cpfCnpj)),
        postalCode: nullOrTrim(unmask(form.postalCode)),
        address: nullOrTrim(form.address),
        addressNumber: nullOrTrim(form.addressNumber),
        neighborhood: nullOrTrim(form.neighborhood),
        complement: nullOrTrim(form.complement),
        city: nullOrTrim(form.city),
        state: nullOrTrim(form.state),
        functions: form.functions,
      })

      if (shouldUpdateUserType) {
        if (form.userType === "common") {
          await service.updateUserType(masterId, { userType: "common" })
        } else {
          const accessExpiresAt = new Date(
            Date.now() + (memberProAccessDaysValue as number) * MEMBER_PRO_DAY_MS
          ).toISOString()
          await service.updateUserType(masterId, {
            userType: "member_pro",
            accessExpiresAt,
          })
        }
      }

      toast.success("Dados atualizados com sucesso")
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar dados")
    } finally {
      setIsSubmitting(false)
      inFlight.current = false
    }
  }

  async function handleBanUser(reason?: string | null) {
    if (isBanning) return

    setIsBanning(true)
    try {
      await service.banUser(masterId, reason)
      toast.success("Conta banida com sucesso")
      setBanDialogOpen(false)
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      console.error("[BackofficeClientEditDialog][handleBanUser]", err)
      toast.error(err instanceof Error ? err.message : "Erro ao banir usuário")
    } finally {
      setIsBanning(false)
    }
  }

  const userLabel = details.fullName?.trim() || details.email

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-180">
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 space-y-5 pr-1">
            {/* Basic info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-fullName">Nome</Label>
                <Input
                  id="edit-fullName"
                  value={form.fullName}
                  onChange={(e) => setField("fullName", e.target.value)}
                  placeholder="Nome completo"
                  disabled={isSubmitting}
                />
                {form.fullName.length > 0 && form.fullName.trim().length < 2 && (
                  <p className="text-xs text-destructive">Mínimo de 2 caracteres</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-email">E-mail</Label>
                <Input
                  id="edit-email"
                  value={details.email}
                  readOnly
                  disabled
                  className="bg-muted/50 cursor-not-allowed"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-phone">Telefone</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={maskPhone(form.phone)}
                  onChange={(e) => setField("phone", unmask(maskPhone(e.target.value)))}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-cpfCnpj">Documento</Label>
              <Input
                id="edit-cpfCnpj"
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                value={formatDocumentInput(form.cpfCnpj)}
                onChange={(e) => setField("cpfCnpj", unmask(formatDocumentInput(e.target.value)))}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">Tipo de usuário</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Defina se o cliente é Comum ou Member PRO.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-user-type">Tipo</Label>
                  <Select
                    value={form.userType}
                    onValueChange={(value) => {
                      const next = value as EditableUserType
                      setForm((prev) => ({
                        ...prev,
                        userType: next,
                        memberProAccessDays:
                          next === "member_pro"
                            ? prev.memberProAccessDays || String(MEMBER_PRO_MAX_DAYS)
                            : "",
                      }))
                    }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="edit-user-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="common">Comum</SelectItem>
                        <SelectItem value="member_pro">Member PRO</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {details.userType.slug === "member_pro" && details.userType.accessExpiresAt ? (
                    <p className="text-xs text-muted-foreground">
                      Acesso atual expira em{" "}
                      {new Date(details.userType.accessExpiresAt).toLocaleDateString("pt-BR")}
                      {details.userType.isExpired ? " (expirado)" : ""}.
                    </p>
                  ) : null}
                </div>
                {form.userType === "member_pro" ? (
                  <div className="space-y-2">
                    <Label htmlFor="edit-member-pro-days">Validade do acesso (dias)</Label>
                    <Input
                      id="edit-member-pro-days"
                      type="number"
                      min={MEMBER_PRO_MIN_DAYS}
                      max={MEMBER_PRO_MAX_DAYS}
                      value={form.memberProAccessDays}
                      onChange={(e) => setField("memberProAccessDays", e.target.value)}
                      disabled={isSubmitting}
                    />
                    <p className="text-xs text-muted-foreground">
                      Entre {MEMBER_PRO_MIN_DAYS} e {MEMBER_PRO_MAX_DAYS} dias. Member PRO ativa
                      usuários ilimitados.
                    </p>
                    {form.memberProAccessDays.length > 0 && !memberProAccessDaysValid ? (
                      <p className="text-xs text-destructive">Informe um número entre 1 e 365</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Endereço</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-postalCode">CEP</Label>
                  <Input
                    id="edit-postalCode"
                    placeholder="00000-000"
                    value={maskCEP(form.postalCode)}
                    onChange={(e) => setField("postalCode", unmask(maskCEP(e.target.value)))}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-city">Cidade</Label>
                  <Input
                    id="edit-city"
                    placeholder="Sua cidade"
                    value={form.city}
                    onChange={(e) => setField("city", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-address">Endereço</Label>
                <Input
                  id="edit-address"
                  placeholder="Rua, avenida, etc"
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-addressNumber">Número</Label>
                  <Input
                    id="edit-addressNumber"
                    placeholder="123"
                    value={form.addressNumber}
                    onChange={(e) => setField("addressNumber", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-neighborhood">Bairro</Label>
                  <Input
                    id="edit-neighborhood"
                    placeholder="Centro, Jardins, etc"
                    value={form.neighborhood}
                    onChange={(e) => setField("neighborhood", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-complement">Complemento</Label>
                  <Input
                    id="edit-complement"
                    placeholder="Apto, sala, etc"
                    value={form.complement}
                    onChange={(e) => setField("complement", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-state">Estado</Label>
                <Input
                  id="edit-state"
                  placeholder="SP"
                  maxLength={2}
                  value={form.state}
                  onChange={(e) => setField("state", e.target.value.toUpperCase())}
                  disabled={isSubmitting}
                  className="w-24"
                />
              </div>
            </div>

            {/* Functions */}
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">Gerenciar funções</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Defina as funções habilitadas para o usuário master.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {FUNCTIONS.map((fn) => (
                  <label
                    key={fn.value}
                    className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                  >
                    <Checkbox
                      checked={form.functions.includes(fn.value)}
                      onCheckedChange={() => toggleFunction(fn.value)}
                      disabled={isSubmitting}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium leading-none">{fn.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{fn.description}</p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                As funções serão salvas junto com as alterações do perfil.
              </p>
            </div>

            <Separator />

            {/* Danger zone */}
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 space-y-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="text-sm font-semibold">Zona de Perigo</span>
              </div>

              {canManage && !details.isBanned ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Banir esta conta bloqueia o acesso de todos os usuários vinculados à plataforma.
                  </p>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => setBanDialogOpen(true)}
                    disabled={isSubmitting || isBanning}
                  >
                    <ShieldBan data-icon="inline-start" />
                    Banir
                  </Button>
                </div>
              ) : null}

              {details.isBanned ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Esta conta possui um banimento ativo.
                  </p>
                  <Button type="button" variant="outline" size="sm" className="w-full" asChild>
                    <Link href="/backoffice/anatemas">Ver em Anatemas</Link>
                  </Button>
                </div>
              ) : null}

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Excluir esta conta é uma ação permanente e irreversível. Todos os times, dados e
                  acessos serão removidos.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={onDeleteRequest}
                  disabled={isSubmitting || isBanning}
                >
                  <Trash2 data-icon="inline-start" />
                  Excluir conta
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 mt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <BanUserDialog
        open={banDialogOpen}
        isSubmitting={isBanning}
        isMaster
        userLabel={userLabel}
        onOpenChange={setBanDialogOpen}
        onConfirm={handleBanUser}
      />
    </Dialog>
  )
}
