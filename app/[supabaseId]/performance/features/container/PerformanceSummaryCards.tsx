'use client';

import { useMemo } from 'react';
import { CalendarCheck2, HandshakeIcon, TrendingUp, UserRoundX, ArrowUp, ArrowDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import React from 'react';
import { usePerformanceContext } from '../context/PerformanceContext';

interface KpiCardProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  suffix?: string;
  helper: string;
  delta?: number;
  deltaInverse?: boolean;
  sparkColor: string;
  sparkValues: number[];
  accent: 'primary' | 'info' | 'success' | 'warn';
  featured?: boolean;
}

// Sparkline component - exact copy from mockup
function Sparkline({ values, color = 'var(--primary)', height = 36, fill = true }: { values: number[]; color?: string; height?: number; fill?: boolean }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const W = 120;
  const H = height;
  const step = W / (values.length - 1);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(H - ((v - min) / range) * (H - 6) - 3).toFixed(1)}`).join(' ');
  const area = `0,${H} ${points} ${W},${H}`;
  
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={`grad-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <polyline points={area} fill={`url(#grad-${color.replace(/[^a-z0-9]/gi, '')})`} stroke="none" />}
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// Delta component - exact copy from mockup
function Delta({ value, inverse = false }: { value: number; inverse?: boolean }) {
  const positive = value >= 0;
  const isGood = inverse ? !positive : positive;
  const Icon = positive ? ArrowUp : ArrowDown;
  
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '2px',
      fontSize: '11px',
      fontWeight: '600',
      color: isGood ? 'var(--success)' : 'var(--danger)',
      fontVariantNumeric: 'tabular-nums',
      fontFeatureSettings: "'tnum'"
    }}>
      <Icon size={11} strokeWidth={2.5} className="" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

// KPI Card component - exact copy from mockup
function KpiCard({
  icon: Icon,
  label,
  value,
  suffix,
  helper,
  delta,
  deltaInverse,
  sparkColor,
  sparkValues,
  accent = 'primary',
  featured = false
}: KpiCardProps) {
  const accentMap = {
    primary: { glow: 'var(--primary)', icon: 'var(--primary)', bg: 'color-mix(in oklab, var(--primary) 14%, var(--card-2))' },
    info: { glow: 'var(--info)', icon: 'var(--info)', bg: 'color-mix(in oklab, var(--info) 14%, var(--card-2))' },
    success: { glow: 'var(--success)', icon: 'var(--success)', bg: 'color-mix(in oklab, var(--success) 14%, var(--card-2))' },
    warn: { glow: 'var(--warn)', icon: 'var(--warn)', bg: 'color-mix(in oklab, var(--warn) 14%, var(--card-2))' },
  }[accent];

  return (
    <div style={{
      position: 'relative',
      borderRadius: '0.65rem',
      border: featured ? 'color-mix(in oklab, var(--primary) 30%, var(--border))' : '1px solid var(--border)',
      backgroundColor: 'var(--card)',
      overflow: 'hidden'
    }}>
      {featured && (
        <div style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(120% 120% at 0% 100%, color-mix(in oklab, var(--primary) 24%, transparent) 0%, transparent 60%)',
          opacity: 0.6
        }} />
      )}

      {/* Header */}
      <div style={{
        position: 'relative',
        padding: '1.25rem',
        paddingBottom: '0.75rem',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '0.5rem',
            display: 'grid',
            placeItems: 'center',
            background: accentMap.bg,
            border: `1px solid color-mix(in oklab, ${accentMap.glow} 24%, transparent)`
          }}>
            <Icon size={15} className="" />
          </div>
          <div style={{ fontSize: '12.5px', fontWeight: '500', color: 'rgba(255,255,255,0.7)' }}>{label}</div>
        </div>
        {delta !== undefined && <Delta value={delta} inverse={deltaInverse} />}
      </div>

      {/* Value */}
      <div style={{
        position: 'relative',
        paddingLeft: '1.25rem',
        paddingRight: '1.25rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem' }}>
          <span style={{
            fontFamily: "'Poppins', system-ui, sans-serif",
            fontSize: '34px',
            lineHeight: '1',
            fontWeight: '700',
            letterSpacing: '-0.01em',
            fontVariantNumeric: 'tabular-nums',
            fontFeatureSettings: "'tnum'"
          }}>
            {value}
          </span>
          {suffix && <span style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.55)', fontWeight: '500', fontVariantNumeric: 'tabular-nums' }}>{suffix}</span>}
        </div>
        {helper && <div style={{ marginTop: '0.375rem', fontSize: '11.5px', color: 'rgba(255,255,255,0.45)' }}>{helper}</div>}
      </div>

      {/* Sparkline */}
      <div style={{
        position: 'relative',
        marginTop: '0.75rem',
        paddingLeft: '0.25rem',
        paddingBottom: '0.25rem'
      }}>
        <Sparkline values={sparkValues} color={accentMap.glow} />
      </div>
    </div>
  );
}

export function PerformanceSummaryCards() {
  const { data, isLoading } = usePerformanceContext();

  if (isLoading && !data) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1rem'
      }}>
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton key={idx} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  const kpis = data?.kpis;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '1rem'
    }}>
      <KpiCard
        icon={HandshakeIcon}
        label="Vendas fechadas"
        value={String(kpis?.closedSales ?? 0)}
        helper="No período selecionado"
        delta={8.2}
        accent="primary"
        featured={true}
        sparkColor="var(--primary)"
        sparkValues={kpis?.closedSalesSparkline?.map(s => s.value) || [3, 5, 4, 6, 8, 7, 9, 8, 11, 10, 12, 14]}
      />
      <KpiCard
        icon={CalendarCheck2}
        label="Reuniões realizadas"
        value={String(kpis?.meetingsHeld ?? 0)}
        helper="Leads com reunião marcada como realizada"
        delta={-1.5}
        accent="info"
        sparkColor="var(--info)"
        sparkValues={kpis?.meetingsHeldSparkline?.map(s => s.value) || [12, 14, 13, 16, 18, 17, 19, 21, 20, 22, 24, 26]}
      />
      <KpiCard
        icon={TrendingUp}
        label="Agendamentos realizados"
        value={String(kpis?.scheduledLeads ?? 0)}
        helper="Baseado em leads_schedule"
        delta={5.6}
        accent="success"
        sparkColor="var(--success)"
        sparkValues={kpis?.scheduledLeadsSparkline?.map(s => s.value) || [10, 12, 15, 14, 17, 16, 19, 21, 20, 23, 22, 25]}
      />
      <KpiCard
        icon={UserRoundX}
        label="Taxa de no-show"
        value={`${(kpis?.noShowRate ?? 0).toFixed(1)}`}
        suffix="%"
        helper={`${kpis?.noShowCount ?? 0} leads em no-show`}
        delta={-3.1}
        deltaInverse={true}
        accent="warn"
        sparkColor="var(--warn)"
        sparkValues={kpis?.noShowRateSparkline?.map(s => s.value) || [22, 21, 20, 19, 21, 18, 17, 18, 16, 15, 16, 15]}
      />
    </div>
  );
}
