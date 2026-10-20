"use client"

import { Copy, QrCode } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { toPixImageSrc } from "./pixImage"

export interface PixPaymentBlockProps {
  payload: string
  encodedImage?: string | null
  expirationDate?: string | null
}

function formatExpiration(expirationDate: string | null | undefined): string | null {
  if (!expirationDate) return null
  const date = new Date(expirationDate)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date)
}

export function PixPaymentBlock({ payload, encodedImage, expirationDate }: PixPaymentBlockProps) {
  const imageSrc = toPixImageSrc(encodedImage)
  const expiration = formatExpiration(expirationDate)

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(payload)
      toast.success("Código PIX copiado.")
    } catch {
      toast.error("Não foi possível copiar. Selecione o código e copie manualmente.")
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <QrCode aria-hidden="true" className="size-4" /> PIX
      </div>
      {imageSrc ? (
        <div className="flex justify-center rounded-lg bg-white p-3">
          <img alt="QR Code PIX" className="size-44" src={imageSrc} />
        </div>
      ) : null}
      <div className="break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">{payload}</div>
      <Button type="button" variant="outline" className="max-lg:min-h-11" onClick={copyPayload}>
        <Copy data-icon="inline-start" aria-hidden="true" />
        Copiar código PIX
      </Button>
      {expiration ? <p className="text-xs text-muted-foreground">Expira em {expiration}</p> : null}
    </div>
  )
}
