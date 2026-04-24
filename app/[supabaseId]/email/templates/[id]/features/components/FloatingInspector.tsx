'use client'

import type { ReactNode } from 'react'
import {
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartVertical,
  Braces,
  FileText,
  Palette,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelTop,
  Pin,
  PinOff,
  Square,
  SquareDashed,
} from 'lucide-react'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import type {
  BorderSide,
  BorderValues,
  BoxRadius,
  BoxSpacing,
  MailyPageStyle,
  PageStyleDimensionUnit,
} from '../utils/emailPageStyle'
import { Input } from '@/components/ui/input'

function clampNonNegativeInt(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

function sanitizeNumberish(value: string, fallback = 0) {
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? clampNonNegativeInt(parsed) : fallback
}

function normalizeColor(value: string) {
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) {
    return value
  }

  return '#000000'
}

function ControlLabel({ children }: { children: string }) {
  return <p className="text-[12px] font-medium text-white/72">{children}</p>
}

function SideLabel({ children }: { children: string }) {
  return <p className="text-[11px] text-white/44">{children}</p>
}

function SegmentShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-[16px] border border-[#232833] bg-[#111117] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]', className)}>
      {children}
    </div>
  )
}

function CompactModeToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (next: T) => void
  options: Array<{ value: T; icon: ReactNode; label: string }>
}) {
  return (
    <SegmentShell className="p-0.5">
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next as T)
        }}
        className="gap-0.5"
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            size="sm"
            className="h-8 min-w-8 rounded-[12px] border-0 bg-transparent px-2 text-white/58 shadow-none data-[state=on]:bg-[#40464d] data-[state=on]:text-white hover:bg-[#1a1f26] hover:text-white"
            aria-label={option.label}
            title={option.label}
          >
            {option.icon}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </SegmentShell>
  )
}

function SegmentedChoice<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (next: T) => void
  options: Array<{ value: T; icon: ReactNode; label: string }>
}) {
  return (
    <SegmentShell>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next as T)
        }}
        className="w-full gap-1"
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            size="sm"
            className="h-9 flex-1 rounded-[12px] border-0 bg-transparent px-0 text-white/56 shadow-none data-[state=on]:bg-[#40464d] data-[state=on]:text-white hover:bg-[#1a1f26] hover:text-white"
            aria-label={option.label}
            title={option.label}
          >
            {option.icon}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </SegmentShell>
  )
}

function NumberWithUnitField({
  value,
  onChange,
  unit = 'px',
}: {
  value: number
  onChange: (next: number) => void
  unit?: string
}) {
  return (
    <div className="flex h-9 items-center gap-2 rounded-[14px] border border-[#232833] bg-[#111117] px-2.5">
      <input
        type="text"
        inputMode="numeric"
        value={String(value)}
        onChange={(event) => onChange(sanitizeNumberish(event.target.value, value))}
        placeholder="0"
        className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-white outline-none placeholder:text-white/40"
      />
      <span className="text-[12px] font-medium text-white/55">{unit}</span>
    </div>
  )
}

