import Link from "next/link"
import Image from "next/image"
import { ArrowRight, LogIn } from "lucide-react"
import { DemoRequestDialogButton } from "./DemoRequestDialog"
import { MobileNavMenu } from "./MobileNavMenu"

export function LandingHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-30 px-4 pt-3">
      <div className="landing-nav-pill mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-5">
        <MobileNavMenu />

        <Link href="/#top" className="flex shrink-0 items-center gap-2 font-display text-lg font-bold tracking-[-0.02em]">
          <Image
            src="/corretor-studio-icon.svg"
            alt="Corretor Studio"
            width={34}
            height={34}
            className="size-8 rounded-full"
            priority
          />
          <span className="hidden sm:inline">Corretor Studio</span>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-7 text-sm font-medium text-landing-body min-[920px]:flex">
          <Link href="/#crm" className="transition-colors hover:text-[var(--landing-ink)]">
            Plataforma
          </Link>
          <Link href="/#como" className="transition-colors hover:text-[var(--landing-ink)]">
            Como funciona
          </Link>
          <Link href="/#integ" className="transition-colors hover:text-[var(--landing-ink)]">
            Integrações
          </Link>
          <Link href="/#faq" className="transition-colors hover:text-[var(--landing-ink)]">
            Dúvidas
          </Link>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link
            href="/sign-in"
            className="hidden min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-landing-body transition-colors hover:text-[var(--landing-ink)] sm:inline-flex"
            aria-label="Entrar na conta"
          >
            <LogIn className="size-4" aria-hidden />
            Entrar
          </Link>
          <DemoRequestDialogButton
            className="landing-primary-cta inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Solicitar demonstração
            <ArrowRight className="size-4" aria-hidden />
          </DemoRequestDialogButton>
        </div>
      </div>
    </header>
  )
}
