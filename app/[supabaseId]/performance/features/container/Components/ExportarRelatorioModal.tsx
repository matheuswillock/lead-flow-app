"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Table } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { usePerformanceContext } from "../../context/PerformanceContext";
import type { ExportSectionFlags } from "../../utils/exportPerformanceCsv";
import { exportPerformanceCsv } from "../../utils/exportPerformanceCsv";

type ExportFormat = "pdf" | "excel" | "csv";
type ExportDelivery = "download" | "email";
type ExportPeriod = "1d" | "7d" | "15d" | "1m" | "3m";

interface ExportarRelatorioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FORMATS: { value: ExportFormat; label: string; description: string; icon: React.ReactNode; comingSoon?: boolean }[] = [
  { value: "pdf", label: "PDF", description: "Relatório com layout pronto para imprimir", icon: <FileText size={16} />, comingSoon: true },
  { value: "excel", label: "Excel", description: "Planilha com tabelas dinâmicas", icon: <FileSpreadsheet size={16} />, comingSoon: true },
  { value: "csv", label: "CSV", description: "Dados brutos para BI ou ETL", icon: <Table size={16} /> },
];

const PERIOD_OPTIONS: { value: ExportPeriod; label: string }[] = [
  { value: "1d", label: "Últimas 24h" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "15d", label: "Últimos 15 dias" },
  { value: "1m", label: "Último mês" },
  { value: "3m", label: "Últimos 3 meses" },
];

const SECTIONS: { key: keyof ExportSectionFlags; label: string; description: string }[] = [
  { key: "kpis", label: "KPIs principais", description: "Vendas, reuniões, agendamentos e no-show" },
  { key: "rankings", label: "Rankings", description: "Closers e SDRs no período" },
  { key: "funnelPessoal", label: "Funil pessoal", description: "Conversão por etapa de cada pessoa" },
  { key: "activities", label: "Atividades detalhadas", description: "Lista completa de eventos (pode aumentar muito o arquivo)" },
  { key: "comparison", label: "Comparativo com período anterior", description: "Variação % vs. janela anterior" },
];

function defaultSections(): ExportSectionFlags {
  return { kpis: true, rankings: true, funnelPessoal: true, activities: false, comparison: true };
}

function estimatePages(sections: ExportSectionFlags): number {
  let pages = 1;
  if (sections.kpis) pages += 1;
  if (sections.rankings) pages += 2;
  if (sections.funnelPessoal) pages += 1;
  if (sections.activities) pages += 3;
  if (sections.comparison) pages += 1;
  return pages;
}

export function ExportarRelatorioModal({ open, onOpenChange }: ExportarRelatorioModalProps) {
  const { data, filters } = usePerformanceContext();
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [period, setPeriod] = useState<ExportPeriod>(filters.preset as ExportPeriod || "7d");
  const [delivery, setDelivery] = useState<ExportDelivery>("download");
  const [sections, setSections] = useState<ExportSectionFlags>(defaultSections);
  const [isExporting, setIsExporting] = useState(false);

  const selectedCount = Object.values(sections).filter(Boolean).length;
  const estimatedPages = estimatePages(sections);
  const estimatedSecs = Math.max(1, Math.round(estimatedPages * 0.6));

  function handleOpenChange(value: boolean) {
    if (!value) {
      setFormat("csv");
      setPeriod(filters.preset as ExportPeriod || "7d");
      setDelivery("download");
      setSections(defaultSections());
    }
    onOpenChange(value);
  }

  function toggleSection(key: keyof ExportSectionFlags) {
    setSections((s) => ({ ...s, [key]: !s[key] }));
  }

  async function handleExport() {
    if (isExporting) return;

    if (format !== "csv") {
      toast.info("Formato em breve disponível.");
      return;
    }

    if (delivery === "email") {
      toast.info("Envio por e-mail em breve disponível.");
      return;
    }

    if (!data) {
      toast.error("Nenhum dado disponível para exportar.");
      return;
    }

    setIsExporting(true);
    try {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      exportPerformanceCsv(data, sections, `performance-${period}-${dateStr}`);
      toast.success("Relatório exportado com sucesso!");
      handleOpenChange(false);
    } catch (err) {
      console.error("[ExportarRelatorioModal] export error", err);
      toast.error("Erro ao exportar. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md grid place-items-center bg-primary/10 border border-primary/20">
              <Download size={15} className="text-primary" />
            </div>
            <div>
              <DialogTitle>Exportar relatório</DialogTitle>
              <DialogDescription>Escolha o formato, período e seções a incluir</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto py-1 pr-1">
          {/* Formato */}
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Formato
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map(({ value, label, description, icon, comingSoon }) => (
                <button
                  key={value}
                  type="button"
                  disabled={comingSoon}
                  onClick={() => !comingSoon && setFormat(value)}
                  className={cn(
                    "relative flex flex-col items-start gap-1.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    comingSoon
                      ? "cursor-not-allowed opacity-50 border-border bg-card/30"
                      : format === value
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card/50 hover:bg-card"
                  )}
                >
                  <div className={cn("flex items-center gap-1.5 text-[13px] font-medium", format === value && !comingSoon ? "text-primary" : "")}>
                    <span className={cn(format === value && !comingSoon ? "text-primary" : "text-muted-foreground")}>{icon}</span>
                    {label}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{description}</p>
                  {comingSoon && (
                    <Badge variant="secondary" className="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0">
                      Em breve
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Período + Entrega */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Período
              </Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as ExportPeriod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Entrega
              </Label>
              <ToggleGroup
                type="single"
                value={delivery}
                onValueChange={(v) => v && setDelivery(v as ExportDelivery)}
                className="justify-start gap-1"
              >
                <ToggleGroupItem value="download" className="text-xs px-3">Download</ToggleGroupItem>
                <ToggleGroupItem value="email" className="text-xs px-3">E-mail</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          {/* Seções */}
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Seções</span>
              <span className="normal-case font-normal text-muted-foreground">({selectedCount}/{SECTIONS.length})</span>
            </Label>
            <div className="flex flex-col gap-1">
              {SECTIONS.map(({ key, label, description }) => (
                <label
                  key={key}
                  className="flex items-start gap-3 rounded-lg border border-border bg-card/30 px-3 py-2.5 cursor-pointer hover:bg-card/50 transition-colors"
                >
                  <Checkbox
                    checked={sections[key]}
                    onCheckedChange={() => toggleSection(key)}
                    className="mt-0.5"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-medium">{label}</span>
                    <span className="text-[11.5px] text-muted-foreground">{description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-1.5 mr-auto text-[11px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary inline-block" />
            <span>Estimado: ~{estimatedPages} págs · {estimatedSecs} seg.</span>
          </div>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isExporting}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={isExporting || selectedCount === 0 || !data}>
            {isExporting ? "Exportando..." : (
              <>
                <Download data-icon="inline-start" size={14} />
                Baixar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