function UnitSelect({
  value,
  options,
  onChange,
  className,
}: {
  value: PageStyleDimensionUnit
  options: Array<{ value: PageStyleDimensionUnit; label: string }>
  onChange: (next: PageStyleDimensionUnit) => void
  className?: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={cn(
          'h-9 min-w-[72px] rounded-[14px] border-[#232833] bg-[#111117] px-3 text-[12px] font-medium text-white shadow-none hover:bg-[#171a21] focus:ring-0',
          className
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="border-[#232833] bg-[#111117] text-white">
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="focus:bg-[#1a1f26] focus:text-white">
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function DimensionWithUnitField({
  value,
  unit,
  onChange,
  allowAuto = false,
}: {
  value: string | number
  unit: PageStyleDimensionUnit
  onChange: (next: string, unit: PageStyleDimensionUnit) => void
  allowAuto?: boolean
}) {
  const normalizedValue = String(value).trim()
  const isAutoValue = allowAuto && (!normalizedValue || normalizedValue.toLowerCase() === 'auto')
  const fallbackValue =
    !isAutoValue && normalizedValue.length > 0 ? sanitizeNumberish(normalizedValue, 0) : 0
  const displayValue = isAutoValue
    ? ''
    : normalizedValue.length > 0
      ? String(sanitizeNumberish(normalizedValue, fallbackValue))
      : ''

  return (
    <div className="grid grid-cols-[1fr_88px] gap-2">
      <div className="flex h-9 min-w-0 items-center rounded-[14px] border border-[#232833] bg-[#111117] px-3">
        <input
          type="text"
          inputMode="numeric"
          placeholder={allowAuto && isAutoValue ? 'auto' : '0'}
          value={displayValue}
          onChange={(event) => {
            const nextValue = event.target.value

            if (allowAuto && nextValue.trim().length === 0) {
              onChange('auto', unit)
              return
            }

            onChange(String(sanitizeNumberish(nextValue, fallbackValue)), unit)
          }}
          className="h-9 min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-white outline-none placeholder:text-white/40"
        />
      </div>
      <UnitSelect
        value={unit}
        options={[
          { value: 'px', label: 'PX' },
          { value: '%', label: '%' },
        ]}
        onChange={(nextUnit) => onChange(isAutoValue ? 'auto' : displayValue || '0', nextUnit)}
        className="w-full min-w-0"
      />
    </div>
  )
}

function ColorField({
  label,
  value,
  onChange,
  inline = false,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  inline?: boolean
}) {
  const safeColorValue = normalizeColor(value)
  const field = (
    <div className="flex items-center gap-2 rounded-[14px] border border-[#232833] bg-[#111117] px-2.5">
      <Input
        type="color"
        value={safeColorValue}
        onChange={(event) => onChange(event.target.value)}
        className="h-5 w-5 cursor-pointer rounded-md border border-white/20 bg-transparent p-0"
      />
      <Input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-white outline-none placeholder:text-white/35"
        placeholder="#ffffff"
      />
    </div>
  )

  if (inline) {
    return (
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
        <ControlLabel>{label}</ControlLabel>
        {field}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <ControlLabel>{label}</ControlLabel>
      {field}
    </div>
  )
}

function CompactSideField({
  icon,
  value,
  onChange,
  title,
}: {
  icon: ReactNode
  value: number
  onChange: (next: number) => void
  title: string
}) {
  return (
    <div
      className="flex h-9 items-center gap-2 rounded-[14px] border border-[#232833] bg-[#111117] px-2.5"
      title={title}
    >
      <span className="text-white/55">{icon}</span>
      <input
        type="text"
        inputMode="numeric"
        value={String(value)}
        onChange={(event) => onChange(sanitizeNumberish(event.target.value, value))}
        aria-label={title}
        placeholder="0"
        className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-white outline-none"
      />
      <span className="text-[12px] font-medium text-white/55">px</span>
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
  const items: Array<{ key: keyof BoxSpacing; label: string; icon: ReactNode }> = [
    { key: 'top', label: 'Top', icon: <PanelTop className="h-3.5 w-3.5" /> },
    { key: 'right', label: 'Right', icon: <PanelRight className="h-3.5 w-3.5" /> },
    { key: 'bottom', label: 'Bottom', icon: <PanelBottom className="h-3.5 w-3.5" /> },
    { key: 'left', label: 'Left', icon: <PanelLeft className="h-3.5 w-3.5" /> },
  ]

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <CompactSideField
          key={item.key}
          icon={item.icon}
          title={item.label}
          value={value[item.key]}
          onChange={(next) => onChange({ ...value, [item.key]: next })}
        />
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
  const items: Array<{ key: keyof BoxRadius; label: string; icon: ReactNode }> = [
    { key: 'topLeft', label: 'Top left', icon: <CornerIcon corner="topLeft" /> },
    { key: 'topRight', label: 'Top right', icon: <CornerIcon corner="topRight" /> },
    { key: 'bottomRight', label: 'Bottom right', icon: <CornerIcon corner="bottomRight" /> },
    { key: 'bottomLeft', label: 'Bottom left', icon: <CornerIcon corner="bottomLeft" /> },
  ]

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <CompactSideField
          key={item.key}
          icon={item.icon}
          title={item.label}
          value={value[item.key]}
          onChange={(next) => onChange({ ...value, [item.key]: next })}
        />
      ))}
    </div>
  )
}

function CornerIcon({ corner }: { corner: keyof BoxRadius }) {
  const paths: Record<keyof BoxRadius, string> = {
    topLeft: 'M 3 13 V 7 A 4 4 0 0 1 7 3 H 13',
    topRight: 'M 13 13 V 7 A 4 4 0 0 0 9 3 H 3',
    bottomRight: 'M 13 3 V 9 A 4 4 0 0 1 9 13 H 3',
    bottomLeft: 'M 3 3 V 9 A 4 4 0 0 0 7 13 H 13',
  }
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d={paths[corner]} />
    </svg>
  )
}

function BorderWidthGrid({
  value,
  onChange,
}: {
  value: BorderValues
  onChange: (next: BorderValues) => void
}) {
  const items: Array<{ key: keyof BorderValues; label: string; icon: ReactNode }> = [
    { key: 'top', label: 'Top', icon: <PanelTop className="h-3.5 w-3.5" /> },
    { key: 'right', label: 'Right', icon: <PanelRight className="h-3.5 w-3.5" /> },
    { key: 'bottom', label: 'Bottom', icon: <PanelBottom className="h-3.5 w-3.5" /> },
    { key: 'left', label: 'Left', icon: <PanelLeft className="h-3.5 w-3.5" /> },
  ]

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <CompactSideField
          key={item.key}
          icon={item.icon}
          title={item.label}
          value={value[item.key].width}
          onChange={(next) => onChange({ ...value, [item.key]: { ...value[item.key], width: next } })}
        />
      ))}
    </div>
  )
}

