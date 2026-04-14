import { BarChart3, Star, TrendingUp, Users } from "lucide-react"

const stats = [
  { icon: Users, value: "500+", label: "corretores ativos" },
  { icon: BarChart3, value: "50k+", label: "leads gerenciados" },
  { icon: TrendingUp, value: "+40%", label: "mais conversão" },
  { icon: Star, value: "4.9/5", label: "avaliação média" },
]

export function LogoBar() {
  return (
    <section className="relative border-y border-border py-8 bg-muted/40">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <p className="text-center text-sm font-medium text-muted-foreground mb-6">
          Confiado por mais de 500 corretores de saúde em todo o Brasil
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 rounded-xl px-4 py-3 landing-surface-card-soft"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <stat.icon className="h-4 w-4" />
              </div>
              <div className="text-center sm:text-left">
                <div className="text-lg font-extrabold leading-none text-primary">
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
