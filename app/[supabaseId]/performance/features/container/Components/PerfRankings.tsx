import { Medal, Trophy } from "lucide-react";
import { PerfPersonModal } from "./PerfPersonModal";
import { RankRow } from "./RankRow";
import { buildPerson } from "./buildPerson";
import { useEffect, useState } from "react";

export function PerfRankings() {
  const [selected, setSelected] = useState(null)
  const closersRaw = [
    {
      name: "Ana Souza",
      role: "CLOSER",
      avatar: "avatar-1",
      value: 18,
      secondary: "R$ 1.248k receita",
      pct: 100,
      stats: { vendas: 18, receita: 1248000, conversao: 92, reunioes: 28, faltas: 3, noshow: 10 },
    },
    {
      name: "Carla Reis",
      role: "CLOSER",
      avatar: "avatar-3",
      value: 14,
      secondary: "R$ 942k receita",
      pct: 78,
      stats: { vendas: 14, receita: 942000, conversao: 88, reunioes: 21, faltas: 2, noshow: 9 },
    },
    {
      name: "Marcelo Otto",
      role: "CLOSER",
      avatar: "avatar-5",
      value: 9,
      secondary: "R$ 612k receita",
      pct: 50,
      stats: { vendas: 9, receita: 612000, conversao: 80, reunioes: 15, faltas: 1, noshow: 7 },
    },
    {
      name: "Júlia Mendes",
      role: "CLOSER",
      avatar: "avatar-6",
      value: 4,
      secondary: "R$ 286k receita",
      pct: 22,
      stats: { vendas: 4, receita: 286000, conversao: 75, reunioes: 8, faltas: 1, noshow: 5 },
    },
    {
      name: "Renato Faria",
      role: "CLOSER",
      avatar: "avatar-4",
      value: 2,
      secondary: "R$ 124k receita",
      pct: 11,
      stats: { vendas: 2, receita: 124000, conversao: 67, reunioes: 5, faltas: 1, noshow: 3 },
    },
  ]

  const sdrsRaw = [
    {
      name: "Bruno Lima",
      role: "",
      avatar: "avatar-2",
      value: 62,
      secondary: "57 reuniões realizadas - 92%",
      pct: 100,
      stats: { agendamentos: 62, realizadas: 57, show: 92, tentativas: 145, conexoes: 89, faltas: 5, noshow: 8 },
    },
    {
      name: "Diego Pinto",
      role: "",
      avatar: "avatar-4",
      value: 54,
      secondary: "47 reuniões realizadas - 88%",
      pct: 87,
      stats: { agendamentos: 54, realizadas: 47, show: 88, tentativas: 128, conexoes: 76, faltas: 7, noshow: 9 },
    },
    {
      name: "Helena Castro",
      role: "",
      avatar: "avatar-6",
      value: 41,
      secondary: "34 reuniões realizadas - 84%",
      pct: 66,
      stats: { agendamentos: 41, realizadas: 34, show: 84, tentativas: 98, conexoes: 62, faltas: 7, noshow: 8 },
    },
    {
      name: "Tiago Vieira",
      role: "",
      avatar: "avatar-5",
      value: 33,
      secondary: "26 reuniões realizadas - 79%",
      pct: 53,
      stats: { agendamentos: 33, realizadas: 26, show: 79, tentativas: 76, conexoes: 48, faltas: 7, noshow: 6 },
    },
    {
      name: "Marina Alves",
      role: "",
      avatar: "avatar-3",
      value: 24,
      secondary: "17 reuniões realizadas - 71%",
      pct: 39,
      stats: { agendamentos: 24, realizadas: 17, show: 71, tentativas: 54, conexoes: 35, faltas: 7, noshow: 5 },
    },
  ]

  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selected])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* CLOSERS — Vendas */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-md grid place-items-center bg-[color-mix(in_oklab,var(--primary)_15%,var(--card-2))] border border-[color-mix(in_oklab,var(--primary)_25%,transparent)]">
              <Trophy size={14} className="text-primary" />
            </div>
            <div>
              <div className="text-[14px] font-semibold">Ranking de Closers</div>
              <div className="text-[11px] text-white/45">por vendas fechadas no período</div>
            </div>
          </div>
        </div>
        <div className="p-2.5">
          {closersRaw.map((r, i) => (
            <RankRow
              key={r.name}
              rank={i + 1}
              {...r}
              suffix="vendas"
              color="var(--primary)"
              onClick={() => setSelected(buildPerson({ p: r, idx: i, kind: "closer" }))}
            />
          ))}
        </div>
      </div>

      {/* SDRs — Agendamentos */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-md grid place-items-center bg-[color-mix(in_oklab,var(--info)_15%,var(--card-2))] border border-[color-mix(in_oklab,var(--info)_25%,transparent)]">
              <Medal size={14} className="text-(--info)" />
            </div>
            <div>
              <div className="text-[14px] font-semibold">Ranking de SDRs</div>
              <div className="text-[11px] text-white/45">por agendamentos realizados</div>
            </div>
          </div>
        </div>
        <div className="p-2.5">
          {sdrsRaw.map((r, i) => (
            <RankRow
              key={r.name}
              rank={i + 1}
              {...r}
              suffix="agend."
              color="var(--info)"
              onClick={() => setSelected(buildPerson({ p: r, idx: i, kind: "sdr" }))}
            />
          ))}
        </div>
      </div>

      <PerfPersonModal person={selected} onClose={() => setSelected(null)} />
    </div>
  )
}