function BorderColorGrid({
  value,
  onChange,
}: {
  value: BorderValues
  onChange: (next: BorderValues) => void
}) {
  const items: Array<{ key: keyof BorderValues; label: string }> = [
    { key: 'top', label: 'Top' },
    { key: 'right', label: 'Right' },
    { key: 'bottom', label: 'Bottom' },
    { key: 'left', label: 'Left' },
  ]

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div key={item.key} className="space-y-1.5">
          <SideLabel>{item.label}</SideLabel>
          <div className="flex items-center gap-2 rounded-[14px] border border-[#232833] bg-[#111117] px-2.5">
            <Input
              type="color"
              value={normalizeColor(value[item.key].color)}
              onChange={(event) =>
                onChange({
                  ...value,
                  [item.key]: {
                    ...value[item.key],
                    color: event.target.value,
                  },
                })
              }
              className="h-5 w-5 cursor-pointer rounded-md border border-white/20 bg-transparent p-0"
            />
            <Input
              type="text"
              value={value[item.key].color}
              onChange={(event) =>
                onChange({
                  ...value,
                  [item.key]: {
                    ...value[item.key],
                    color: event.target.value,
                  },
                })
              }
              className="h-9 min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-white outline-none"
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function toUniformBorderValues(
  border: BorderValues,
  patch: Partial<BorderSide>
): BorderValues {
  return {
    top: { ...border.top, ...patch },
    right: { ...border.right, ...patch },
    bottom: { ...border.bottom, ...patch },
    left: { ...border.left, ...patch },
  }
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
        'font-inter flex min-h-0 flex-col border border-[#1c2027] bg-[#09090b]/98 shadow-[0_24px_56px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-[transform,opacity] duration-200 ease-out',
        'translate-x-0 opacity-100',
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-[#171b22] px-4 py-4">
        <div className="flex items-center gap-2.5">
          <span className="rounded-lg border border-[#232833] bg-[#111117] p-1.5 text-white/82">
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

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <section className="space-y-3">
          <h4 className="text-[14px] font-bold text-white">Background</h4>
          <ColorField
            label="Background"
            value={pageStyle.pageBackground}
            onChange={(pageBackground) => onPageStyleChange({ pageBackground })}
            inline
          />

          <div className="space-y-1.5">
            {pageStyle.pagePaddingMode === 'uniform' ? (
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                <ControlLabel>Padding</ControlLabel>
                <NumberWithUnitField
                  value={pageStyle.pagePadding.top}
                  onChange={(next) =>
                    onPageStyleChange({
                      pagePadding: { top: next, right: next, bottom: next, left: next },
                    })
                  }
                />
                <CompactModeToggle
                  value={pageStyle.pagePaddingMode}
                  onChange={(pagePaddingMode) => onPageStyleChange({ pagePaddingMode })}
                  options={[
                    { value: 'uniform', icon: <Square className="h-3.5 w-3.5" />, label: 'Uniforme' },
                    { value: 'per-side', icon: <SquareDashed className="h-3.5 w-3.5" />, label: 'Por lado' },
                  ]}
                />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <ControlLabel>Padding</ControlLabel>
                  <CompactModeToggle
                    value={pageStyle.pagePaddingMode}
                    onChange={(pagePaddingMode) => onPageStyleChange({ pagePaddingMode })}
                    options={[
                      { value: 'uniform', icon: <Square className="h-3.5 w-3.5" />, label: 'Uniforme' },
                      { value: 'per-side', icon: <SquareDashed className="h-3.5 w-3.5" />, label: 'Por lado' },
                    ]}
                  />
                </div>
                <SideSpacingGrid
                  value={pageStyle.pagePadding}
                  onChange={(pagePadding) => onPageStyleChange({ pagePadding })}
                />
              </>
            )}
          </div>
        </section>

        <section className="space-y-3 border-t border-[#171b22] pt-4">
          <h4 className="text-[14px] font-bold text-white">Body</h4>

          <SegmentedChoice
            value={pageStyle.bodyAlign}
            onChange={(bodyAlign) => onPageStyleChange({ bodyAlign })}
            options={[
              { value: 'left', icon: <AlignStartVertical className="h-4 w-4" />, label: 'Esquerda' },
              { value: 'center', icon: <AlignCenterVertical className="h-4 w-4" />, label: 'Centro' },
              { value: 'right', icon: <AlignEndVertical className="h-4 w-4" />, label: 'Direita' },
            ]}
          />

          <ColorField
            label="Text"
            value={pageStyle.bodyTextColor}
            onChange={(bodyTextColor) => onPageStyleChange({ bodyTextColor })}
            inline
          />

          <ColorField
            label="Background"
            value={pageStyle.bodyBackground}
            onChange={(bodyBackground) => onPageStyleChange({ bodyBackground })}
            inline
          />

          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
            <ControlLabel>Width</ControlLabel>
            <DimensionWithUnitField
              value={pageStyle.bodyWidth}
              unit={pageStyle.bodyWidthUnit}
              onChange={(bodyWidth, bodyWidthUnit) =>
                onPageStyleChange({
                  bodyWidth: sanitizeNumberish(bodyWidth, pageStyle.bodyWidth),
                  bodyWidthUnit,
                })
              }
            />
          </div>

          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
            <ControlLabel>Height</ControlLabel>
            <DimensionWithUnitField
              value={pageStyle.bodyHeight}
              unit={pageStyle.bodyHeightUnit}
              allowAuto
              onChange={(bodyHeight, bodyHeightUnit) =>
                onPageStyleChange({
                  bodyHeight,
                  bodyHeightUnit,
                })
              }
            />
          </div>

          <div className="space-y-1.5">
            {pageStyle.bodyPaddingMode === 'uniform' ? (
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                <ControlLabel>Padding</ControlLabel>
                <NumberWithUnitField
                  value={pageStyle.bodyPadding.top}
                  onChange={(next) =>
                    onPageStyleChange({
                      bodyPadding: { top: next, right: next, bottom: next, left: next },
                    })
                  }
                />
                <CompactModeToggle
                  value={pageStyle.bodyPaddingMode}
                  onChange={(bodyPaddingMode) => onPageStyleChange({ bodyPaddingMode })}
                  options={[
                    { value: 'uniform', icon: <Square className="h-3.5 w-3.5" />, label: 'Uniforme' },
                    { value: 'per-side', icon: <SquareDashed className="h-3.5 w-3.5" />, label: 'Por lado' },
                  ]}
                />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <ControlLabel>Padding</ControlLabel>
                  <CompactModeToggle
                    value={pageStyle.bodyPaddingMode}
                    onChange={(bodyPaddingMode) => onPageStyleChange({ bodyPaddingMode })}
                    options={[
                      { value: 'uniform', icon: <Square className="h-3.5 w-3.5" />, label: 'Uniforme' },
                      { value: 'per-side', icon: <SquareDashed className="h-3.5 w-3.5" />, label: 'Por lado' },
                    ]}
                  />
                </div>
                <SideSpacingGrid
                  value={pageStyle.bodyPadding}
                  onChange={(bodyPadding) => onPageStyleChange({ bodyPadding })}
                />
              </>
            )}
          </div>

          <div className="space-y-1.5">
            {pageStyle.bodyRadiusMode === 'uniform' ? (
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                <ControlLabel>Corner radius</ControlLabel>
                <NumberWithUnitField
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
                <CompactModeToggle
                  value={pageStyle.bodyRadiusMode}
                  onChange={(bodyRadiusMode) => onPageStyleChange({ bodyRadiusMode })}
                  options={[
                    { value: 'uniform', icon: <Square className="h-3.5 w-3.5" />, label: 'Uniforme' },
                    { value: 'per-corner', icon: <SquareDashed className="h-3.5 w-3.5" />, label: 'Por canto' },
                  ]}
                />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <ControlLabel>Corner radius</ControlLabel>
                  <CompactModeToggle
                    value={pageStyle.bodyRadiusMode}
                    onChange={(bodyRadiusMode) => onPageStyleChange({ bodyRadiusMode })}
                    options={[
                      { value: 'uniform', icon: <Square className="h-3.5 w-3.5" />, label: 'Uniforme' },
                      { value: 'per-corner', icon: <SquareDashed className="h-3.5 w-3.5" />, label: 'Por canto' },
                    ]}
                  />
                </div>
                <RadiusGrid
                  value={pageStyle.bodyRadius}
                  onChange={(bodyRadius) => onPageStyleChange({ bodyRadius })}
                />
              </>
            )}
          </div>

          <div className="space-y-1.5">
            {pageStyle.bodyBorderMode === 'uniform' ? (
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                <ControlLabel>Border</ControlLabel>
                <NumberWithUnitField
                  value={pageStyle.bodyBorder.top.width}
                  onChange={(next) =>
                    onPageStyleChange({
                      bodyBorder: toUniformBorderValues(pageStyle.bodyBorder, { width: next }),
                    })
                  }
                />
                <CompactModeToggle
                  value={pageStyle.bodyBorderMode}
                  onChange={(bodyBorderMode) => onPageStyleChange({ bodyBorderMode })}
                  options={[
                    { value: 'uniform', icon: <Square className="h-3.5 w-3.5" />, label: 'Uniforme' },
                    { value: 'per-side', icon: <SquareDashed className="h-3.5 w-3.5" />, label: 'Por lado' },
                  ]}
                />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <ControlLabel>Border</ControlLabel>
                  <CompactModeToggle
                    value={pageStyle.bodyBorderMode}
                    onChange={(bodyBorderMode) => onPageStyleChange({ bodyBorderMode })}
                    options={[
                      { value: 'uniform', icon: <Square className="h-3.5 w-3.5" />, label: 'Uniforme' },
                      { value: 'per-side', icon: <SquareDashed className="h-3.5 w-3.5" />, label: 'Por lado' },
                    ]}
                  />
                </div>
                <BorderWidthGrid
                  value={pageStyle.bodyBorder}
                  onChange={(bodyBorder) => onPageStyleChange({ bodyBorder })}
                />
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <ControlLabel>Border color</ControlLabel>
            {pageStyle.bodyBorderMode === 'uniform' ? (
              <div className="rounded-[14px] border border-[#232833] bg-[#111117] px-2.5">
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={normalizeColor(pageStyle.bodyBorder.top.color)}
                    onChange={(event) =>
                      onPageStyleChange({
                        bodyBorder: toUniformBorderValues(pageStyle.bodyBorder, { color: event.target.value }),
                      })
                    }
                    className="h-5 w-5 cursor-pointer rounded-md border border-white/20 bg-transparent p-0"
                  />
                  <Input
                    type="text"
                    value={pageStyle.bodyBorder.top.color}
                    onChange={(event) =>
                      onPageStyleChange({
                        bodyBorder: toUniformBorderValues(pageStyle.bodyBorder, { color: event.target.value }),
                      })
                    }
                    className="h-9 min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-white outline-none"
                  />
                </div>
              </div>
            ) : (
              <BorderColorGrid
                value={pageStyle.bodyBorder}
                onChange={(bodyBorder) => onPageStyleChange({ bodyBorder })}
              />
            )}
          </div>
        </section>
      </div>

      <div className="border-t border-[#171b22] px-4 py-2">
        <button
          type="button"
          onClick={onOpenTheme}
          className="flex h-10 w-full items-center justify-between rounded-lg px-1 text-left text-[14px] font-bold text-white transition-colors hover:bg-[#171a21]"
        >
          <span>Edit theme</span>
          <Palette className="h-4 w-4 text-white/70" />
        </button>
        <button
          type="button"
          onClick={onOpenGlobalCss}
          className="flex h-10 w-full items-center justify-between rounded-lg px-1 text-left text-[14px] font-bold text-white transition-colors hover:bg-[#171a21]"
        >
          <span>Global CSS</span>
          <Braces className="h-4 w-4 text-white/70" />
        </button>
      </div>
    </aside>
  )
}
