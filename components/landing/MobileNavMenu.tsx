"use client"

import { useState } from "react"
import Link from "next/link"
import { LogIn, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { DemoRequestDialogButton } from "./DemoRequestDialog"
import { LandingPrimaryAction } from "./LandingPrimaryAction"
import { landingNavigationItems } from "./landingNavigation"

export function MobileNavMenu() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="ml-auto size-11 min-[1180px]:ml-0 min-[1180px]:hidden"
        aria-label="Abrir menu de navegação"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" aria-hidden />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-72">
          <SheetHeader>
            <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          </SheetHeader>
          <nav className="mt-6 flex flex-col gap-1">
            {landingNavigationItems.map((item) =>
              item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-3 text-base font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  key={item.label}
                  aria-disabled="true"
                  className="rounded-lg px-4 py-3 text-base font-medium text-muted-foreground/60"
                >
                  {item.label}
                </span>
              ),
            )}
            <Separator className="my-2" />
            <Link
              href="/sign-in"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-3 text-base font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Entrar na conta"
            >
              <LogIn className="size-4" aria-hidden />
              Entrar
            </Link>
            <DemoRequestDialogButton
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 py-3 text-left text-base font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Solicitar demonstração
            </DemoRequestDialogButton>
            <LandingPrimaryAction />
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}
