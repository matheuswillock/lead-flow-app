"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useBackofficeWhatsAppInstances } from "../context/BackofficeWhatsAppInstancesHook"

export function BackofficeWhatsAppProvisionDialog() {
  const {
    isProvisionOpen,
    closeProvision,
    eligibleTeams,
    isLoadingTeams,
    isProvisioning,
    loadEligibleTeams,
    provisionInstance,
  } = useBackofficeWhatsAppInstances()

  const [teamId, setTeamId] = useState("")
  const [usageLimitMonthly, setUsageLimitMonthly] = useState("2000")
  const [teamSearch, setTeamSearch] = useState("")

  useEffect(() => {
    if (!isProvisionOpen) return
    setTeamId("")
    setUsageLimitMonthly("2000")
    setTeamSearch("")
    void loadEligibleTeams()
  }, [isProvisionOpen, loadEligibleTeams])

  useEffect(() => {
    if (!isProvisionOpen) return
    const timeout = setTimeout(() => {
      void loadEligibleTeams(teamSearch)
    }, 300)
    return () => clearTimeout(timeout)
  }, [isProvisionOpen, loadEligibleTeams, teamSearch])

  async function handleSubmit() {
    if (!teamId) return
    const limit = Number.parseInt(usageLimitMonthly, 10)
    await provisionInstance({
      teamId,
      usageLimitMonthly: Number.isFinite(limit) ? limit : undefined,
    })
  }

  return (
    <Dialog open={isProvisionOpen} onOpenChange={(open) => !open && closeProvision()}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Provisionar instância</DialogTitle>
          <DialogDescription>
            Crie uma instância WhatsApp para um time que ainda não possui configuração.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-2">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="team-search">Buscar time</FieldLabel>
              <Input
                id="team-search"
                value={teamSearch}
                onChange={(event) => setTeamSearch(event.target.value)}
                placeholder="Nome do time ou master"
                disabled={isProvisioning}
              />
            </Field>
            <Field>
              <FieldLabel>Time</FieldLabel>
              {isLoadingTeams ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Carregando times...
                </div>
              ) : (
                <Select value={teamId} onValueChange={setTeamId} disabled={isProvisioning}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um time" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleTeams.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        Nenhum time elegível encontrado
                      </SelectItem>
                    ) : (
                      eligibleTeams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name} — {team.master.fullName ?? team.master.email ?? team.id}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="provision-limit">Limite mensal</FieldLabel>
              <Input
                id="provision-limit"
                type="number"
                min={0}
                value={usageLimitMonthly}
                onChange={(event) => setUsageLimitMonthly(event.target.value)}
                disabled={isProvisioning}
              />
            </Field>
          </FieldGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeProvision} disabled={isProvisioning}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!teamId || isProvisioning}>
            {isProvisioning && <Loader2 className="animate-spin" data-icon="inline-start" />}
            Provisionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
