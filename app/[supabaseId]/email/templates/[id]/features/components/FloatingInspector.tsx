'use client'

import type { ReactNode } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Braces,
  FileText,
  Grid2x2,
  Palette,
  Pin,
  PinOff,
  Square,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  BorderSide,
  BorderStyleKind,
  BorderValues,
  BoxRadius,
  BoxSpacing,
  MailyPageStyle,
  PageStyleBodyAlign,
} from '../utils/emailPageStyle'

function clampNonNegativeInt(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

function ControlLabel({ children }: { children: string }) {
  return <p className="text-[12px] text-white/72">{children}</p>
}

function modeButtonClass(active: boolean) {
  return cn(
    'inline-flex h-8 w-8 items-center justify-center rounded-xl border text-white/70 transition-colors',
    active
      ? 'border-[#40495a] bg-[#2b3140] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
      : 'border-[#232833] bg-[#111117] hover:border-[#303746] hover:bg-[#171a21] hover:text-white'
  )
}

function RowInputShell({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-1">{children}</div>
}

function NumberUnitInput({
  value,
  onChange,
  unit = 'px',
}: {
  value: number
  onChange: (next: number) => void
  unit?: string
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center rounded-2xl border border-[#232833] bg-[#111117]">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(clampNonNegativeInt(Number(event.target.value)))}
        className="h-8 min-w-0 flex-1 bg-transparent px-3 text-[12px] font-semibold text-white outline-none"
      />
      <span className="pr-3 text-[11px] text-white/45">{unit}</span>
    </div>
  )
}

function NumberSelectInput({
  value,
  onChange,
  unit = 'px',
}: {
  value: number
  onChange: (next: number) => void
  unit?: string
}) {
  return (
    <RowInputShell>
      <div className="flex min-w-0 flex-1 items-center rounded-2xl border border-[#232833] bg-[#111117]">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(event) => onChange(clampNonNegativeInt(Number(event.target.value)))}
          className="h-8 min-w-0 flex-1 bg-transparent px-3 text-[12px] font-semibold text-white outline-none"
        />
      </div>
      <div className="flex h-8 min-w-[72px] items-center rounded-2xl border border-[#232833] bg-[#111117] px-2">
        <span className="text-[12px] font-medium text-white/88">{unit}</span>
      </div>
    </RowInputShell>
  )
}

function TextUnitInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
}) {
  return (
    <RowInputShell>
      <div className="flex min-w-0 flex-1 items-center rounded-2xl border border-[#232833] bg-[#111117]">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-8 min-w-0 flex-1 bg-transparent px-3 text-[12px] font-semibold text-white outline-none placeholder:text-white/30"
        />
      </div>
      <div className="flex h-8 min-w-[72px] items-center rounded-2xl border border-[#232833] bg-[#111117] px-2">
        <span className="text-[12px] font-medium text-white/88">px</span>
      </div>
    </RowInputShell>
  )
}

function BorderStyleSelect({
  value,
  onChange,
}: {
  value: BorderStyleKind
  onChange: (next: BorderStyleKind) => void
}) {
  return (
    <div className="flex h-8 min-w-[92px] items-center rounded-2xl border border-[#232833] bg-[#111117] px-2">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as BorderStyleKind)}
        className="w-full appearance-none bg-transparent text-[12px] font-medium text-white outline-none"
      >
        <option value="solid">Solid</option>
        <option value="dashed">Dashed</option>
        <option value="dotted">Dotted</option>
      </select>
    </div>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (next: string) => void
}) {
  const safeColorValue = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value) ? value : '#000000'

  return (
    <div className="space-y-1.5">
      <ControlLabel>{label}</ControlLabel>
      <div className="flex items-center gap-2 rounded-2xl border border-[#232833] bg-[#111117] px-2 py-1">
        <input
          type="color"
          value={safeColorValue}
          onChange={(event) => onChange(event.target.value)}
          className="h-5 w-5 cursor-pointer rounded-md border border-white/20 bg-transparent p-0"
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-6 min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-white outline-none placeholder:text-white/35"
          placeholder="#ffffff"
        />
      </div>
    </div>
  )
}

