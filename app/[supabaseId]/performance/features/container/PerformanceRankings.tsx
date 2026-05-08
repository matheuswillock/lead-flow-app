"use client";

import { useMemo, useState } from 'react';
import { Award, Download, X } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { usePerformanceContext } from '../context/PerformanceContext';
import type {
  PerformanceDrilldownEntry,
  PerformanceRankingEntry,
} from '../context/PerformanceTypes';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getMedalColor(position: number): { bg: string; text: string } {
  switch (position) {
    case 0:
      return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400' };
    case 1:
      return { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' };
    case 2:
      return { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400' };
    default:
      return { bg: 'bg-muted', text: 'text-muted-foreground' };
  }
}

function RankingRow({
  index,
  maxValue,
  entry,
  suffix,
  roleLabel,
  barColor,
  onOpen,
}: {
  index: number;
  maxValue: number;
  entry: PerformanceRankingEntry;
  suffix: 'vendas' | 'agend.';
  roleLabel: 'Closer' | 'SDR';
  barColor: string;
  onOpen: (profileId: string, roleLabel: 'Closer' | 'SDR') => void;
}) {
  const progress = maxValue > 0 ? (entry.count / maxValue) * 100 : 0;
  const medalColor = getMedalColor(index);

  return (
    <button
      type="button"
      onClick={() => onOpen(entry.profileId, roleLabel)}
      className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-3 hover:border-border hover:bg-muted/30 transition-colors w-full"
    >
      {/* Medal Position */}
      <div className={`flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm ${medalColor.bg} ${medalColor.text}`}>
        {index + 1}
      </div>

      {/* Avatar */}
      <Avatar className="h-9 w-9 flex-shrink-0 border border-border">
        <AvatarFallback className="text-xs font-semibold">{initials(entry.name)}</AvatarFallback>
      </Avatar>

      {/* Name and Details */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <p className="truncate text-sm font-semibold">{entry.name}</p>
        <p className="text-xs text-muted-foreground">
          {entry.meetingsHeld} reuniões · {entry.attendanceRate.toFixed(1)}% presença
        </p>
      </div>

      {/* Value and Progress Bar */}
      <div className="flex w-48 flex-col items-end gap-1.5">
        <p className="text-2xl font-bold leading-none">
          {entry.count}
          <span className="ml-1 text-xs text-muted-foreground font-normal">{suffix}</span>
        </p>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, backgroundColor: barColor }}
          />
        </div>
      </div>
    </button>
  );
}

function RankingCard({
  title,
  subtitle,
  suffix,
  entries,
  roleLabel,
  barColor,
  onOpen,
}: {
  title: string;
  subtitle: string;
  suffix: 'vendas' | 'agend.';
  entries: PerformanceRankingEntry[];
  roleLabel: 'Closer' | 'SDR';
  barColor: string;
  onOpen: (profileId: string, roleLabel: 'Closer' | 'SDR') => void;
}) {
  const maxValue = useMemo(() => Math.max(...entries.map((entry) => entry.count), 0), [entries]);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `color-mix(in srgb, ${barColor} 15%, transparent)` }}>
            <Award className="w-4 h-4" style={{ color: barColor }} />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-lg font-bold leading-none">{title}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4" />
          Exportar
        </Button>
      </div>
      <Separator />
      <div className="flex flex-col gap-2 p-3">
        {entries.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">Sem dados no período.</div>
        ) : (
          entries.map((entry, index) => (
            <RankingRow
              key={`${roleLabel}:${entry.profileId}`}
              index={index}
              maxValue={maxValue}
              entry={entry}
              suffix={suffix}
              roleLabel={roleLabel}
              barColor={barColor}
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DrilldownDialog({
  selected,
  onClose,
}: {
  selected: PerformanceDrilldownEntry | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!selected} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] flex flex-col">
        {selected ? (
          <>
            <DialogHeader>
              <DialogTitle>{selected.name}</DialogTitle>
              <DialogDescription>{selected.email || 'Sem e-mail informado'}</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col gap-3 py-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Função</p>
                    <p className="text-xl font-semibold">{selected.roleLabel}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Vendas</p>
                    <p className="text-xl font-semibold">{selected.salesCount}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Agendamentos</p>
                    <p className="text-xl font-semibold">{selected.scheduledLeads}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Reuniões realizadas</p>
                    <p className="text-xl font-semibold">{selected.meetingsHeld}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">No-show</p>
                    <p className="text-xl font-semibold">{selected.noShowRate.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Presença</p>
                    <p className="text-xl font-semibold">{selected.attendanceRate.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Receita atribuída</p>
                  <p className="text-xl font-semibold">
                    {selected.totalSalesValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                <X className="w-4 h-4" />
                Fechar
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function PerformanceRankings() {
  const { data, isLoading } = usePerformanceContext();
  const [selected, setSelected] = useState<PerformanceDrilldownEntry | null>(null);

  const drilldownByProfile = useMemo(() => {
    const map = new Map<string, PerformanceDrilldownEntry>();
    (data?.drilldown ?? []).forEach((item) => map.set(`${item.roleLabel}:${item.profileId}`, item));
    return map;
  }, [data]);

  const handleOpen = (profileId: string, roleLabel: 'Closer' | 'SDR') => {
    const item = drilldownByProfile.get(`${roleLabel}:${profileId}`) ?? null;
    setSelected(item);
  };

  if (isLoading && !data) {
    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <RankingCard
          title="Ranking de Closers"
          subtitle="Por vendas fechadas"
          suffix="vendas"
          roleLabel="Closer"
          barColor="var(--primary)"
          entries={data?.rankings.closer ?? []}
          onOpen={handleOpen}
        />
        <RankingCard
          title="Ranking de SDRs"
          subtitle="Por agendamentos realizados"
          suffix="agend."
          roleLabel="SDR"
          barColor="var(--semantic-info)"
          entries={data?.rankings.sdr ?? []}
          onOpen={handleOpen}
        />
      </div>
      <DrilldownDialog selected={selected} onClose={() => setSelected(null)} />
    </>
  );
}
