"use client"

import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Moon, ShieldCheck, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getProviderBranding, type CheckoutPaymentProvider } from "./providerBranding"

export function PublicCheckoutShell({
  children,
  issuedLabel,
  issuedValue,
  provider,
  variant = "default",
}: {
  children: ReactNode
  issuedLabel?: string
  issuedValue?: string
  /** `undefined` = padrão legado (Asaas); `null` = provider ainda não resolvido (sem marca). */
  provider?: CheckoutPaymentProvider | null
  /** `light`: barra de topo discreta com marca e link para o site, no lugar da faixa laranja. */
  variant?: "default" | "light"
}) {
  const { theme, setTheme } = useTheme()
  const branding = provider === null ? null : getProviderBranding(provider)

  return (
    <main className="min-h-dvh w-full bg-background font-[Inter,sans-serif]">
      <div className="flex min-h-dvh flex-col">
        {variant === "light" ? (
          <header className="border-b border-border bg-card px-6">
            <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between gap-4">
              <Link href="/" className="flex min-h-11 items-center gap-2.5">
                <Image
                  src="/corretor-studio-icon.svg"
                  alt="Corretor Studio"
                  width={36}
                  height={36}
                  className="size-9 rounded-full"
                  priority
                />
                <span className="whitespace-nowrap font-display text-lg font-bold tracking-tight text-foreground">
                  Corretor Studio
                </span>
              </Link>
              <Link
                href="/"
                aria-label="Voltar ao site"
                className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-4" aria-hidden />
                <span className="hidden sm:inline">Voltar ao site</span>
              </Link>
            </div>
          </header>
        ) : (
        <header className="bg-primary px-6 py-6">
          <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between">
            <div className="flex-1" />
            <div className="flex flex-col items-center gap-2 text-center text-primary-foreground">
              <Image
                src="/corretor-studio-icon.svg"
                alt="Corretor Studio"
                width={44}
                height={44}
                className="h-11 w-auto"
                priority
              />
              <div className={cn("text-xs font-medium tracking-[0.35em]")}>CORRETOR STUDIO</div>
            </div>
            <div className="flex flex-1 justify-end">
              <Button
                variant="ghost"
                size="icon"
                className="text-primary-foreground hover:bg-primary-foreground/10 max-lg:size-11"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Alternar tema"
              >
                <Sun className="size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
            </div>
          </div>
        </header>
        )}

        <div className="flex flex-1 flex-col px-6 pb-10 pt-8 text-foreground">
          <div className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-6">
            {children}

            {variant === "light" ? (
              <footer className="mt-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border pt-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <ShieldCheck className="size-4 text-primary" aria-hidden />
                  Ambiente seguro
                </span>
                <span>
                  {issuedLabel || "Vendido por"}{" "}
                  <span className="font-semibold text-foreground">{issuedValue}</span>
                </span>
              </footer>
            ) : (
              <footer className="mt-auto flex flex-col items-center justify-center gap-3 pb-2 text-center text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                  <span className={cn(branding?.logoUrl && "pt-2")}>Ambiente seguro &middot;</span>
                  {branding?.logoUrl ? (
                    <Image
                      src={branding.logoUrl}
                      alt={branding.logoAlt ?? branding.label}
                      width={72}
                      height={16}
                      className="h-4 w-auto"
                    />
                  ) : branding ? (
                    <span className="font-medium text-foreground">{branding.label}</span>
                  ) : null}
                </div>
                <div>
                  {(issuedLabel || "Vendido por Corretor Studio")}:{" "}
                  <span className="font-medium text-foreground">{issuedValue}</span>
                </div>
              </footer>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
