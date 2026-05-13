import Papa from 'papaparse';
import type { PerformanceData } from '../context/PerformanceTypes';

export interface ExportSectionFlags {
  kpis: boolean;
  rankings: boolean;
  funnelPessoal: boolean;
  activities: boolean;
  comparison: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function exportPerformanceCsv(
  data: PerformanceData,
  sections: ExportSectionFlags,
  fileName: string
): void {
  const parts: string[] = [];

  if (sections.kpis) {
    const kpiRows = [
      { Indicador: 'Vendas fechadas', Valor: data.kpis.closedSales, Unidade: 'vendas' },
      { Indicador: 'Reuniões realizadas', Valor: data.kpis.meetingsHeld, Unidade: 'reuniões' },
      { Indicador: 'Agendamentos', Valor: data.kpis.scheduledLeads, Unidade: 'agendamentos' },
      { Indicador: 'Taxa de no-show', Valor: data.kpis.noShowRate.toFixed(1), Unidade: '%' },
      { Indicador: 'No-shows', Valor: data.kpis.noShowCount, Unidade: 'reuniões perdidas' },
    ];
    parts.push('## KPIs Principais');
    parts.push(Papa.unparse(kpiRows));
    parts.push('');
  }

  if (sections.rankings) {
    if (data.rankings.closer.length > 0) {
      const closerRows = data.rankings.closer.map((r, i) => ({
        Posição: i + 1,
        Nome: r.name,
        Vendas: r.count,
        Receita: formatCurrency(r.totalSalesValue),
        'Reuniões realizadas': r.meetingsHeld,
        'No-shows': r.noShowCount,
        'Taxa de presença': `${r.attendanceRate.toFixed(0)}%`,
      }));
      parts.push('## Ranking de Closers');
      parts.push(Papa.unparse(closerRows));
      parts.push('');
    }

    if (data.rankings.sdr.length > 0) {
      const sdrRows = data.rankings.sdr.map((r, i) => ({
        Posição: i + 1,
        Nome: r.name,
        Agendamentos: r.count,
        'Reuniões realizadas': r.meetingsHeld,
        'No-shows': r.noShowCount,
        'Taxa de presença': `${r.attendanceRate.toFixed(0)}%`,
      }));
      parts.push('## Ranking de SDRs');
      parts.push(Papa.unparse(sdrRows));
      parts.push('');
    }
  }

  const csv = parts.join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
