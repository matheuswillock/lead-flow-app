"use client"

import { LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

type DomainTrackingDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  subdomain: string
  previewHost: string
  openTracking: boolean
  clickTracking: boolean
  clickTrackingUnlockable: boolean
  saving: boolean
  onSubdomainChange: (value: string) => void
  onOpenTrackingChange: (value: boolean) => void
  onClickTrackingChange: (value: boolean) => void
  onSave: () => void
}

export function DomainTrackingDialog(props: DomainTrackingDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 py-4">
          <DialogTitle>Configurar métricas de tracking</DialogTitle>
          <DialogDescription>
            Defina o subdomínio e as métricas. Depois, adicione o registro DNS de Tracking e
            re-verifique.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="tracking-subdomain-input">Subdomínio de tracking</FieldLabel>
              <FieldContent>
                <Input
                  id="tracking-subdomain-input"
                  value={props.subdomain}
                  onChange={(event) => props.onSubdomainChange(event.target.value.toLowerCase())}
                  placeholder="links"
                  disabled={props.saving}
                  autoComplete="off"
                />
                <FieldDescription>
                  Preview: <span className="font-mono text-xs">{props.previewHost}</span>
                </FieldDescription>
              </FieldContent>
            </Field>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="open-tracking-switch">Abertura</FieldLabel>
                <FieldDescription>Rastreia quando o e-mail é aberto.</FieldDescription>
              </FieldContent>
              <Switch
                id="open-tracking-switch"
                checked={props.openTracking}
                onCheckedChange={props.onOpenTrackingChange}
                disabled={props.saving}
                className="max-lg:h-12 max-lg:w-12 max-lg:px-1.5 max-lg:py-3.5 max-lg:[background-clip:content-box]"
              />
            </Field>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="click-tracking-switch">Cliques</FieldLabel>
                <FieldDescription>
                  Rastreia cliques reescrevendo os links para o subdomínio de tracking.
                </FieldDescription>
              </FieldContent>
              <Switch
                id="click-tracking-switch"
                checked={props.clickTrackingUnlockable ? props.clickTracking : false}
                onCheckedChange={props.onClickTrackingChange}
                disabled={props.saving || !props.clickTrackingUnlockable}
                className="max-lg:h-12 max-lg:w-12 max-lg:px-1.5 max-lg:py-3.5 max-lg:[background-clip:content-box]"
              />
            </Field>
            <FieldDescription>
              {props.clickTrackingUnlockable
                ? "O rastreio de cliques está disponível porque o domínio e o CNAME de Tracking estão verificados."
                : "O rastreio de cliques fica disponível após verificar um domínio próprio e o CNAME de Tracking."}
            </FieldDescription>
          </FieldGroup>
        </div>
        <DialogFooter className="shrink-0 border-t border-border/60 px-6 py-4">
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)} disabled={props.saving}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={props.onSave}
            disabled={props.saving || !props.subdomain.trim() || !props.openTracking}
          >
            {props.saving ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
