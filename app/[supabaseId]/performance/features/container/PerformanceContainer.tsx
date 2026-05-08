"use client";

import { usePerformanceContext } from '../context/PerformanceContext';
import { useState } from 'react';
import { PerfFiltersBar } from './Components/PerfFiltersBar';
import { PerfKpis } from './Components/PerfKpis';
import { PerfTopHighlights } from './Components/PerfTopHighlights';
import { PerfRankings } from './Components/PerfRankings';
import { Button } from '@/components/ui/button';
import { Download, Plus } from 'lucide-react';

export function PerformanceContainer() {
  const { data, error } = usePerformanceContext();
    const [preset, setPreset] = useState("7d")
    const [sdrPicks, setSdrPicks] = useState([])
    const [closerPicks, setCloserPicks] = useState(["Ana Souza"])
    const [datePick, setDatePick] = useState("")

    const periodLabel =
      {
        "1d": "ultimas 24h",
        "7d": "ultimos 7 dias",
        "15d": "ultimos 15 dias",
        "1m": "ultimo mes",
        "3m": "ultimos 3 meses",
      }[preset] || "ultimos 7 dias"

  return (
    // Compoenentes Errados e com visual desconfigurado, apenas para exemplificar a estrutura da página
    // <div className="flex flex-col gap-8 p-6">
    //   {/* Header Section */}
    //   <div className="flex flex-col gap-6">
    //     {/* Section 1: Title + Subtitle */}
    //     <div className="flex flex-col gap-2">
    //       <h1 className="text-4xl md:text-5xl font-bold font-[Poppins] leading-tight">
    //         Performance
    //       </h1>
    //       <p className="text-base text-muted-foreground">
    //         Indicadores comerciais e ranking de SDRs e Closers — últimos 7 dias
    //       </p>
    //     </div>

    //     {/* Section 2: Badge + Action Buttons */}
    //     <div className="flex items-center justify-between gap-4">
    //       <Badge variant="outline" className="w-fit">
    //         Última atualização: há 2 min
    //       </Badge>
    //       <div className="flex gap-2">
    //         <Button variant="outline" size="sm">
    //           <Download className="w-4 h-4" />
    //           Exportar relatório
    //         </Button>
    //         <Button size="sm">
    //           <Plus className="w-4 h-4" />
    //           Nova meta
    //         </Button>
    //       </div>
    //     </div>
    //   </div>

    //   {/* Filters */}
    //   <PerformanceFiltersBar />

    //   {/* Error Alert */}
    //   {error && (
    //     <Alert variant="destructive">
    //       <AlertCircle className="h-4 w-4" />
    //       <AlertDescription>{error}</AlertDescription>
    //     </Alert>
    //   )}

    //   {/* KPI Summary Cards */}
    //   <PerformanceSummaryCards />

    //   {/* Top Highlights */}
    //   <PerformanceTopHighlights />

    //   {/* Rankings */}
    //   <PerformanceRankings />

    //   {/* Table */}
    //   <PerformanceTable />
    // </div>

    <div className="flex-1 min-w-0 flex flex-col">
      <div className="bg-grid">
        <div className="px-6 py-6 max-w-370 mx-auto w-full flex flex-col gap-6">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="font-display text-[26px] font-bold leading-none tracking-tight">
                  Performance
                </h1>
                <p className="text-[12.5px] text-white/55 mt-1.5">
                  Indicadores comerciais e ranking de SDRs e Closers —{" "}
                  <span className="text-white/80">{periodLabel}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-[11px] text-white/45 px-2.5 py-1 rounded-md border border-border bg-(--card)/40">
                Ultima atualizacao: <span className="text-white/75 num">ha 2 min</span>
              </div>
              <Button className="h-9 px-3 inline-flex items-center gap-1.5 text-[12.5px] rounded-md border border-border hover:bg-white/4 text-white/85">
                <Download size={13} /> Exportar relatorio
              </Button>
              <Button className="h-9 px-3 inline-flex items-center gap-1.5 text-[12.5px] rounded-md bg-primary text-primary-foreground font-semibold shadow-[0_6px_18px_-8px_rgba(245,73,0,0.55)] hover:brightness-110">
                <Plus size={14} strokeWidth={2.5} /> Nova meta
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/40 px-3 py-3">
            <PerfFiltersBar
              preset={preset}
              setPreset={setPreset}
              sdrPicks={sdrPicks}
              closerPicks={closerPicks}
              datePick={datePick}
              presets={["1d", "7d", "15d", "1m", "3m"]}
              onClearAll={() => {
                setPreset("7d")
                setSdrPicks([])
                setCloserPicks([])
                setDatePick("")
              }}
            />
          </div>
          <PerfKpis />
          <PerfTopHighlights />
          <PerfRankings />
          <div className="pb-6 pt-2 text-center text-[11px] text-white/35">
            Dados sincronizados com CRM · Apenas vendas e reunioes marcadas como realizadas no
            periodo selecionado
          </div>
        </div>
      </div>
    </div>
  )
}
