"use client"

import { Globe, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type DomainIdentitySectionProps = {
  value: string
  connecting: boolean
  onChange: (value: string) => void
  onConnect: () => void
}

export function DomainIdentitySection(props: DomainIdentitySectionProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-[color:var(--surface-1)] p-5">
      <FieldGroup className="gap-5">
        <Field>
          <FieldLabel htmlFor="custom-domain-input">Adicionar domínio</FieldLabel>
          <FieldContent>
            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                id="custom-domain-input"
                placeholder="Ex: mail.suaempresa.com.br"
                value={props.value}
                onChange={(event) => props.onChange(event.target.value)}
                disabled={props.connecting}
                onKeyDown={(event) => {
                  if (event.key === "Enter") props.onConnect()
                }}
              />
              <Button
                type="button"
                className="max-lg:h-11"
                onClick={props.onConnect}
                disabled={props.connecting || !props.value.trim()}
              >
                {props.connecting ? (
                  <LoaderCircle data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Globe data-icon="inline-start" />
                )}
                Conectar
              </Button>
            </div>
            <FieldDescription>
              Prefira um subdomínio (ex.: mail.suaempresa.com.br). Após conectar, copie os registros
              DNS e configure no host do domínio.
            </FieldDescription>
          </FieldContent>
        </Field>
      </FieldGroup>
    </div>
  )
}
