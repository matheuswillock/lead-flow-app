"use client";

import { toast } from "sonner";
import { ArrowRight, Calendar, Check, Handshake, Target, TrendingUp, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatTile } from "./StatTile";

interface PersonStats {
  // Closer
  vendas?: number;
  receita?: number;
  conversao?: number;
  reunioes?: number;
  // SDR
  agendamentos?: number;
  realizadas?: number;
  show?: number;
  // Common
  noshow: number;
  faltas: number;
}

interface ActivityItem {
  text: string;
  when: string;
  tone?: "good" | "bad" | "neutral";
  icon: React.ReactNode;
}

export interface PerfPersonModalPerson {
  name: string;
  email: string;
  avatar: string;
  team: string;
  joined: string;
  rank: number;
  kind: "closer" | "sdr";
  stats: PersonStats;
  activity: ActivityItem[];
}

interface PerfPersonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: PerfPersonModalPerson | null;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (value >= 1_000) return `R$ ${Math.round(value / 1_000)}k`;
  return `R$ ${value.toFixed(0)}`;
}

export function PerfPersonModal({ open, onOpenChange, person }: PerfPersonModalProps) {
  if (!person) return null;

  const isCloser = person.kind === "closer";
  const accent = isCloser ? "var(--primary)" : "var(--info)";
  const { stats } = person;

  const initials = person.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-2xl p-0 gap-0 overflow-hidden">
        {/* Visually hidden accessible title/description */}
        <DialogHeader className="sr-only">
          <DialogTitle>{person.name}</DialogTitle>
          <DialogDescription>
            Perfil de performance de {person.name} — {isCloser ? "Closer" : "SDR"}
          </DialogDescription>
        </DialogHeader>

        {/* Custom header with glow */}
        <div className="relative overflow-hidden border-b border-border">
          <div
            className="absolute inset-0 pointer-events-none opacity-70"
            style={{
              background: `radial-gradient(120% 110% at 100% 0%, color-mix(in oklab, ${accent} 24%, transparent) 0%, transparent 60%)`,
            }}
          />
          <div className="relative p-5 flex items-start gap-4">
            <div
              className={`size-14 rounded-full ${person.avatar} grid place-items-center text-[16px] font-semibold text-white shrink-0`}
            >
              {initials}
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
                {person.team && (
                  <span className="text-[11px] text-foreground/45">{person.team}</span>
                )}
              </div>
              <h2 className="font-display text-[22px] font-bold leading-tight mt-1">
                {person.name}
              </h2>
              <div className="text-[12px] text-foreground/55 mt-0.5">
                {person.email}
                {person.joined && ` · entrou em ${person.joined}`}
              </div>
            </div>
            <div className="shrink-0 text-right pr-1">
              <div className="text-[10.5px] text-foreground/45 uppercase tracking-wider">Posição</div>
              <div className="font-display text-[20px] font-bold num">#{person.rank}</div>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Stats grid */}
          <div
            className={`grid grid-cols-2 gap-3 ${
              isCloser ? "sm:grid-cols-4" : "sm:grid-cols-3"
            }`}
          >
            {isCloser ? (
              <>
                <StatTile
                  label="Vendas"
                  value={stats.vendas ?? 0}
                  suffix="fechadas"
                  accent={accent}
                  icon={<Handshake size={12} />}
                />
                <StatTile
                  label="Receita"
                  value={formatCurrency(stats.receita ?? 0)}
                  sub={
                    stats.vendas && stats.vendas > 0 && stats.receita
                      ? `ticket médio ${formatCurrency(stats.receita / stats.vendas)}`
                      : undefined
                  }
                  icon={<TrendingUp size={12} className="text-(--success)" />}
                />
                <StatTile
                  label="Conversão"
                  value={stats.conversao ?? 0}
                  suffix="%"
                  sub={stats.reunioes ? `${stats.reunioes} reuniões` : undefined}
                  icon={<Target size={12} />}
                />
                <StatTile
                  label="No-show"
                  value={stats.noshow}
                  suffix="%"
                  sub={`${stats.faltas} faltas`}
                  icon={<UserX size={12} className="text-(--danger)" />}
                />
              </>
            ) : (
              <>
                <StatTile
                  label="Agendamentos"
                  value={stats.agendamentos ?? 0}
                  accent={accent}
                  icon={<Calendar size={12} />}
                />
                <StatTile
                  label="Realizadas"
                  value={stats.realizadas ?? 0}
                  suffix={stats.agendamentos ? `/ ${stats.agendamentos}` : undefined}
                  sub={stats.show != null ? `${stats.show.toFixed(0)}% taxa de presença` : undefined}
                  icon={<Check size={12} className="text-(--success)" />}
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

          {/* Atividade recente */}
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="text-[12.5px] font-semibold mb-3">Atividade recente</div>
            {person.activity.length === 0 ? (
              <p className="text-[12px] text-muted-foreground py-3 text-center">
                Nenhuma atividade recente neste período.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
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
                      <div className="text-[12.5px] text-foreground/85">{a.text}</div>
                      <div className="text-[11px] text-foreground/45 mt-0.5">{a.when}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Fixed footer */}
        <DialogFooter className="px-5 py-3.5 border-t border-border bg-muted/20">
          <span className="text-[11px] text-foreground/45 mr-auto">Período: últimos 7 dias</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
          <Button
            size="sm"
            onClick={() => toast.info("Perfil completo em breve.")}
          >
            <ArrowRight data-icon="inline-start" size={12} />
            Abrir perfil
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
