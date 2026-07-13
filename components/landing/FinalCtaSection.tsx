import { ArrowRight } from "lucide-react"
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
              Pronto para vender mais organizado?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-8 text-landing-panel-body">
              Solicite uma demonstração e veja o Corretor Studio com os seus próprios números.
            </p>
            <DemoRequestDialogButton
              className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-card px-6 py-3 font-semibold text-landing-ink transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Solicitar demonstração
              <ArrowRight className="size-5" aria-hidden />
            </DemoRequestDialogButton>
          </div>
        </div>
      </div>
    </section>
  )
}
