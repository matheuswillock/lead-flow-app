"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useTeamContext } from "@/app/context/TeamContext";
import { cn } from "@/lib/utils";
import { performanceService } from "../../services/PerformanceService";
import { usePerformanceContext } from "../../context/PerformanceContext";
import type { ExportSectionFlags } from "../../utils/exportPerformanceCsv";
import { exportPerformanceFileDownload } from "../../utils/exportPerformanceCsv";

type ExportFormat = "pdf" | "excel" | "csv";
type ExportDelivery = "download" | "email";
type ExportPeriod = "1d" | "7d" | "15d" | "1m" | "3m";

interface ExportarRelatorioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FORMATS: { value: ExportFormat; label: string; description: string; icon: React.ReactNode; comingSoon?: boolean }[] = [
  { value: "pdf", label: "PDF", description: "Relatório com layout pronto para imprimir", icon: <FileText size={16} />, comingSoon: true },
  { value: "excel", label: "Excel", description: "Planilha com abas por página", icon: <FileSpreadsheet size={16} /> },
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
  { key: "rankingClosers", label: "Ranking de Closers", description: "Desempenho individual e total consolidado" },
  { key: "rankingSdrs", label: "Ranking de SDRs", description: "Agendamentos, presença e total consolidado" },
  { key: "comparison", label: "Comparativo com período anterior", description: "Variação % vs. janela anterior" },
];

function defaultSections(): ExportSectionFlags {
  return { kpis: true, rankingClosers: true, rankingSdrs: true, comparison: true };
}

function estimatePages(sections: ExportSectionFlags): number {
  let pages = 0;
  if (sections.kpis) pages += 1;
  if (sections.rankingClosers) pages += 1;
  if (sections.rankingSdrs) pages += 1;
  if (sections.comparison) pages += 1;
  return pages;
}

export function ExportarRelatorioModal({ open, onOpenChange }: ExportarRelatorioModalProps) {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { activeTeamId } = useTeamContext();
  const { filters } = usePerformanceContext();
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [period, setPeriod] = useState<ExportPeriod>((filters.preset as ExportPeriod) || "7d");
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
      if (format !== "excel") {
        toast.info("Formato em breve disponível.");
        return;
      }
    }

    if (!supabaseId || !activeTeamId) {
      toast.error("Não foi possível identificar o usuário para exportação.");
      return;
    }

    if (selectedCount === 0) {
      toast.error("Selecione ao menos uma seção para exportar.");
      return;
    }

    setIsExporting(true);
    try {
      const exportData = await performanceService.getSalesPerformance(supabaseId, activeTeamId, {
        ...filters,
        preset: period,
        startDate: "",
        endDate: "",
        page: 1,
        pageSize: 100,
      });

      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      if (delivery === "email") {
        await performanceService.sendPerformanceExportEmail(supabaseId, activeTeamId, {
          format,
          preset: period,
          sdrId: filters.sdrId || undefined,
          closerId: filters.closerId || undefined,
          search: filters.search || undefined,
          sections,
        });
        toast.success("Relatório enviado para seu e-mail.");
      } else {
        await exportPerformanceFileDownload(exportData, sections, `performance-${period}-${dateStr}`, format);
        toast.success("Relatório exportado com sucesso!");
      }

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
              <RadioGroup
                value={delivery}
                onValueChange={(v) => setDelivery(v as ExportDelivery)}
                className="flex items-center gap-6 pt-1"
              >
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="download" id="delivery-download" />
                  <span>Download</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="email" id="delivery-email" />
                  <span>E-mail</span>
                </label>
              </RadioGroup>
            </div>
          </div>

          {/* Seções */}
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Seções</span>
              <span className="normal-case font-normal text-muted-foreground">({selectedCount}/{SECTIONS.length})</span>
            </Label>
            <div className="flex flex-col gap-1.5">
              {SECTIONS.map(({ key, label, description }) => (
                <label
                  key={key}
                  className="flex items-start gap-3 px-0.5 py-2 cursor-pointer"
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
          <Button onClick={handleExport} disabled={isExporting || selectedCount === 0}>
            {isExporting ? "Exportando..." : (
              <>
                <Download data-icon="inline-start" size={14} />
                {delivery === "email" ? "Enviar por e-mail" : "Baixar"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
