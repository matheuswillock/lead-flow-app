"use client"

import { useEffect, useState } from "react"
import { Check, Copy, Loader2, QrCode, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { toPixImageSrc } from "@/components/public-checkout/pixImage"
import { Button } from "@/components/ui/button"
import { formatCountdown } from "../context/AdhesionAttemptTimerHook"
import type { PublicAdhesionPayment } from "../context/PublicAdhesionTypes"

const STEPS = [
  "Abra o app do seu banco e escolha pagar com PIX.",
  "Escaneie o QR Code ou cole o código copiado.",
  "Confirme o pagamento. Avisamos aqui e por e-mail.",
]

function StatusPill({ expired, remaining }: { expired: boolean; remaining: string | null }) {
  if (expired) {
    return (
      <span className="inline-flex w-fit items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
        PIX expirado
      </span>
    )
  }
  return (
    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold whitespace-nowrap text-primary">
      <span aria-hidden="true" className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex size-2 rounded-full bg-primary" />
      </span>
      Aguardando pagamento
      {remaining ? (
        <span className="font-normal tabular-nums text-primary/80" aria-label={`expira em ${remaining}`}>
          · {remaining}
        </span>
      ) : null}
    </span>
  )
}

/**
 * Pagamento por PIX em destaque: QR Code grande, cópia do código em um toque, passo a passo e o
 * status atualizado sozinho. Usado depois que o pedido é criado.
 */
export function AdhesionPixPanel({
  pix,
  email,
  now,
  isExpired,
  isValidating,
  isRegenerating,
  stillPending = false,
  onValidate,
  onRegenerate,
}: {
  pix: NonNullable<PublicAdhesionPayment["pix"]>
  email: string | null
  now: number
  isExpired: boolean
  isValidating: boolean
  isRegenerating: boolean
  /** A consulta pedida pelo cliente ainda não encontrou o pagamento. */
  stillPending?: boolean
  onValidate: () => void
  onRegenerate: () => void
}) {
  const [copied, setCopied] = useState(false)
  const imageSrc = toPixImageSrc(pix.encodedImage)
  const expiresAt = pix.expirationDate ? Date.parse(pix.expirationDate) : Number.NaN
  const remaining = Number.isFinite(expiresAt) && expiresAt > now ? formatCountdown(expiresAt - now) : null

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), 2500)
    return () => clearTimeout(timeout)
  }, [copied])

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(pix.payload)
      setCopied(true)
      toast.success("Código PIX copiado.")
    } catch {
      toast.error("Não foi possível copiar. Selecione o código e copie manualmente.")
    }
  }

  return (
    <section
      aria-labelledby="adhesion-pix-title"
      className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8"
    >
      <div className="flex flex-col gap-3">
        <StatusPill expired={isExpired} remaining={remaining} />
        <div className="flex flex-col gap-1">
          <h2
            id="adhesion-pix-title"
            className="font-display text-2xl leading-tight font-extrabold tracking-[-0.02em] text-foreground"
          >
            {isExpired ? "Este PIX expirou" : "Pague com PIX para concluir"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isExpired
              ? "Gere um novo QR Code. Seu pedido continua reservado."
              : "Escaneie o QR Code ou copie o código no app do seu banco."}
          </p>
        </div>
      </div>

      {isExpired ? (
        <Button type="button" size="lg" className="w-fit max-lg:min-h-11" onClick={onRegenerate} disabled={isRegenerating}>
          {isRegenerating ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" aria-hidden />}
          {isRegenerating ? "Gerando..." : "Gerar novo PIX"}
        </Button>
      ) : (
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          {/* No celular quem paga costuma estar no próprio aparelho: copiar vem antes do QR Code. */}
          <div className="flex shrink-0 justify-center max-md:order-last">
            {imageSrc ? (
              <div className="rounded-2xl border border-border bg-white p-3 shadow-sm">
                <img alt="QR Code PIX" className="size-52" src={imageSrc} />
              </div>
            ) : (
              <div className="flex size-52 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40 text-muted-foreground">
                <QrCode className="size-10" aria-hidden />
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <ol className="flex flex-col gap-3">
              {STEPS.map((step, index) => (
                <li key={step} className="flex items-start gap-3 text-sm text-foreground">
                  <span
                    aria-hidden="true"
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary"
                  >
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">PIX copia e cola</span>
              <div className="flex items-stretch gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-muted/40 px-3 py-2.5 font-mono text-xs leading-5 text-foreground">
                  {pix.payload}
                </code>
                <Button type="button" className="shrink-0 max-lg:min-h-11" onClick={copyPayload}>
                  {copied ? <Check data-icon="inline-start" aria-hidden /> : <Copy data-icon="inline-start" aria-hidden />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isExpired ? null : (
        <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
            {stillPending ? (
              <span className="font-medium text-foreground">
                Ainda não recebemos o pagamento. O banco pode levar alguns segundos; seguimos verificando.
              </span>
            ) : email ? (
              `Confirmamos sozinhos. O acesso chega em ${email}.`
            ) : (
              "Confirmamos sozinhos assim que o pagamento cair."
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 max-lg:min-h-11"
            onClick={onValidate}
            disabled={isValidating}
          >
            {isValidating ? "Verificando..." : "Já paguei"}
          </Button>
        </div>
      )}
    </section>
  )
}
