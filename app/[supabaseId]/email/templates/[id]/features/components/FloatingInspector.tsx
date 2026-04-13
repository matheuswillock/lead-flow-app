'use client'

import type { ReactNode, SVGProps } from 'react'
import {
  Braces,
  FileText,
  Palette,
  Pin,
  PinOff,
  Square,
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
} from '../utils/emailPageStyle'

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

function GridModeIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={cn('h-3.5 w-3.5', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2.25" y="2.25" width="4.5" height="4.5" rx="1" />
      <rect x="9.25" y="2.25" width="4.5" height="4.5" rx="1" />
      <rect x="2.25" y="9.25" width="4.5" height="4.5" rx="1" />
      <rect x="9.25" y="9.25" width="4.5" height="4.5" rx="1" />
    </svg>
  )
}

function AlignContainerLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <path d="M2.5 3v10" />
      <rect x="4.75" y="4.25" width="7" height="7.5" rx="1.5" />
    </svg>
  )
}

function AlignContainerCenterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <path d="M8 2.5v11" />
      <rect x="4.5" y="4.25" width="7" height="7.5" rx="1.5" />
    </svg>
  )
}

function AlignContainerRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <path d="M13.5 3v10" />
      <rect x="4.25" y="4.25" width="7" height="7.5" rx="1.5" />
    </svg>
  )
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

function RawInput({
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <div className={cn('flex min-w-0 flex-1 items-center rounded-[14px] border border-[#232833] bg-[#111117] px-3', disabled && 'opacity-70')}>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="h-9 min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-white outline-none placeholder:text-white/30 disabled:cursor-not-allowed"
      />
    </div>
  )
}

function NumberInput({
  value,
  onChange,
  placeholder = '0',
}: {
  value: number
  onChange: (next: number) => void
  placeholder?: string
}) {
  return <RawInput value={String(value)} onChange={(next) => onChange(sanitizeNumberish(next, value))} placeholder={placeholder} />
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
    <div className="flex items-center gap-2">
      <NumberInput value={value} onChange={onChange} />
      <div className="flex h-9 min-w-[64px] items-center justify-center rounded-[14px] border border-[#232833] bg-[#111117] px-3 text-[12px] font-medium text-white/74">
        {unit}
      </div>
    </div>
  )
}

