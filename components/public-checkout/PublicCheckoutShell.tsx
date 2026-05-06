"use client"

import type { ReactNode } from "react"
import Image from "next/image"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function PublicCheckoutShell({
  children,
  issuedLabel,
  issuedValue,
}: {
  children: ReactNode
  issuedLabel?: string
  issuedValue?: string
}) {
  const { theme, setTheme } = useTheme()

  return (
    <main className="min-h-dvh w-full bg-background">
      <div className="flex min-h-dvh flex-col">
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
                className="text-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Alternar tema"
              >
                <Sun className="size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col px-6 pb-10 pt-8 text-foreground">
          <div className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-6">
            {children}

            <footer className="mt-auto flex flex-col items-center justify-center gap-3 pb-2 text-center text-xs text-muted-foreground">
              <div className="flex items-center justify-center gap-2">
                <span className="pt-2">Ambiente seguro &middot;</span>
                <Image
                  src="/asaas-pagamentos-logo.svg"
                  alt="Asaas Pagamentos"
                  width={72}
                  height={16}
                  className="h-4 w-auto"
                />
              </div>
              <div>
                {(issuedLabel || "Emitido por Corretor Studio")}:{" "}
                <span className="font-medium text-foreground">{issuedValue}</span>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </main>
  )
}
