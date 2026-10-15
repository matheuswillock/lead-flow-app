import { ArrowRight } from "lucide-react"
import { landingPrimaryAction } from "./landingNavigation"

export function LandingPrimaryAction() {
  return (
    <button
      type="button"
      disabled
      aria-label={`${landingPrimaryAction.label} — preços em breve`}
      title="Preços em breve"
      data-future-destination={landingPrimaryAction.futureDestination}
      className="landing-primary-cta inline-flex min-h-11 cursor-not-allowed items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-[var(--landing-invert)] opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed"
    >
      {landingPrimaryAction.label}
      <ArrowRight className="size-4" aria-hidden />
    </button>
  )
}
