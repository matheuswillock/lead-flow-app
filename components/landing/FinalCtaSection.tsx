import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { DemoRequestDialogButton } from "./DemoRequestDialog"

export function FinalCtaSection() {
  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <div className="landing-final-cta">
          <span aria-hidden className="landing-final-cta-orb landing-final-cta-orb--left" />
          <span aria-hidden className="landing-final-cta-orb landing-final-cta-orb--right" />
          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <h2 className="text-balance font-display text-3xl font-extrabold leading-tight tracking-[-0.03em] md:text-5xl">
              Pronto para disparar no público certo?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-8 text-landing-panel-body">
              Conheça o CRM na prática: veja seus leads, a carteira e as campanhas reunidos em um só lugar.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/checkout"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-card px-6 py-3 font-semibold text-[var(--landing-cta-bg)] shadow-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                Contratar online
                <ArrowRight className="size-5" aria-hidden />
              </Link>
              <DemoRequestDialogButton
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-landing-panel-border bg-landing-panel-control px-6 py-3 font-semibold text-landing-invert transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                Solicitar demonstração
                <ArrowRight className="size-5" aria-hidden />
              </DemoRequestDialogButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
