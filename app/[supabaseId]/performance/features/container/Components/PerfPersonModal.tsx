import { Button } from "@/components/ui/button";
import { Activity, ArrowRight, Calendar, Check, Handshake, Target, TrendingUp, UserX } from "lucide-react";
import { FunnelStep } from "./FunnelStep";
import { ModalSparkline } from "./ModalSparkline";
import { IconTrendingUp, IconX } from "@tabler/icons-react";
import { StatTile } from "./StatTile";
import { startOfDayInTz } from '../../../../../../lib/dates/core';

interface PerfPersonModalProps {
  person: {
    name: string
    email: string
    avatar: string
    team: string
    joined: string
    rank: number
    kind: "closer" | "sdr"
    stats: any // for simplicity
    trendPct: number
    trend: number[]
    funnel: { label: string; value: number }[]
    activity: { text: string; when: string; tone?: "good" | "bad" | "neutral"; icon: React.ReactNode }[]
  } | null
  onClose: () => void
}


export function PerfPersonModal({ person, onClose }: PerfPersonModalProps) {
  if (!person) return null
  const isCloser = person.kind === "closer"
  const accent = isCloser ? "var(--primary)" : "var(--info)"
  const stats = person.stats
  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-190 max-h-[88vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
        {/* Header */}
        <div className="relative overflow-hidden border-b border-border">
          <div
            className="absolute inset-0 pointer-events-none opacity-70"
            style={{
              background: `radial-gradient(120% 110% at 100% 0%, color-mix(in oklab, ${accent} 24%, transparent) 0%, transparent 60%)`,
            }}
          ></div>
          <div className="relative p-5 flex items-start gap-4">
            <div
              className={`size-14 rounded-full ${person.avatar} grid place-items-center text-[16px] font-semibold text-white shrink-0`}
            >
              {person.name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="text-[10.5px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md"
                  style={{
                    background: `color-mix(in oklab, ${accent} 18%, transparent)`,
                    color: accent,
                  }}
                >
                  {isCloser ? "Closer" : "SDR"}
                </span>
                <span className="text-[11px] text-white/45">{person.team}</span>
              </div>
              <h2 className="font-display text-[22px] font-bold leading-tight mt-1">
                {person.name}
              </h2>
              <div className="text-[12px] text-white/55 mt-0.5">
                {person.email} · entrou em {person.joined}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right">
                <div className="text-[10.5px] text-white/45 uppercase tracking-wider">Posição</div>
                <div className="font-display text-[20px] font-bold num">#{person.rank}</div>
              </div>
              <Button
                onClick={onClose}
                className="size-8 grid place-items-center rounded-md hover:bg-white/6 text-white/70 ml-2"
              >
                <IconX size={16} />
              </Button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {isCloser ? (
              <>
                <StatTile
                  label="Vendas"
                  value={stats.vendas}
                  suffix="fechadas"
                  accent={accent}
                  icon={<Handshake size={12} />}
                />
                <StatTile
                  label="Receita"
                  value={stats.receita}
                  suffix=""
                  sub="ticket médio R$ 69k"
                  icon={<TrendingUp size={12} className="text-(--success)" />}
                />
                <StatTile
                  label="Conversão"
                  value={stats.conversao}
                  suffix="%"
                  sub={`${stats.reunioes} reuniões`}
                  icon={<Target size={12} />}
                />
                <StatTile
                  label="No-show"
                  value={stats.noshow}
                  suffix="%"
                  sub={`${stats.faltas} faltas`}
                  icon={<UserX size={12} className="text-[var(--danger)]" />}
                />
              </>
            ) : (
              <>
                <StatTile
                  label="Agendamentos"
                  value={stats.agendamentos}
                  suffix=""
                  accent={accent}
                  icon={<Calendar size={12} />}
                />
                <StatTile
                  label="Realizadas"
                  value={stats.realizadas}
                  suffix={`/ ${stats.agendamentos}`}
                  sub={`${stats.show}% taxa de presença`}
                  icon={<Check size={12} className="text-(--success)" />}
                />
                <StatTile
                  label="Conexões"
                  value={stats.conexoes}
                  suffix=""
                  sub={`${stats.tentativas} tentativas`}
                  icon={<Activity size={12} />}
                />
                <StatTile
                  label="No-show"
                  value={stats.noshow}
                  suffix="%"
                  sub={`${stats.faltas} faltas`}
                  icon={<UserX size={12} className="text-(--danger)" />}
                />
              </>
            )}
          </div>

          {/* Trend */}
          <div className="rounded-xl border border-border bg-(--card-2)/40 p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-[12.5px] font-semibold">Tendência · últimos 14 dias</div>
                <div className="text-[11px] text-white/45">
                  {isCloser ? "vendas fechadas por dia" : "agendamentos por dia"}
                </div>
              </div>
              <div className="text-[11px] text-(--success) font-semibold flex items-center gap-1">
                <IconTrendingUp size={12} /> +{person.trendPct}%
              </div>
            </div>
            <ModalSparkline data={person.trend} color={accent} />
          </div>

          {/* Funnel */}
          <div className="rounded-xl border border-border bg-(--card-2)/40 p-4">
            <div className="text-[12.5px] font-semibold mb-3">Funil pessoal</div>
            <div className="space-y-2.5">
              {person.funnel.map((s) => (
                <FunnelStep key={s.label} {...s} pct={s.value} color={accent} />
              ))}
            </div>
          </div>

          {/* Recent activity */}
          <div className="rounded-xl border border-border bg-(--card-2)/40 p-4">
            <div className="text-[12.5px] font-semibold mb-3">Atividade recente</div>
            <div className="space-y-2.5">
              {person.activity.map((a, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div
                    className="size-7 rounded-md grid place-items-center bg-card border border-border shrink-0 mt-0.5"
                    style={{
                      color:
                        a.tone === "good"
                          ? "var(--success)"
                          : a.tone === "bad"
                            ? "var(--danger)"
                            : "var(--info)",
                    }}
                  >
                    {a.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] text-white/85">{a.text}</div>
                    <div className="text-[11px] text-white/45 mt-0.5">{a.when}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-border flex items-center justify-between bg-(--card-2)/30">
          <span className="text-[11px] text-white/45">Período: últimos 7 dias</span>
          <div className="flex items-center gap-2">
            <Button
              onClick={onClose}
              className="h-8 px-3 text-[12px] rounded-md border border-border hover:bg-white/4 text-white/85"
            >
              Fechar
            </Button>
            <Button className="h-8 px-3 text-[12px] rounded-md bg-primary text-primary-foreground font-semibold inline-flex items-center gap-1.5">
              <ArrowRight size={12} /> Abrir perfil
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}