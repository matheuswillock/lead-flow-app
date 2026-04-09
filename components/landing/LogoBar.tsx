import { BarChart3, Star, TrendingUp, Users } from "lucide-react"

const stats = [
  { icon: Users, value: "500+", label: "corretores ativos" },
  { icon: BarChart3, value: "50k+", label: "leads gerenciados" },
  { icon: TrendingUp, value: "+40%", label: "mais conversão" },
  { icon: Star, value: "4.9/5", label: "avaliação média" },
]

export function LogoBar() {
  return (
    <section
      className="relative border-y py-8"
      style={{ borderColor: "var(--border)", background: "color-mix(in oklab, var(--muted) 40%, transparent)" }}
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <p className="text-center text-sm font-medium text-muted-foreground mb-6">
          Confiado por mais de 500 corretores de saúde em todo o Brasil
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 rounded-xl border px-4 py-3"
              style={{
                borderColor: "var(--border)",
                background: "color-mix(in oklab, var(--card) 70%, transparent)",
              }}
            >
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: "color-mix(in oklab, var(--primary) 12%, transparent)",
                  color: "var(--primary)",
                }}
              >
                <stat.icon className="h-4 w-4" />
              </div>
              <div className="text-center sm:text-left">
                <div className="text-lg font-extrabold leading-none" style={{ color: "var(--primary)" }}>
                  {stat.value}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
