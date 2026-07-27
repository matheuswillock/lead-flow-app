const RADAR_SEGMENTS = [
  {
    name: "Aptos para e-mail",
    description: "E-mail válido e consentimento ok",
    count: "1.284",
  },
  {
    name: "Carteira próxima de renovação",
    description: "Renovação em até 60 dias",
    count: "186",
  },
  {
    name: "Abriram e não clicaram",
    description: "Abriram sem clicar no link",
    count: "412",
  },
  {
    name: "Sem campanha recente",
    description: "Sem envio nos últimos 60 dias",
    count: "903",
  },
] as const

export function RadarFeaturePreview() {
  return (
    <div className="bg-card px-4 py-5 text-landing-ink sm:px-5 sm:py-6" aria-hidden>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-sm font-semibold tracking-[-0.02em] text-landing-ink">
            Segmentos do Radar
          </p>
          <p className="mt-1 text-xs text-landing-body">
            Audiência dinâmica para campanhas de e-mail
          </p>
        </div>
        <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-primary">
          6 prontos
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {RADAR_SEGMENTS.map((segment) => (
          <div
            key={segment.name}
            className="flex flex-col gap-2 rounded-xl border border-border bg-secondary p-3.5"
          >
            <p className="text-sm font-medium leading-5 text-landing-ink">{segment.name}</p>
            <p className="text-xs leading-5 text-landing-body">{segment.description}</p>
            <p className="font-display text-2xl font-semibold tracking-[-0.03em] text-landing-ink">
              {segment.count}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
