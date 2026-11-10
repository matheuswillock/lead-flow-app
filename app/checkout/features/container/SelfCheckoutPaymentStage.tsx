"use client"

import type { ReactNode } from "react"
import { AlertTriangle, CreditCard, Loader2, QrCode } from "lucide-react"

import { AdhesionPixPanel } from "@/app/adesao/[token]/features/components/AdhesionPixPanel"
import { useAdhesionAutoPayment } from "@/app/adesao/[token]/features/context/AdhesionAutoPaymentHook"
import type { PublicAdhesionCheckoutInput } from "@/app/adesao/[token]/features/context/PublicAdhesionTypes"
import { Button } from "@/components/ui/button"

function StatusPill({ tone, children }: { tone: "progress" | "error"; children: ReactNode }) {
  return (
    <span
      className={
        tone === "error"
          ? "inline-flex w-fit items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive"
          : "inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
      }
    >
      {tone === "progress" ? (
        <span aria-hidden="true" className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
      ) : null}
      {children}
    </span>
  )
}

function StagePanel({
  icon,
  pill,
  title,
  description,
  children,
}: {
  icon: ReactNode
  pill: ReactNode
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          {pill}
          <h2 className="font-display text-2xl leading-tight font-extrabold tracking-[-0.02em] text-foreground">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function CardDetails({ cardLabel, installmentsLabel }: { cardLabel: string; installmentsLabel: string }) {
  return (
    <dl className="grid gap-3 rounded-xl bg-muted/50 p-4 text-sm sm:grid-cols-2">
      <div className="flex flex-col gap-0.5">
        <dt className="text-muted-foreground">Cartão</dt>
        <dd className="font-semibold text-foreground tabular-nums">{cardLabel}</dd>
      </div>
      <div className="flex flex-col gap-0.5">
        <dt className="text-muted-foreground">Parcelamento</dt>
        <dd className="font-semibold text-foreground tabular-nums">{installmentsLabel}</dd>
      </div>
    </dl>
  )
}

/**
 * Pagamento depois de criado o pedido: o PIX (ou o cartão) é gerado sozinho com os dados já
 * preenchidos e a tela acompanha a confirmação. Precisa estar dentro de `PublicAdhesionProvider`.
 */
export function SelfCheckoutPaymentStage({
  input,
  installmentsLabel,
  cardLastFour,
  summary,
  onPaid,
  onEditCard,
  onPayWithPix,
}: {
  input: PublicAdhesionCheckoutInput
  /** Ex.: "6x de R$ 193,52". */
  installmentsLabel: string
  /** Final do cartão devolvido pelo Abacate Pay ao gerar o token. */
  cardLastFour?: string | null
  /** Resumo do pedido exibido ao lado. */
  summary: ReactNode
  onPaid: () => void
  /** Volta ao formulário para corrigir o cartão, mantendo o mesmo pedido. */
  onEditCard: () => void
  /** Troca para PIX e gera o QR Code no mesmo pedido. */
  onPayWithPix: () => void
}) {
  const { payment, isPreparing, isSubmitting, failure, pixExpired, isValidating, stillPendingAfterCheck, now, pay, validate } =
    useAdhesionAutoPayment(input, onPaid)
  const isCard = input.billingType === "CREDIT_CARD"
  const cardLabel = cardLastFour ? `Final ${cardLastFour}` : "Cartão de crédito"

  let heading = { title: "Conclua o pagamento", description: "Seu pedido está criado e reservado." }
  let content: ReactNode

  if (payment?.pix) {
    content = (
      <AdhesionPixPanel
        pix={payment.pix}
        email={input.email || null}
        now={now}
        isExpired={pixExpired}
        isValidating={isValidating}
        isRegenerating={isSubmitting}
        stillPending={stillPendingAfterCheck}
        onValidate={() => void validate()}
        onRegenerate={() => void pay()}
      />
    )
  } else if (payment) {
    heading = {
      title: "Pagamento enviado",
      description: "Falta só a confirmação da operadora. O acesso chega por e-mail assim que ela aprovar.",
    }
    content = (
      <StagePanel
        icon={<CreditCard className="size-6" aria-hidden />}
        pill={<StatusPill tone="progress">Em análise pela operadora</StatusPill>}
        title="Estamos confirmando seu cartão"
        description="Costuma levar poucos segundos. Esta tela atualiza sozinha; pode deixá-la aberta."
      >
        <CardDetails cardLabel={cardLabel} installmentsLabel={installmentsLabel} />
        <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {stillPendingAfterCheck ? (
              <span className="font-medium text-foreground">
                A operadora ainda não respondeu. Seguimos verificando sozinhos.
              </span>
            ) : (
              <>
                O acesso vai para <span className="font-semibold text-foreground">{input.email}</span>.
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {payment.invoiceUrl ? (
              <Button asChild variant="ghost" className="max-lg:min-h-11">
                <a href={payment.invoiceUrl} target="_blank" rel="noopener noreferrer">
                  Ver fatura
                </a>
              </Button>
            ) : null}
            <Button type="button" variant="outline" className="max-lg:min-h-11" onClick={() => void validate()} disabled={isValidating}>
              {isValidating ? "Verificando..." : "Atualizar status"}
            </Button>
          </div>
        </div>
      </StagePanel>
    )
  } else if (failure && !isPreparing) {
    heading = { title: "Falta pouco", description: "Seu pedido continua reservado. Escolha como seguir." }
    content = (
      <StagePanel
        icon={<AlertTriangle className="size-6" aria-hidden />}
        pill={<StatusPill tone="error">{isCard ? "Cartão não aprovado" : "PIX não gerado"}</StatusPill>}
        title={isCard ? "Não conseguimos aprovar o cartão" : "Não conseguimos gerar o PIX"}
        description={failure}
      >
        {isCard ? <CardDetails cardLabel={cardLabel} installmentsLabel={installmentsLabel} /> : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {isCard ? (
            <>
              <Button type="button" size="lg" className="max-lg:min-h-11" onClick={onEditCard}>
                <CreditCard data-icon="inline-start" aria-hidden />
                Corrigir dados do cartão
              </Button>
              <Button type="button" size="lg" variant="outline" className="max-lg:min-h-11" onClick={onPayWithPix}>
                <QrCode data-icon="inline-start" aria-hidden />
                Pagar com PIX
              </Button>
            </>
          ) : (
            <Button type="button" size="lg" className="max-lg:min-h-11" onClick={() => void pay()} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              Tentar novamente
            </Button>
          )}
        </div>
      </StagePanel>
    )
  } else {
    heading = {
      title: isCard ? "Processando o pagamento" : "Gerando seu PIX",
      description: "Seu pedido foi criado. Isso leva só alguns segundos.",
    }
    content = (
      <StagePanel
        icon={<Loader2 className="size-6 animate-spin motion-reduce:animate-none" aria-hidden />}
        pill={<StatusPill tone="progress">{isCard ? "Enviando para a operadora" : "Gerando QR Code"}</StatusPill>}
        title={isCard ? "Enviando o pagamento" : "Preparando seu QR Code"}
        description="Não feche esta página."
      />
    )
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl leading-tight font-extrabold tracking-[-0.03em] text-foreground md:text-4xl">
          {heading.title}
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground">{heading.description}</p>
      </div>
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        {content}
        <aside aria-label="Resumo do pedido" className="lg:sticky lg:top-6">
          {summary}
        </aside>
      </div>
    </div>
  )
}
