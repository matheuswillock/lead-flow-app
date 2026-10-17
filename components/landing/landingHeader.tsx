import Link from "next/link"
import Image from "next/image"
import { ArrowRight, LogIn } from "lucide-react"
import { DemoRequestDialogButton } from "./DemoRequestDialog"
import { LandingPrimaryAction } from "./LandingPrimaryAction"
import { MobileNavMenu } from "./MobileNavMenu"
import { landingNavigationItems } from "./landingNavigation"

export function LandingHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-30 px-4 pt-3">
      <div className="landing-nav-pill mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-5">
        <Link
          href="/#top"
          className="flex min-h-11 min-w-11 shrink-0 items-center gap-2 font-display text-lg font-bold tracking-[-0.02em]"
        >
          <Image
            src="/corretor-studio-icon.svg"
            alt="Corretor Studio"
            width={34}
            height={34}
            className="size-8 rounded-full"
            priority
          />
          <span className="hidden min-[340px]:inline">Corretor Studio</span>
        </Link>

        <MobileNavMenu />

        <nav className="hidden flex-1 items-center justify-center gap-5 text-sm font-medium text-landing-body min-[1180px]:flex">
          {landingNavigationItems.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className="transition-colors hover:text-[var(--landing-ink)]"
              >
                {item.label}
              </Link>
            ) : (
              <span key={item.label} aria-disabled="true" className="text-landing-muted">
                {item.label}
              </span>
            ),
          )}
        </nav>

        <div className="ml-auto hidden shrink-0 items-center gap-1.5 min-[1180px]:flex">
          <Link
            href="/sign-in"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-semibold text-landing-body transition-colors hover:text-[var(--landing-ink)]"
            aria-label="Entrar na conta"
          >
            <LogIn className="size-4" aria-hidden />
            Entrar
          </Link>
          <DemoRequestDialogButton className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--landing-line)] bg-transparent px-4 text-sm font-semibold text-landing-body transition-colors hover:bg-[color-mix(in_srgb,var(--card)_78%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            Solicitar demonstração
            <ArrowRight className="size-4" aria-hidden />
          </DemoRequestDialogButton>
          <LandingPrimaryAction />
        </div>
      </div>
    </header>
  )
}