function ModeButtons({
  uniformActive,
  detailedActive,
  onUniform,
  onDetailed,
}: {
  uniformActive: boolean
  detailedActive: boolean
  onUniform: () => void
  onDetailed: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={onUniform} className={modeButtonClass(uniformActive)} title="Uniform">
        <Square className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={onDetailed} className={modeButtonClass(detailedActive)} title="Per side">
        <Grid2x2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function SideSpacingGrid({
  value,
  onChange,
}: {
  value: BoxSpacing
  onChange: (next: BoxSpacing) => void
}) {
  const items: Array<{ key: keyof BoxSpacing; label: string }> = [
    { key: 'top', label: 'Top' },
    { key: 'right', label: 'Right' },
    { key: 'bottom', label: 'Bottom' },
    { key: 'left', label: 'Left' },
  ]

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div key={item.key} className="space-y-1">
          <p className="text-[11px] text-white/42">{item.label}</p>
          <NumberUnitInput
            value={value[item.key]}
            onChange={(next) => onChange({ ...value, [item.key]: next })}
          />
        </div>
      ))}
    </div>
  )
}

function RadiusGrid({
  value,
  onChange,
}: {
  value: BoxRadius
  onChange: (next: BoxRadius) => void
}) {
  const items: Array<{ key: keyof BoxRadius; label: string }> = [
    { key: 'topLeft', label: 'Top left' },
    { key: 'topRight', label: 'Top right' },
    { key: 'bottomRight', label: 'Bottom right' },
    { key: 'bottomLeft', label: 'Bottom left' },
  ]

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div key={item.key} className="space-y-1">
          <p className="text-[11px] text-white/42">{item.label}</p>
          <NumberUnitInput
            value={value[item.key]}
            onChange={(next) => onChange({ ...value, [item.key]: next })}
          />
        </div>
      ))}
    </div>
  )
}

function BorderSideEditor({
  label,
  value,
  onChange,
}: {
  label: string
  value: BorderSide
  onChange: (next: BorderSide) => void
}) {
  const safeColorValue = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.color) ? value.color : '#000000'

  return (
    <div className="space-y-1">
      <p className="text-[11px] text-white/42">{label}</p>
      <div className="flex items-center gap-1">
        <NumberUnitInput value={value.width} onChange={(width) => onChange({ ...value, width })} />
        <BorderStyleSelect value={value.style} onChange={(style) => onChange({ ...value, style })} />
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-[#232833] bg-[#111117] px-2 py-1">
          <input
            type="color"
            value={safeColorValue}
            onChange={(event) => onChange({ ...value, color: event.target.value })}
            className="h-5 w-5 cursor-pointer rounded-md border border-white/20 bg-transparent p-0"
          />
          <input
            type="text"
            value={value.color}
            onChange={(event) => onChange({ ...value, color: event.target.value })}
            className="h-6 min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-white outline-none"
          />
        </div>
      </div>
    </div>
  )
}

interface FloatingInspectorProps {
  open: boolean
  pinned: boolean
  pageStyle: MailyPageStyle
  onPinToggle: () => void
  onPageStyleChange: (patch: Partial<MailyPageStyle>) => void
  onOpenTheme: () => void
  onOpenGlobalCss: () => void
  showPin?: boolean
  className?: string
}

