"use client"

import { useState } from "react"
import { Check, Copy, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type HostEnvFieldProps = {
  id: string
  label: string
  value: string
  isSecret: boolean
  isSet?: boolean
  placeholder?: string
  onChange: (value: string) => void
  className?: string
}

export function HostEnvField({
  id,
  label,
  value,
  isSecret,
  isSet,
  placeholder,
  onChange,
  className,
}: HostEnvFieldProps) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!value.trim()) {
      toast.error(
        isSet
          ? "Valor ainda não carregado no formulário. Exporte e importe, ou digite o secret."
          : "Campo vazio"
      )
      return
    }
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success("Copiado")
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Não foi possível copiar")
    }
  }

  return (
    <Field className={className}>
      <FieldLabel htmlFor={id}>
        {label}
        {isSecret ? " (secret)" : ""}
      </FieldLabel>
      <div className="relative">
        <Input
          id={id}
          type={isSecret && !visible ? "password" : "text"}
          value={value}
          placeholder={placeholder ?? (isSet ? "•••• (já definido)" : undefined)}
          autoComplete="off"
          spellCheck={false}
          className={cn("pr-20 font-mono text-xs", !isSecret && "pr-10")}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="absolute top-0 right-0 flex h-full items-center">
          {isSecret ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={visible ? "Ocultar valor" : "Mostrar valor"}
              onClick={() => setVisible((prev) => !prev)}
            >
              {visible ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Copiar valor"
            onClick={() => void handleCopy()}
          >
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          </Button>
        </div>
      </div>
    </Field>
  )
}