function UnitSelect({
  value,
  options,
  onChange,
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (next: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 min-w-[72px] rounded-[14px] border-[#232833] bg-[#111117] px-3 text-[12px] font-medium text-white shadow-none hover:bg-[#171a21] focus:ring-0">
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

function DimensionField({
  value,
  onChange,
  allowAuto = false,
}: {
  value: string | number
  onChange: (next: string) => void
  allowAuto?: boolean
}) {
  const normalizedValue = String(value).trim()
  const unit = allowAuto && normalizedValue.toLowerCase() === 'auto' ? 'auto' : 'px'
  const displayValue = unit === 'auto' ? 'auto' : normalizedValue.length > 0 ? String(sanitizeNumberish(normalizedValue)) : ''

  return (
    <div className="flex items-center gap-2">
      <RawInput
        value={displayValue}
        onChange={(next) => {
          if (unit === 'auto') return
          onChange(String(sanitizeNumberish(next, displayValue ? sanitizeNumberish(displayValue) : 0)))
        }}
        placeholder={unit === 'auto' ? 'auto' : '0'}
        disabled={unit === 'auto'}
      />
      <UnitSelect
        value={unit}
        options={allowAuto ? [{ value: 'px', label: 'px' }, { value: 'auto', label: 'auto' }] : [{ value: 'px', label: 'px' }]}
        onChange={(next) => {
          if (next === 'auto') {
            onChange('auto')
            return
          }

          const nextValue = unit === 'auto' ? '0' : displayValue || '0'
          onChange(nextValue)
        }}
      />
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
  const safeColorValue = normalizeColor(value)

  return (
    <div className="space-y-1.5">
      <ControlLabel>{label}</ControlLabel>
      <div className="flex items-center gap-2 rounded-[14px] border border-[#232833] bg-[#111117] px-2.5">
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
          className="h-9 min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-white outline-none placeholder:text-white/35"
          placeholder="#ffffff"
        />
      </div>
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
        <div key={item.key} className="space-y-1.5">
          <SideLabel>{item.label}</SideLabel>
          <NumberWithUnitField value={value[item.key]} onChange={(next) => onChange({ ...value, [item.key]: next })} />
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
        <div key={item.key} className="space-y-1.5">
          <SideLabel>{item.label}</SideLabel>
          <NumberWithUnitField value={value[item.key]} onChange={(next) => onChange({ ...value, [item.key]: next })} />
        </div>
      ))}
    </div>
  )
}

function BorderWidthGrid({
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
          <NumberWithUnitField
            value={value[item.key].width}
            onChange={(next) => onChange({ ...value, [item.key]: { ...value[item.key], width: next } })}
          />
        </div>
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
            <input
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
            <input
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
        'flex min-h-0 flex-col border border-[#1c2027] bg-[#09090b]/98 shadow-[0_24px_56px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-[transform,opacity] duration-200 ease-out',
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

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
        <section className="space-y-4">
          <h4 className="text-[13px] font-medium text-white/84">Background</h4>
          <ColorField
            label="Background"
            value={pageStyle.pageBackground}
            onChange={(pageBackground) => onPageStyleChange({ pageBackground })}
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <ControlLabel>Padding</ControlLabel>
              <CompactModeToggle
                value={pageStyle.pagePaddingMode}
                onChange={(pagePaddingMode) => onPageStyleChange({ pagePaddingMode })}
                options={[
                  { value: 'uniform', icon: <Square className="h-3.5 w-3.5" />, label: 'Uniforme' },
                  { value: 'per-side', icon: <GridModeIcon />, label: 'Por lado' },
                ]}
              />
            </div>

            {pageStyle.pagePaddingMode === 'uniform' ? (
              <NumberWithUnitField
                value={pageStyle.pagePadding.top}
                onChange={(next) =>
                  onPageStyleChange({
                    pagePadding: { top: next, right: next, bottom: next, left: next },
                  })
                }
              />
            ) : (
              <SideSpacingGrid
                value={pageStyle.pagePadding}
                onChange={(pagePadding) => onPageStyleChange({ pagePadding })}
              />
            )}
          </div>
        </section>

        <section className="space-y-4 border-t border-[#171b22] pt-4">
          <h4 className="text-[24px] font-semibold leading-none text-white">Body</h4>

          <SegmentedChoice
            value={pageStyle.bodyAlign}
            onChange={(bodyAlign) => onPageStyleChange({ bodyAlign })}
            options={[
              { value: 'left', icon: <AlignContainerLeftIcon className="h-4 w-4" />, label: 'Esquerda' },
              { value: 'center', icon: <AlignContainerCenterIcon className="h-4 w-4" />, label: 'Centro' },
              { value: 'right', icon: <AlignContainerRightIcon className="h-4 w-4" />, label: 'Direita' },
            ]}
          />

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
            <DimensionField value={pageStyle.bodyWidth} onChange={(bodyWidth) => onPageStyleChange({ bodyWidth: sanitizeNumberish(bodyWidth, pageStyle.bodyWidth) })} />
          </div>

          <div className="space-y-1.5">
            <ControlLabel>Height</ControlLabel>
            <DimensionField value={pageStyle.bodyHeight} onChange={(bodyHeight) => onPageStyleChange({ bodyHeight })} allowAuto />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <ControlLabel>Padding</ControlLabel>
              <CompactModeToggle
                value={pageStyle.bodyPaddingMode}
                onChange={(bodyPaddingMode) => onPageStyleChange({ bodyPaddingMode })}
                options={[
                  { value: 'uniform', icon: <Square className="h-3.5 w-3.5" />, label: 'Uniforme' },
                  { value: 'per-side', icon: <GridModeIcon />, label: 'Por lado' },
                ]}
              />
            </div>

            {pageStyle.bodyPaddingMode === 'uniform' ? (
              <NumberWithUnitField
                value={pageStyle.bodyPadding.top}
                onChange={(next) =>
                  onPageStyleChange({
                    bodyPadding: { top: next, right: next, bottom: next, left: next },
                  })
                }
              />
            ) : (
              <SideSpacingGrid
                value={pageStyle.bodyPadding}
                onChange={(bodyPadding) => onPageStyleChange({ bodyPadding })}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <ControlLabel>Corner radius</ControlLabel>
              <CompactModeToggle
                value={pageStyle.bodyRadiusMode}
                onChange={(bodyRadiusMode) => onPageStyleChange({ bodyRadiusMode })}
                options={[
                  { value: 'uniform', icon: <Square className="h-3.5 w-3.5" />, label: 'Uniforme' },
                  { value: 'per-corner', icon: <GridModeIcon />, label: 'Por canto' },
                ]}
              />
            </div>

            {pageStyle.bodyRadiusMode === 'uniform' ? (
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
            ) : (
              <RadiusGrid
                value={pageStyle.bodyRadius}
                onChange={(bodyRadius) => onPageStyleChange({ bodyRadius })}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <ControlLabel>Border</ControlLabel>
              <CompactModeToggle
                value={pageStyle.bodyBorderMode}
                onChange={(bodyBorderMode) => onPageStyleChange({ bodyBorderMode })}
                options={[
                  { value: 'uniform', icon: <Square className="h-3.5 w-3.5" />, label: 'Uniforme' },
                  { value: 'per-side', icon: <GridModeIcon />, label: 'Por lado' },
                ]}
              />
            </div>

            {pageStyle.bodyBorderMode === 'uniform' ? (
              <NumberWithUnitField
                value={pageStyle.bodyBorder.top.width}
                onChange={(next) =>
                  onPageStyleChange({
                    bodyBorder: toUniformBorderValues(pageStyle.bodyBorder, { width: next }),
                  })
                }
              />
            ) : (
              <BorderWidthGrid
                value={pageStyle.bodyBorder}
                onChange={(bodyBorder) => onPageStyleChange({ bodyBorder })}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <ControlLabel>Border color</ControlLabel>
            {pageStyle.bodyBorderMode === 'uniform' ? (
              <div className="rounded-[14px] border border-[#232833] bg-[#111117] px-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={normalizeColor(pageStyle.bodyBorder.top.color)}
                    onChange={(event) =>
                      onPageStyleChange({
                        bodyBorder: toUniformBorderValues(pageStyle.bodyBorder, { color: event.target.value }),
                      })
                    }
                    className="h-5 w-5 cursor-pointer rounded-md border border-white/20 bg-transparent p-0"
                  />
                  <input
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

      <div className="space-y-2 border-t border-[#171b22] p-4">
        <button
          type="button"
          onClick={onOpenTheme}
          className="flex h-11 w-full items-center justify-between rounded-xl border border-[#232833] bg-[#111117] px-3 text-left text-[13px] font-semibold text-white/88 transition-colors hover:border-[#303746] hover:bg-[#171a21]"
        >
          <span>Edit theme</span>
          <Palette className="h-3.5 w-3.5 text-white/70" />
        </button>
        <button
          type="button"
          onClick={onOpenGlobalCss}
          className="flex h-11 w-full items-center justify-between rounded-xl border border-[#232833] bg-[#111117] px-3 text-left text-[13px] font-semibold text-white/88 transition-colors hover:border-[#303746] hover:bg-[#171a21]"
        >
          <span>Global CSS</span>
          <Braces className="h-3.5 w-3.5 text-white/70" />
        </button>
      </div>
    </aside>
  )
}