export function FloatingInspector({
  open,
  pinned,
  pageStyle,
  onPinToggle,
  onPageStyleChange,
  onOpenTheme,
  onOpenGlobalCss,
  showPin = true,
  className,
}: FloatingInspectorProps) {
  if (!open) {
    return (
      <div className={cn('pointer-events-none flex h-full items-center justify-end', className)}>
        <div className="flex h-28 w-full items-center justify-end pr-1">
          <span className="h-16 w-1.5 rounded-full bg-[#c6c8cf] shadow-[0_10px_22px_rgba(0,0,0,0.18)]" />
        </div>
      </div>
    )
  }

  return (
    <aside
      className={cn(
        'flex min-h-0 flex-col border border-[#1c2027] bg-[#09090b]/98 shadow-[0_24px_56px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-[transform,opacity] duration-200 ease-out',
        'translate-x-0 opacity-100',
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-[#171b22] px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-[#232833] bg-[#111117] p-1 text-white/80">
            <FileText className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-[13px] font-semibold text-white">Page style</h3>
        </div>
        {showPin ? (
          <button
            type="button"
            onClick={onPinToggle}
            title={pinned ? 'Desfixar painel' : 'Fixar painel'}
            aria-label={pinned ? 'Desfixar painel' : 'Fixar painel'}
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-xl border text-white/75 transition-colors',
              pinned
                ? 'border-[#3a4250] bg-[#171a21] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_24px_rgba(0,0,0,0.28)]'
                : 'border-[#232833] bg-[#111117] hover:border-[#303746] hover:bg-[#171a21] hover:text-white'
            )}
          >
            {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
        ) : null}
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
        <section className="space-y-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">Background</h4>
          <ColorField
            label="Background"
            value={pageStyle.pageBackground}
            onChange={(pageBackground) => onPageStyleChange({ pageBackground })}
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <ControlLabel>Padding</ControlLabel>
              <ModeButtons
                uniformActive={pageStyle.pagePaddingMode === 'uniform'}
                detailedActive={pageStyle.pagePaddingMode === 'per-side'}
                onUniform={() => onPageStyleChange({ pagePaddingMode: 'uniform' })}
                onDetailed={() => onPageStyleChange({ pagePaddingMode: 'per-side' })}
              />
            </div>
            {pageStyle.pagePaddingMode === 'uniform' ? (
              <NumberUnitInput
                value={pageStyle.pagePadding.top}
                onChange={(next) => onPageStyleChange({ pagePadding: { top: next, right: next, bottom: next, left: next } })}
              />
            ) : (
              <SideSpacingGrid
                value={pageStyle.pagePadding}
                onChange={(pagePadding) => onPageStyleChange({ pagePadding })}
              />
            )}
          </div>
        </section>

        <section className="space-y-3 border-t border-[#171b22] pt-4">
          <h4 className="text-[24px] font-semibold leading-none text-white">Body</h4>

          <div className="inline-flex w-full items-center gap-1 rounded-2xl border border-[#232833] bg-[#111117] p-1">
            {([
              { key: 'left', icon: <AlignLeft className="h-3.5 w-3.5" /> },
              { key: 'center', icon: <AlignCenter className="h-3.5 w-3.5" /> },
              { key: 'right', icon: <AlignRight className="h-3.5 w-3.5" /> },
            ] as Array<{ key: PageStyleBodyAlign; icon: ReactNode }>).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => onPageStyleChange({ bodyAlign: option.key })}
                className={cn(
                  'flex h-8 flex-1 items-center justify-center rounded-xl text-white/60 transition-colors',
                  pageStyle.bodyAlign === option.key
                    ? 'border border-[#40495a] bg-[#2b3140] text-white'
                    : 'hover:bg-[#171a21] hover:text-white'
                )}
              >
                {option.icon}
              </button>
            ))}
          </div>

          <ColorField
            label="Text"
            value={pageStyle.bodyTextColor}
            onChange={(bodyTextColor) => onPageStyleChange({ bodyTextColor })}
          />
          <ColorField
            label="Background"
            value={pageStyle.bodyBackground}
            onChange={(bodyBackground) => onPageStyleChange({ bodyBackground })}
          />

          <div className="space-y-1.5">
            <ControlLabel>Width</ControlLabel>
            <NumberSelectInput value={pageStyle.bodyWidth} onChange={(bodyWidth) => onPageStyleChange({ bodyWidth })} />
          </div>

          <div className="space-y-1.5">
            <ControlLabel>Height</ControlLabel>
            <TextUnitInput
              value={pageStyle.bodyHeight}
              onChange={(bodyHeight) => onPageStyleChange({ bodyHeight })}
              placeholder="auto"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <ControlLabel>Padding</ControlLabel>
              <ModeButtons
                uniformActive={pageStyle.bodyPaddingMode === 'uniform'}
                detailedActive={pageStyle.bodyPaddingMode === 'per-side'}
                onUniform={() => onPageStyleChange({ bodyPaddingMode: 'uniform' })}
                onDetailed={() => onPageStyleChange({ bodyPaddingMode: 'per-side' })}
              />
            </div>
            {pageStyle.bodyPaddingMode === 'uniform' ? (
              <NumberUnitInput
                value={pageStyle.bodyPadding.top}
                onChange={(next) => onPageStyleChange({ bodyPadding: { top: next, right: next, bottom: next, left: next } })}
              />
            ) : (
              <SideSpacingGrid
                value={pageStyle.bodyPadding}
                onChange={(bodyPadding) => onPageStyleChange({ bodyPadding })}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <ControlLabel>Corner radius</ControlLabel>
              <ModeButtons
                uniformActive={pageStyle.bodyRadiusMode === 'uniform'}
                detailedActive={pageStyle.bodyRadiusMode === 'per-corner'}
                onUniform={() => onPageStyleChange({ bodyRadiusMode: 'uniform' })}
                onDetailed={() => onPageStyleChange({ bodyRadiusMode: 'per-corner' })}
              />
            </div>
            {pageStyle.bodyRadiusMode === 'uniform' ? (
              <NumberUnitInput
                value={pageStyle.bodyRadius.topLeft}
                onChange={(next) =>
                  onPageStyleChange({
                    bodyRadius: {
                      topLeft: next,
                      topRight: next,
                      bottomRight: next,
                      bottomLeft: next,
                    },
                  })
                }
              />
            ) : (
              <RadiusGrid
                value={pageStyle.bodyRadius}
                onChange={(bodyRadius) => onPageStyleChange({ bodyRadius })}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <ControlLabel>Border</ControlLabel>
              <ModeButtons
                uniformActive={pageStyle.bodyBorderMode === 'uniform'}
                detailedActive={pageStyle.bodyBorderMode === 'per-side'}
                onUniform={() => onPageStyleChange({ bodyBorderMode: 'uniform' })}
                onDetailed={() => onPageStyleChange({ bodyBorderMode: 'per-side' })}
              />
            </div>
            {pageStyle.bodyBorderMode === 'uniform' ? (
              <BorderSideEditor
                label="All sides"
                value={pageStyle.bodyBorder.top}
                onChange={(next) =>
                  onPageStyleChange({
                    bodyBorder: {
                      top: next,
                      right: next,
                      bottom: next,
                      left: next,
                    } as BorderValues,
                  })
                }
              />
            ) : (
              <div className="space-y-2">
                <BorderSideEditor
                  label="Top"
                  value={pageStyle.bodyBorder.top}
                  onChange={(top) =>
                    onPageStyleChange({ bodyBorder: { ...pageStyle.bodyBorder, top } })
                  }
                />
                <BorderSideEditor
                  label="Right"
                  value={pageStyle.bodyBorder.right}
                  onChange={(right) =>
                    onPageStyleChange({ bodyBorder: { ...pageStyle.bodyBorder, right } })
                  }
                />
                <BorderSideEditor
                  label="Bottom"
                  value={pageStyle.bodyBorder.bottom}
                  onChange={(bottom) =>
                    onPageStyleChange({ bodyBorder: { ...pageStyle.bodyBorder, bottom } })
                  }
                />
                <BorderSideEditor
                  label="Left"
                  value={pageStyle.bodyBorder.left}
                  onChange={(left) =>
                    onPageStyleChange({ bodyBorder: { ...pageStyle.bodyBorder, left } })
                  }
                />
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="space-y-2 border-t border-[#171b22] p-4">
        <button
          type="button"
          onClick={onOpenTheme}
          className="flex w-full items-center justify-between rounded-xl border border-[#232833] bg-[#111117] px-3 py-2 text-left text-[12px] font-semibold text-white/88 transition-colors hover:border-[#303746] hover:bg-[#171a21]"
        >
          <span>Edit theme</span>
          <Palette className="h-3.5 w-3.5 text-white/70" />
        </button>
        <button
          type="button"
          onClick={onOpenGlobalCss}
          className="flex w-full items-center justify-between rounded-xl border border-[#232833] bg-[#111117] px-3 py-2 text-left text-[12px] font-semibold text-white/88 transition-colors hover:border-[#303746] hover:bg-[#171a21]"
        >
          <span>Global CSS</span>
          <Braces className="h-3.5 w-3.5 text-white/70" />
        </button>
      </div>
    </aside>
  )
}
