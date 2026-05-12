"use client";

import { useRef, useState } from "react";
import { Calendar, Handshake, Target, TrendingUp, UserX } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { GoalAppliesTo, GoalIndicator, GoalPeriod } from "../../context/GoalsTypes";
import { goalsService } from "../../services/GoalsService";

interface NovaMetaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INDICATORS: { value: GoalIndicator; label: string; icon: React.ReactNode; suffix: string }[] = [
  { value: "vendas", label: "Vendas", icon: <Handshake size={15} />, suffix: "vendas" },
  { value: "receita", label: "Receita", icon: <TrendingUp size={15} />, suffix: "R$" },
  { value: "reunioes", label: "Reuniões", icon: <Target size={15} />, suffix: "reuniões" },
  { value: "agendamentos", label: "Agendamentos", icon: <Calendar size={15} />, suffix: "agend." },
  { value: "no-show", label: "No-show", icon: <UserX size={15} />, suffix: "%" },
];

const PERIOD_LABELS: Record<GoalPeriod, string> = {
  semanal: "semanal",
  mensal: "mensal",
  trimestral: "trimestral",
};


function buildResumo(
  indicator: GoalIndicator | "",
  targetValue: number,
  period: GoalPeriod,
  appliesTo: GoalAppliesTo,
  startDate: string,
  endDate: string
): string {
  if (!indicator || !targetValue || !startDate || !endDate) return "";
  const ind = INDICATORS.find((i) => i.value === indicator);
  const suffix = ind?.suffix ?? "";
  const valueLabel = indicator === "receita" ? `R$ ${targetValue.toLocaleString("pt-BR")}` : `${targetValue} ${suffix}`;
  return `Atingir ${valueLabel} em ${ind?.label.toLowerCase() ?? indicator} para a ${appliesTo}, no período ${PERIOD_LABELS[period]} de ${startDate} até ${endDate}.`;
}

function getDefaultDates(period: GoalPeriod): { start: string; end: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (period === "semanal") {
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: fmt(monday), end: fmt(sunday) };
  }
  if (period === "mensal") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: fmt(start), end: fmt(end) };
  }
  // trimestral
  const q = Math.floor(now.getMonth() / 3);
  const start = new Date(now.getFullYear(), q * 3, 1);
  const end = new Date(now.getFullYear(), q * 3 + 3, 0);
  return { start: fmt(start), end: fmt(end) };
}

function defaultState() {
  const dates = getDefaultDates("mensal");
  return {
    indicator: "" as GoalIndicator | "",
    period: "mensal" as GoalPeriod,
    appliesTo: "equipe" as GoalAppliesTo,
    startDate: dates.start,
    endDate: dates.end,
    targetValue: 0,
    reward: "",
    notifyTeam: true,
  };
}

export function NovaMetaModal({ open, onOpenChange }: NovaMetaModalProps) {
  const [form, setForm] = useState(defaultState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlight = useRef(false);

  function handlePeriodChange(period: GoalPeriod) {
    const dates = getDefaultDates(period);
    setForm((f) => ({ ...f, period, startDate: dates.start, endDate: dates.end }));
  }

  function handleOpenChange(value: boolean) {
    if (!value) setForm(defaultState);
    onOpenChange(value);
  }

  const isValid =
    form.indicator !== "" &&
    form.targetValue > 0 &&
    !!form.startDate &&
    !!form.endDate &&
    form.endDate >= form.startDate;

  async function handleSubmit() {
    if (!isValid || inFlight.current || isSubmitting) return;
    if (!form.indicator) return;
    inFlight.current = true;
    setIsSubmitting(true);
    try {
      await goalsService.createGoal({
        indicator: form.indicator,
        period: form.period,
        appliesTo: form.appliesTo,
        startDate: form.startDate,
        endDate: form.endDate,
        targetValue: form.targetValue,
        reward: form.reward || undefined,
        notifyTeam: form.notifyTeam,
      });
      toast.success("Meta criada com sucesso!");
      handleOpenChange(false);
    } catch (err) {
      console.error("[NovaMetaModal] createGoal error", err);
      toast.error("Erro ao criar meta. Tente novamente.");
    } finally {
      setIsSubmitting(false);
      inFlight.current = false;
    }
  }

  const resumo = buildResumo(
    form.indicator,
    form.targetValue,
    form.period,
    form.appliesTo,
    form.startDate,
    form.endDate
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova meta</DialogTitle>
          <DialogDescription>Defina objetivo, prazo e responsáveis</DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto py-1 pr-1">
          {/* Indicador */}
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Indicador
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {INDICATORS.map(({ value, label, icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, indicator: value }))}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[13px] font-medium transition-colors",
                    form.indicator === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card/50 text-foreground/80 hover:bg-card"
                  )}
                >
                  <span className={cn(form.indicator === value ? "text-primary" : "text-muted-foreground")}>
                    {icon}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Período + Aplicar a */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Período
              </Label>
              <ToggleGroup
                type="single"
                value={form.period}
                onValueChange={(v) => v && handlePeriodChange(v as GoalPeriod)}
                className="justify-start gap-1"
              >
                <ToggleGroupItem value="semanal" className="text-xs px-3">Semanal</ToggleGroupItem>
                <ToggleGroupItem value="mensal" className="text-xs px-3">Mensal</ToggleGroupItem>
                <ToggleGroupItem value="trimestral" className="text-xs px-3">Trimestral</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Aplicar a
              </Label>
              <ToggleGroup
                type="single"
                value={form.appliesTo}
                onValueChange={(v) => v && setForm((f) => ({ ...f, appliesTo: v as GoalAppliesTo }))}
                className="justify-start gap-1"
              >
                <ToggleGroupItem value="equipe" className="text-xs px-3">Equipe</ToggleGroupItem>
                <ToggleGroupItem value="individual" className="text-xs px-3">Individual</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="meta-start" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Início
              </Label>
              <Input
                id="meta-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="meta-end" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Fim
              </Label>
              <Input
                id="meta-end"
                type="date"
                value={form.endDate}
                min={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>

          {/* Meta value */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="meta-value" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Meta
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="meta-value"
                type="number"
                min={1}
                placeholder="0"
                value={form.targetValue || ""}
                onChange={(e) => setForm((f) => ({ ...f, targetValue: Number(e.target.value) }))}
                className="flex-1"
              />
              {form.indicator && (
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {INDICATORS.find((i) => i.value === form.indicator)?.suffix}
                </Badge>
              )}
            </div>
          </div>

          {/* Recompensa */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="meta-reward" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Recompensa <span className="normal-case font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="meta-reward"
              placeholder="Ex: bônus de R$ 500 para quem bater"
              value={form.reward}
              onChange={(e) => setForm((f) => ({ ...f, reward: e.target.value }))}
            />
          </div>

          {/* Notificações */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-card/40 px-4 py-3">
            <Label htmlFor="meta-notify" className="text-[13px] cursor-pointer">
              Notificações
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-muted-foreground">Avisar a equipe sobre a nova meta</span>
              <Switch
                id="meta-notify"
                checked={form.notifyTeam}
                onCheckedChange={(v) => setForm((f) => ({ ...f, notifyTeam: v }))}
              />
            </div>
          </div>

          {/* Resumo */}
          {resumo && (
            <div className="rounded-lg border border-border bg-card/40 px-4 py-3 flex items-start gap-3">
              <Target size={15} className="text-primary shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                {resumo}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isSubmitting}>
            {isSubmitting ? "Criando..." : "Criar meta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
