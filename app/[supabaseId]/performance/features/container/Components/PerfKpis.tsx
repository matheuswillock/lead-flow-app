import { Calendar, Handshake, Target, UserX } from "lucide-react";
import { KpiCard } from "./KpiCard";

type CardData = {
  icon: React.ComponentType<{ size: number; style?: React.CSSProperties }>;
  label: string;
  value: number | string;
  suffix?: string;
  helper?: string;
  delta?: number;
  deltaInverse?: boolean;
  sparkValues: number[];
  sparkColor?: string;
  accent?: "primary" | "info" | "success" | "danger" | "warn";
  featured?: boolean;
};

export function PerfKpis({ density = "comfortable" }) {
  const cards: CardData[] = [
    {
      icon: Handshake,
      label: "Vendas fechadas",
      value: "47",
      helper: "R$ 3.124.500 em receita",
      delta: 12.4,
      accent: "primary",
      featured: true,
      sparkValues: [3, 5, 4, 6, 8, 7, 9, 8, 11, 10, 12, 14],
    },
    {
      icon: Target,
      label: "Reuniões realizadas",
      value: "182",
      helper: "de 214 agendadas",
      delta: 8.2,
      accent: "info",
      sparkValues: [12, 14, 13, 16, 18, 17, 19, 21, 20, 22, 24, 26],
    },
    {
      icon: Calendar,
      label: "Agendamentos realizados",
      value: "214",
      helper: "média 7,1/dia",
      delta: 5.6,
      accent: "success",
      sparkValues: [10, 12, 15, 14, 17, 16, 19, 21, 20, 23, 22, 25],
    },
    {
      icon: UserX,
      label: "Taxa de no-show",
      value: "14,9",
      suffix: "%",
      helper: "32 reuniões perdidas",
      delta: -3.1,
      deltaInverse: true, // negative = good
      accent: "warn",
      sparkValues: [22, 21, 20, 19, 21, 18, 17, 18, 16, 15, 16, 15],
    },
  ]

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 ${density === "compact" ? "lg:grid-cols-4" : "lg:grid-cols-4"} gap-4`}
    >
      {cards.map((c, i) => (
        <KpiCard key={i} {...c} />
      ))}
    </div>
  )
}
