import { Activity, ArrowUp, Calendar, Check, Handshake, UserX } from "lucide-react";

type PersonDetails = {
  name: string;
  stats: {
    vendas?: number;
    receita?: number;
    conversao?: number;
    reunioes?: number;
    faltas?: number;
    tentativas?: number;
    conexoes?: number;
    agendamentos?: number;
    realizadas?: number;
  }
}
interface BuildPersonProps {
  p: PersonDetails;
  idx: number
  kind: "closer" | "sdr"
}

export function buildPerson({ p, idx, kind }: BuildPersonProps) {
  const detailMap = kind === "closer" ? CLOSER_DETAILS : SDR_DETAILS
  const det = (detailMap as any)[p.name]
  const funnel =
    kind === "closer"
      ? [
          { label: "Reuniões agendadas", value: det.stats.reunioes + det.stats.faltas, pct: 100 },
          {
            label: "Reuniões realizadas",
            value: det.stats.reunioes,
            pct: Math.round((det.stats.reunioes / (det.stats.reunioes + det.stats.faltas)) * 100),
          },
          {
            label: "Propostas enviadas",
            value: Math.round(det.stats.reunioes * 0.65),
            pct: Math.round(
              ((det.stats.reunioes * 0.65) / (det.stats.reunioes + det.stats.faltas)) * 100,
            ),
          },
          { label: "Vendas fechadas", value: det.stats.vendas, pct: det.stats.conversao },
        ]
      : [
          { label: "Tentativas de contato", value: det.stats.tentativas, pct: 100 },
          {
            label: "Conexões efetivas",
            value: det.stats.conexoes,
            pct: Math.round((det.stats.conexoes / det.stats.tentativas) * 100),
          },
          {
            label: "Agendamentos",
            value: det.stats.agendamentos,
            pct: Math.round((det.stats.agendamentos / det.stats.tentativas) * 100),
          },
          {
            label: "Realizadas",
            value: det.stats.realizadas,
            pct: Math.round((det.stats.realizadas / det.stats.tentativas) * 100),
          },
        ]
  const activity =
    kind === "closer"
      ? [
          {
            icon: <Handshake size={12} />,
            tone: "good",
            text: `Fechou venda com Cliente #${1240 + idx} · R$ ${40 + idx * 13}k`,
            when: "há 2h",
          },
          {
            icon: <Calendar size={12} />,
            tone: "info",
            text: "Reunião concluída com Lead Aqua Solar",
            when: "há 5h",
          },
          {
            icon: <ArrowUp size={12} />,
            tone: "good",
            text: "Proposta enviada para Vital Tech",
            when: "ontem · 17:42",
          },
          {
            icon: <UserX size={12} />,
            tone: "bad",
            text: "No-show de Lead Mont Group",
            when: "ontem · 14:00",
          },
        ]
      : [
          {
            icon: <Calendar size={12} />,
            tone: "good",
            text: `Agendou ${3 + idx} reuniões para esta semana`,
            when: "há 1h",
          },
          {
            icon: <Activity size={12} />,
            tone: "info",
            text: `${22 + idx * 4} ligações realizadas hoje`,
            when: "há 3h",
          },
          {
            icon: <Check size={12} />,
            tone: "good",
            text: "Lead qualificado: Solaris Energia",
            when: "ontem · 16:10",
          },
          {
            icon: <UserX size={12} />,
            tone: "bad",
            text: "Lead não compareceu — Tech Park",
            when: "ontem · 10:00",
          },
        ]
  return { ...p, ...det, kind, rank: idx + 1, funnel, activity }
}