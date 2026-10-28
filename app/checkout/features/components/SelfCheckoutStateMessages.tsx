"use client"

import Link from "next/link"
import { AlertCircle, ShoppingCart } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export function SelfCheckoutLoadError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      <Alert variant="destructive">
        <AlertCircle className="size-4" aria-hidden="true" />
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <Button type="button" variant="outline" className="max-lg:min-h-11 sm:w-fit" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  )
}

export function SelfCheckoutUnavailable() {
  return (
    <Empty className="mx-auto w-full max-w-[720px] border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShoppingCart aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>Compra online indisponível no momento</EmptyTitle>
        <EmptyDescription>
          Não há planos disponíveis para contratação online agora. Tente novamente mais tarde.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline" className="max-lg:min-h-11">
          <Link href="/">Voltar ao início</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
