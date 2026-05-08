'use client';

import { useMemo, useState } from 'react';
import { Award, Download, X, Crown } from 'lucide-react';
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

// PerfBar component - exact copy from mockup
function PerfBar({ pct, color = 'var(--primary)' }: { pct: number; color?: string }) {
  return (
    <div style={{
      height: '6px',
      width: '100%',
      borderRadius: '9999px',
      backgroundColor: 'rgba(255,255,255,0.06)',
      overflow: 'hidden'
    }}>
      <div style={{
        height: '100%',
        borderRadius: '9999px',
        width: `${Math.min(100, pct)}%`,
        background: color
      }} />
    </div>
  );
}

// MedalBadge component - exact copy from mockup
function MedalBadge({ rank }: { rank: number }) {
  if (rank > 3) {
    return <span style={{
      fontSize: '12px',
      color: 'rgba(255,255,255,0.45)',
      fontVariantNumeric: 'tabular-nums',
      width: '24px',
      textAlign: 'center'
    }}>{rank}</span>;
  }
  
  const colors = {
    1: { bg: 'linear-gradient(135deg,#FFD56B,#FF8A00)', ring: 'rgba(255,180,60,0.35)' },
    2: { bg: 'linear-gradient(135deg,#E5E5E5,#A0A0A0)', ring: 'rgba(220,220,220,0.25)' },
    3: { bg: 'linear-gradient(135deg,#E08A55,#8A4A22)', ring: 'rgba(220,140,80,0.3)' }
  }[rank as 1 | 2 | 3];
  
  return (
    <div style={{
      width: '24px',
      height: '24px',
      borderRadius: '9999px',
      display: 'grid',
      placeItems: 'center',
      fontSize: '10.5px',
      fontWeight: '700',
      color: 'rgba(0,0,0,0.8)',
      background: colors.bg,
      boxShadow: `0 0 0 3px ${colors.ring}`
    }}>
      {rank}
    </div>
  );
}

// RankRow component - exact copy from mockup
function RankRow({
  rank,
  name,
  role,
  value,
  suffix,
  secondary,
  pct,
  color,
  onClick
}: {
  rank: number;
  name: string;
  role?: string;
  value: string | number;
  suffix?: string;
  secondary?: string;
  pct: number;
  color: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'grid',
        gridTemplateColumns: '28px 1fr auto',
        alignItems: 'center',
        gap: '12px',
        paddingTop: '10px',
        paddingBottom: '10px',
        paddingLeft: '12px',
        paddingRight: '12px',
        borderRadius: '0.5rem',
        cursor: 'pointer',
        border: 'none',
        background: 'transparent',
        transition: 'background-color 0.2s'
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.035)'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      <MedalBadge rank={rank} />
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        minWidth: 0
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '9999px',
          display: 'grid',
          placeItems: 'center',
          fontSize: '11px',
          fontWeight: '600',
          color: 'white',
          flexShrink: 0,
          background: 'linear-gradient(135deg,#ff6900,#cd6cdd)'
        }}>
          {name.split(' ').map(s => s[0]).slice(0, 2).join('')}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: '13px',
            fontWeight: '500',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {name}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '2px'
          }}>
            {role && <span style={{
              fontSize: '10.5px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: '600',
              color: 'rgba(255,255,255,0.55)'
            }}>{role}</span>}
            {secondary && <span style={{
              fontSize: '10.5px',
              color: 'rgba(255,255,255,0.4)'
            }}>{role ? `· ${secondary}` : secondary}</span>}
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{
          fontFamily: "'Poppins', system-ui, sans-serif",
          fontSize: '18px',
          fontWeight: '700',
          lineHeight: '1',
          fontVariantNumeric: 'tabular-nums'
        }}>
          {value}{suffix && <span style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.5)',
            fontWeight: '500',
            marginLeft: '2px'
          }}>{suffix}</span>}
        </div>
        <div style={{
          marginTop: '6px',
          width: '120px',
          marginLeft: 'auto'
        }}>
          <PerfBar pct={pct} color={color} />
        </div>
      </div>
    </button>
  );
}

