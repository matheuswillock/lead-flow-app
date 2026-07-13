"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

const navLinks = [
  { label: "Plataforma", href: "/#crm" },
  { label: "Como funciona", href: "/#como" },
  { label: "Integrações", href: "/#integ" },
  { label: "Dúvidas", href: "/#faq" },
  { label: "Demonstração", href: "/#demo" },
]

export function MobileNavMenu() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="min-[920px]:hidden"
        aria-label="Abrir menu de navegação"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72">
          <SheetHeader>
            <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          </SheetHeader>
          <nav className="mt-6 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-3 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}
