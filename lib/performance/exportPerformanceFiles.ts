import JSZip from "jszip";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export type PerformanceExportFormat = "csv" | "excel";

export interface PerformanceExportSectionFlags {
  kpis: boolean;
  rankingClosers: boolean;
  rankingSdrs: boolean;
  comparison: boolean;
}

export const DEFAULT_PERFORMANCE_EXPORT_SECTIONS: PerformanceExportSectionFlags = {
  kpis: true,
  rankingClosers: true,
  rankingSdrs: true,
  comparison: true,
};

export interface PerformanceExportRankingEntry {
  profileId: string;
  name: string;
  count: number;
  totalSalesValue: number;
  meetingsHeld: number;
  noShowCount: number;
  attendanceRate: number;
}

export interface PerformanceExportData {
  kpis: {
    closedSales: number;
    meetingsHeld: number;
    scheduledLeads: number;
    noShowRate: number;
    noShowCount: number;
    closedSalesDelta: number;
    meetingsHeldDelta: number;
    scheduledLeadsDelta: number;
    noShowRateDelta: number;
  };
  rankings: {
    closer: PerformanceExportRankingEntry[];
    sdr: PerformanceExportRankingEntry[];
  };
}

export interface ExportFilePayload {
  fileName: string;
  content: string | ArrayBuffer;
  contentType: string;
}

interface KpiRow {
  Indicador: string;
  Valor: number | string;
  Unidade: string;
}

interface CloserRankingRow {
  "Posição": number | string;
  Nome: string;
  Vendas: number;
  Receita: string;
  "Reuniões realizadas": number;
  "No-shows": number;
  "Taxa de presença": string;
}

interface SdrRankingRow {
  "Posição": number | string;
  Nome: string;
  Agendamentos: number;
  "Reuniões realizadas": number;
  "No-shows": number;
  "Taxa de presença": string;
}