// RankingCard component
function RankingCard({
  title,
  subtitle,
  entries,
  roleLabel,
  barColor,
  onOpen,
}: {
  title: string;
  subtitle: string;
  entries: PerformanceRankingEntry[];
  roleLabel: 'Closer' | 'SDR';
  barColor: string;
  onOpen: (profileId: string, roleLabel: 'Closer' | 'SDR') => void;
}) {
  const maxValue = useMemo(() => Math.max(...entries.map((entry) => entry.count), 0), [entries]);

  return (
    <div style={{
      borderRadius: '0.65rem',
      border: '1px solid var(--border)',
      backgroundColor: 'var(--card)',
      overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: '1rem',
        paddingRight: '1rem',
        paddingTop: '1rem',
        paddingBottom: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            padding: '8px',
            borderRadius: '0.5rem',
            backgroundColor: `color-mix(in srgb, ${barColor} 15%, transparent)`
          }}>
            <Award size={16} style={{ color: barColor }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <p style={{ fontSize: '18px', fontWeight: '700', lineHeight: '1' }}>{title}</p>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>{subtitle}</p>
          </div>
        </div>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4" />
          Exportar
        </Button>
      </div>
      <Separator />
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        paddingLeft: '12px',
        paddingRight: '12px',
        paddingTop: '12px',
        paddingBottom: '12px'
      }}>
        {entries.length === 0 ? (
          <div style={{
            padding: '24px',
            fontSize: '14px',
            color: 'rgba(255,255,255,0.55)',
            textAlign: 'center'
          }}>
            Sem dados no período.
          </div>
        ) : (
          entries.map((entry, index) => (
            <RankRow
              key={entry.profileId}
              rank={index + 1}
              name={entry.name}
              role={roleLabel}
              value={entry.count}
              suffix={roleLabel === 'Closer' ? 'vendas' : 'agend.'}
              secondary={`${entry.meetingsHeld} reuniões · ${entry.attendanceRate.toFixed(1)}% presença`}
              pct={(entry.count / maxValue) * 100}
              color={barColor}
              onClick={() => onOpen(entry.profileId, roleLabel)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// DrilldownDialog component (simplified)
function DrilldownDialog({
  selected,
  onClose,
}: {
  selected: PerformanceDrilldownEntry | null;
  onClose: () => void;
}) {
  if (!selected) return null;

  return (
    <Dialog open={!!selected} onOpenChange={onClose}>
      <DialogContent>
        {selected ? (
          <>
            <DialogHeader>
              <DialogTitle>{selected.name || 'Perfil'}</DialogTitle>
              <DialogDescription>{selected.roleLabel}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Vendas</p>
                <p className="text-xl font-semibold">0</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Reuniões</p>
                <p className="text-xl font-semibold">{selected.meetingsHeld || 0}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">No-show</p>
                <p className="text-xl font-semibold">{selected.noShowRate.toFixed(1)}%</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Presença</p>
                <p className="text-xl font-semibold">{selected.attendanceRate.toFixed(1)}%</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Receita atribuída</p>
                <p className="text-xl font-semibold">
                  {selected.totalSalesValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
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
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '24px'
      }}>
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '24px'
      }}>
        <RankingCard
          title="Ranking de Closers"
          subtitle="Por vendas fechadas"
          roleLabel="Closer"
          barColor="var(--primary)"
          entries={data?.rankings.closer ?? []}
          onOpen={handleOpen}
        />
        <RankingCard
          title="Ranking de SDRs"
          subtitle="Por agendamentos realizados"
          roleLabel="SDR"
          barColor="var(--info)"
          entries={data?.rankings.sdr ?? []}
          onOpen={handleOpen}
        />
      </div>
      <DrilldownDialog selected={selected} onClose={() => setSelected(null)} />
    </>
  );
}
