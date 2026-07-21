"use client"

import { MessageCircle, TriangleAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { usePublicOffer } from "../context/PublicOfferHook"
import type { PublicOfferItem } from "../context/PublicOfferTypes"

function formatPrice(value: number | null): string | null {
  if (value === null) return null
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "")
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

function OfferItemCard({ item }: { item: PublicOfferItem }) {
  const prices = [
    { label: "Mensal", value: formatPrice(item.priceMonthly) },
    { label: "Trimestral", value: formatPrice(item.priceQuarterly) },
    { label: "Semestral", value: formatPrice(item.priceSemiannual) },
    { label: "Anual", value: formatPrice(item.priceAnnual) },
    { label: "Vitalício", value: formatPrice(item.priceLifetime) },
  ].filter((entry) => entry.value)

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">{item.name}</h3>
        <Badge variant="secondary">{item.type === "PLAN" ? "Plano" : "Add-on"}</Badge>
      </div>
      {item.description ? (
        <p className="text-sm text-muted-foreground">{item.description}</p>
      ) : null}
      {prices.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm">
          {prices.map((price) => (
            <li key={price.label} className="flex justify-between gap-2">
              <span className="text-muted-foreground">{price.label}</span>
              <span className="font-medium">{price.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function PublicOfferContainer() {
  const { share, isLoading, error } = usePublicOffer()

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg">
        {isLoading ? (
          <CardContent className="flex flex-col gap-4 pt-6">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        ) : error || !share ? (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TriangleAlert data-icon="inline-start" className="text-destructive" />
                Link indisponível
              </CardTitle>
              <CardDescription>
                {error ?? "Não foi possível carregar esta oferta."}
              </CardDescription>
            </CardHeader>
          </>
        ) : share.status === "expired" ? (
          <>
            <CardHeader>
              <CardTitle>Infelizmente, sua oferta expirou.</CardTitle>
              <CardDescription>
                Entre em contato com {share.contactName} para retomar e fechar a melhor condição
                para a sua corretora.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button asChild className="w-full">
                <a
                  href={buildWhatsAppUrl(
                    share.contactPhone,
                    "Minha oferta do Corretor Studio expirou e gostaria de retomar o contato."
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle data-icon="inline-start" />
                  Falar com {share.contactName}
                </a>
              </Button>
            </CardFooter>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Olá, {share.leadName}!</CardTitle>
              <CardDescription>
                Montamos esta oferta especialmente para a sua corretora acelerar resultados e
                operar com mais previsibilidade.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Separator />
              <div className="flex flex-col gap-3">
                {(share.items ?? []).map((item) => (
                  <OfferItemCard key={item.productId} item={item} />
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full">
                <a
                  href={buildWhatsAppUrl(
                    share.contactPhone,
                    "Vi a oferta do Corretor Studio e gostaria de conversar."
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle data-icon="inline-start" />
                  Falar com {share.contactName}
                </a>
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </main>
  )
}
