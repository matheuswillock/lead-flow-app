"use client"

import { useState } from "react"
import { Check, Copy, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type HostCopyableLinkProps = {
  id: string
  label: string
  href: string
  hint?: string | null
  /** When false, only copy (internal Docker hostnames). Default true. */
  openInBrowser?: boolean
  className?: string
}

export function HostCopyableLink({
  id,
  label,
  href,
  hint,
  openInBrowser = true,
  className,
}: HostCopyableLinkProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(href)
      setCopied(true)
      toast.success("Link copiado")
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Não foi possível copiar")
    }
  }

  return (
    <Field className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <Input
          id={id}
          readOnly
          value={href}
          className="pr-20 font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <div className="absolute top-0 right-0 flex h-full items-center">
          {openInBrowser ? (
            <Button type="button" variant="ghost" size="icon" asChild>
              <a href={href} target="_blank" rel="noreferrer" aria-label="Abrir link">
                <ExternalLink data-icon="inline-start" />
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Copiar link"
            onClick={() => void handleCopy()}
          >
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          </Button>
        </div>
      </div>
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  )
}
