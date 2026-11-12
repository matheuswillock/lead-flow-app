"use client"

import { Fragment, useMemo } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  renderFormPrivacyPolicy,
  type PublicFormLegalNotice,
} from "@/lib/legal/form-privacy-policy"
import type { LegalSegment } from "@/lib/legal/legal-document-types"

function Segments({ segments }: { segments: LegalSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.bold ? (
          <strong key={index} className="font-semibold text-foreground">
            {segment.text}
          </strong>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </>
  )
}

type PublicFormPrivacyConsentProps = {
  checked: boolean
  onCheckedChange: (accepted: boolean) => void
  legalNotice: PublicFormLegalNotice | null
  disabled?: boolean
}

/**
 * Aviso de privacidade com aceite obrigatório antes do envio. O aceite autoriza a coleta dos
 * dados, os cookies de rastreamento e as comunicações comerciais por e-mail (remarketing).
 */
export function PublicFormPrivacyConsent({
  checked,
  onCheckedChange,
  legalNotice,
  disabled,
}: PublicFormPrivacyConsentProps) {
  const policy = useMemo(() => renderFormPrivacyPolicy(legalNotice), [legalNotice])

  return (
    <div className="flex items-start gap-3 rounded-lg border border-input bg-background p-4">
      <Checkbox
        id="public-form-privacy-consent"
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        disabled={disabled}
        className="mt-0.5 size-5 shrink-0"
      />
      <div className="text-sm leading-relaxed text-muted-foreground">
        <label htmlFor="public-form-privacy-consent" className="cursor-pointer">
          Li e concordo com a Política de Privacidade. Autorizo a coleta dos meus dados, o uso de
          cookies de rastreamento e o envio de comunicações comerciais por e-mail, incluindo
          remarketing com base na minha navegação.{" "}
        </label>
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4"
            >
              Ler a Política de Privacidade
            </button>
          </DialogTrigger>
          <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-2xl">
            <div className="border-b border-border px-6 py-5">
              <DialogTitle>Política de Privacidade</DialogTitle>
              <DialogDescription>
                Você pode revogar o consentimento a qualquer momento pelo link de descadastro de
                qualquer e-mail recebido.
              </DialogDescription>
            </div>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-muted-foreground">
              {policy.map((block, index) => {
                if (block.type === "h2") {
                  return (
                    <h3 key={index} className="mt-3 text-base font-semibold text-foreground">
                      {block.text}
                    </h3>
                  )
                }
                if (block.type === "h3") {
                  return (
                    <h4 key={index} className="mt-1 font-semibold text-foreground">
                      {block.text}
                    </h4>
                  )
                }
                if (block.type === "ul") {
                  return (
                    <ul key={index} className="flex list-disc flex-col gap-1 pl-5">
                      {block.items.map((item, itemIndex) => (
                        <li key={itemIndex}>
                          <Segments segments={item} />
                        </li>
                      ))}
                    </ul>
                  )
                }
                return (
                  <p key={index}>
                    <Segments segments={block.segments} />
                  </p>
                )
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