interface ComparisonRow {
  Indicador: string;
  "Variação %": string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function calcAttendanceRate(meetingsHeld: number, noShowCount: number): number {
  const denominator = meetingsHeld + noShowCount;
  if (denominator <= 0) return 0;
  return (meetingsHeld / denominator) * 100;
}

function toPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function normalizeExportSections(
  sections?: Partial<PerformanceExportSectionFlags> | null
): PerformanceExportSectionFlags {
  return {
    kpis: sections?.kpis ?? DEFAULT_PERFORMANCE_EXPORT_SECTIONS.kpis,
    rankingClosers: sections?.rankingClosers ?? DEFAULT_PERFORMANCE_EXPORT_SECTIONS.rankingClosers,
    rankingSdrs: sections?.rankingSdrs ?? DEFAULT_PERFORMANCE_EXPORT_SECTIONS.rankingSdrs,
    comparison: sections?.comparison ?? DEFAULT_PERFORMANCE_EXPORT_SECTIONS.comparison,
  };
}

export function buildKpiRows(data: PerformanceExportData): KpiRow[] {
  return [
    { Indicador: "Vendas fechadas", Valor: data.kpis.closedSales, Unidade: "vendas" },
    { Indicador: "Reuniões realizadas", Valor: data.kpis.meetingsHeld, Unidade: "reuniões" },
    { Indicador: "Agendamentos", Valor: data.kpis.scheduledLeads, Unidade: "agendamentos" },
    { Indicador: "Taxa de no-show", Valor: data.kpis.noShowRate.toFixed(1), Unidade: "%" },
    { Indicador: "No-shows", Valor: data.kpis.noShowCount, Unidade: "reuniões perdidas" },
  ];
}

export function buildCloserRankingRows(data: PerformanceExportData): CloserRankingRow[] {
  const rows: CloserRankingRow[] = data.rankings.closer.map((entry, index) => ({
    "Posição": index + 1,
    Nome: entry.name,
    Vendas: entry.count,
    Receita: formatCurrency(entry.totalSalesValue),
    "Reuniões realizadas": entry.meetingsHeld,
    "No-shows": entry.noShowCount,
    "Taxa de presença": toPercent(entry.attendanceRate),
  }));

  const totalSales = data.rankings.closer.reduce((acc, item) => acc + item.count, 0);
  const totalRevenue = data.rankings.closer.reduce((acc, item) => acc + item.totalSalesValue, 0);
  const totalMeetings = data.rankings.closer.reduce((acc, item) => acc + item.meetingsHeld, 0);
  const totalNoShows = data.rankings.closer.reduce((acc, item) => acc + item.noShowCount, 0);

  rows.push({
    "Posição": "",
    Nome: "TOTAL",
    Vendas: totalSales,
    Receita: formatCurrency(totalRevenue),
    "Reuniões realizadas": totalMeetings,
    "No-shows": totalNoShows,
    "Taxa de presença": toPercent(calcAttendanceRate(totalMeetings, totalNoShows)),
  });

  return rows;
}

export function buildSdrRankingRows(data: PerformanceExportData): SdrRankingRow[] {
  const rows: SdrRankingRow[] = data.rankings.sdr.map((entry, index) => ({
    "Posição": index + 1,
    Nome: entry.name,
    Agendamentos: entry.count,
    "Reuniões realizadas": entry.meetingsHeld,
    "No-shows": entry.noShowCount,
    "Taxa de presença": toPercent(entry.attendanceRate),
  }));

  const totalScheduled = data.rankings.sdr.reduce((acc, item) => acc + item.count, 0);
  const totalMeetings = data.rankings.sdr.reduce((acc, item) => acc + item.meetingsHeld, 0);
  const totalNoShows = data.rankings.sdr.reduce((acc, item) => acc + item.noShowCount, 0);

  rows.push({
    "Posição": "",
    Nome: "TOTAL",
    Agendamentos: totalScheduled,
    "Reuniões realizadas": totalMeetings,
    "No-shows": totalNoShows,
    "Taxa de presença": toPercent(calcAttendanceRate(totalMeetings, totalNoShows)),
  });

  return rows;
}

export function buildComparisonRows(data: PerformanceExportData): ComparisonRow[] {
  return [
    { Indicador: "Vendas fechadas", "Variação %": toPercent(data.kpis.closedSalesDelta) },
    { Indicador: "Reuniões realizadas", "Variação %": toPercent(data.kpis.meetingsHeldDelta) },
    { Indicador: "Agendamentos", "Variação %": toPercent(data.kpis.scheduledLeadsDelta) },
    { Indicador: "Taxa de no-show", "Variação %": toPercent(data.kpis.noShowRateDelta) },
  ];
}

export function buildCsvFiles(
  data: PerformanceExportData,
  sections: PerformanceExportSectionFlags
): ExportFilePayload[] {
  const files: ExportFilePayload[] = [];

  if (sections.kpis) {
    files.push({
      fileName: "kpi.csv",
      content: `\uFEFF${Papa.unparse(buildKpiRows(data))}`,
      contentType: "text/csv;charset=utf-8",
    });
  }

  if (sections.rankingClosers) {
    files.push({
      fileName: "ranking-closers.csv",
      content: `\uFEFF${Papa.unparse(buildCloserRankingRows(data))}`,
      contentType: "text/csv;charset=utf-8",
    });
  }

  if (sections.rankingSdrs) {
    files.push({
      fileName: "ranking-sdrs.csv",
      content: `\uFEFF${Papa.unparse(buildSdrRankingRows(data))}`,
      contentType: "text/csv;charset=utf-8",
    });
  }

  if (sections.comparison) {
    files.push({
      fileName: "comparativo-periodo-anterior.csv",
      content: `\uFEFF${Papa.unparse(buildComparisonRows(data))}`,
      contentType: "text/csv;charset=utf-8",
    });
  }

  return files;
}

export function buildExcelFile(
  data: PerformanceExportData,
  sections: PerformanceExportSectionFlags
): ExportFilePayload {
  const workbook = XLSX.utils.book_new();

  if (sections.kpis) {
    const kpiSheet = XLSX.utils.json_to_sheet(buildKpiRows(data));
    XLSX.utils.book_append_sheet(workbook, kpiSheet, "KPI");
  }

  if (sections.rankingClosers) {
    const closerSheet = XLSX.utils.json_to_sheet(buildCloserRankingRows(data));
    XLSX.utils.book_append_sheet(workbook, closerSheet, "Ranking Closers");
  }

  if (sections.rankingSdrs) {
    const sdrSheet = XLSX.utils.json_to_sheet(buildSdrRankingRows(data));
    XLSX.utils.book_append_sheet(workbook, sdrSheet, "Ranking SDRs");
  }

  if (sections.comparison) {
    const comparisonSheet = XLSX.utils.json_to_sheet(buildComparisonRows(data));
    XLSX.utils.book_append_sheet(workbook, comparisonSheet, "Comparativo");
  }

  const excelArray = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;

  return {
    fileName: "performance.xlsx",
    content: excelArray,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}

export async function buildZipBufferFromFiles(files: ExportFilePayload[]): Promise<ArrayBuffer> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.fileName, file.content);
  }

  return zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}
