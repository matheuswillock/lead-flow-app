'use client'

export type PageStyleBodyAlign = 'left' | 'center' | 'right'
export type PageStyleSpacingMode = 'uniform' | 'per-side'
export type PageStyleRadiusMode = 'uniform' | 'per-corner'
export type BorderStyleKind = 'solid' | 'dashed' | 'dotted'
export type PageStyleBorderMode = 'uniform' | 'per-side'
export type PageStyleDimensionUnit = 'px' | '%'
export type LeadFlowVariableType = 'string' | 'number'

export interface LeadFlowVariableDefinition {
  key: string
  type: LeadFlowVariableType
  fallbackValue?: string
}

export interface BoxSpacing {
  top: number
  right: number
  bottom: number
  left: number
}

export interface BoxRadius {
  topLeft: number
  topRight: number
  bottomRight: number
  bottomLeft: number
}

export interface BorderSide {
  width: number
  style: BorderStyleKind
  color: string
}

export interface BorderValues {
  top: BorderSide
  right: BorderSide
  bottom: BorderSide
  left: BorderSide
}

export interface LeadFlowPageStyleUi {
  pagePaddingMode: PageStyleSpacingMode
  bodyPaddingMode: PageStyleSpacingMode
  bodyRadiusMode: PageStyleRadiusMode
  bodyBorderMode: PageStyleBorderMode
  bodyWidthUnit: PageStyleDimensionUnit
  bodyHeightUnit: PageStyleDimensionUnit
}

export interface MailyPageStyle extends LeadFlowPageStyleUi {
  pageBackground: string
  pagePadding: BoxSpacing
  bodyAlign: PageStyleBodyAlign
  bodyTextColor: string
  bodyBackground: string
  bodyWidth: number
  bodyHeight: string
  bodyPadding: BoxSpacing
  bodyRadius: BoxRadius
  bodyBorder: BorderValues
}

export interface LeadFlowEditorMetadata {
  theme: Record<string, unknown>
  globalCss: string
  pageStyleUi: LeadFlowPageStyleUi
  variables: LeadFlowVariableDefinition[]
}

type UnknownRecord = Record<string, unknown>

interface StyleInput {
  label?: string
  type?: string
  value?: unknown
  prop?: string
  unit?: string
  classReference?: string
  options?: Record<string, string>
}

interface StyleGroup {
  id: string
  title: string
  classReference: string
  category?: string
  inputs: StyleInput[]
}

const DEFAULT_BORDER_SIDE: BorderSide = {
  width: 0,
  style: 'solid',
  color: '#000000',
}

const DEFAULT_PAGE_STYLE_UI: LeadFlowPageStyleUi = {
  pagePaddingMode: 'uniform',
  bodyPaddingMode: 'uniform',
  bodyRadiusMode: 'uniform',
  bodyBorderMode: 'uniform',
  bodyWidthUnit: 'px',
  bodyHeightUnit: 'px',
}

function createSpacing(value = 0): BoxSpacing {
  return {
    top: value,
    right: value,
    bottom: value,
    left: value,
  }
}

function createRadius(value = 0): BoxRadius {
  return {
    topLeft: value,
    topRight: value,
    bottomRight: value,
    bottomLeft: value,
  }
}

function createBorderValues(side: BorderSide = DEFAULT_BORDER_SIDE): BorderValues {
  return {
    top: { ...side },
    right: { ...side },
    bottom: { ...side },
    left: { ...side },
  }
}

export const DEFAULT_PAGE_STYLE: MailyPageStyle = {
  pageBackground: '#ffffff',
  pagePaddingMode: 'uniform',
  pagePadding: createSpacing(0),
  bodyAlign: 'center',
  bodyTextColor: '#000000',
  bodyBackground: '#ffffff',
  bodyWidth: 600,
  bodyWidthUnit: 'px',
  bodyHeight: 'auto',
  bodyHeightUnit: 'px',
  bodyPaddingMode: 'uniform',
  bodyPadding: createSpacing(0),
  bodyRadiusMode: 'uniform',
  bodyRadius: createRadius(0),
  bodyBorderMode: 'uniform',
  bodyBorder: createBorderValues(),
}

const DEFAULT_BODY_STYLE_GROUP: StyleGroup = {
  id: 'body',
  title: 'Background',
  classReference: 'body',
  inputs: [
    { label: 'Background', type: 'color', value: '#ffffff', prop: 'backgroundColor', classReference: 'body' },
    { label: 'Padding Top', type: 'number', value: 0, unit: 'px', prop: 'paddingTop', classReference: 'body' },
    { label: 'Padding Right', type: 'number', value: 0, unit: 'px', prop: 'paddingRight', classReference: 'body' },
    { label: 'Padding Bottom', type: 'number', value: 0, unit: 'px', prop: 'paddingBottom', classReference: 'body' },
    { label: 'Padding Left', type: 'number', value: 0, unit: 'px', prop: 'paddingLeft', classReference: 'body' },
  ],
}

const DEFAULT_CONTAINER_STYLE_GROUP: StyleGroup = {
  id: 'container',
  title: 'Content',
  classReference: 'container',
  inputs: [
    {
      label: 'Align',
      type: 'select',
      value: 'center',
      options: { left: 'Left', center: 'Center', right: 'Right' },
      prop: 'align',
      classReference: 'container',
    },
    { label: 'Width', type: 'number', value: 600, unit: 'px', prop: 'width', classReference: 'container' },
    { label: 'Height', type: 'number', value: '', unit: 'px', prop: 'height', classReference: 'container' },
    { label: 'Text', type: 'color', value: '#000000', prop: 'color', classReference: 'container' },
    { label: 'Background', type: 'color', value: '#ffffff', prop: 'backgroundColor', classReference: 'container' },
    { label: 'Padding Top', type: 'number', value: 0, unit: 'px', prop: 'paddingTop', classReference: 'container' },
    { label: 'Padding Right', type: 'number', value: 0, unit: 'px', prop: 'paddingRight', classReference: 'container' },
    { label: 'Padding Bottom', type: 'number', value: 0, unit: 'px', prop: 'paddingBottom', classReference: 'container' },
    { label: 'Padding Left', type: 'number', value: 0, unit: 'px', prop: 'paddingLeft', classReference: 'container' },
    { label: 'Corner radius', type: 'number', value: 0, unit: 'px', prop: 'borderRadius', classReference: 'container' },
    { label: 'Top left radius', type: 'number', value: 0, unit: 'px', prop: 'borderTopLeftRadius', classReference: 'container' },
    { label: 'Top right radius', type: 'number', value: 0, unit: 'px', prop: 'borderTopRightRadius', classReference: 'container' },
    {
      label: 'Bottom right radius',
      type: 'number',
      value: 0,
      unit: 'px',
      prop: 'borderBottomRightRadius',
      classReference: 'container',
    },
    {
      label: 'Bottom left radius',
      type: 'number',
      value: 0,
      unit: 'px',
      prop: 'borderBottomLeftRadius',
      classReference: 'container',
    },
    { label: 'Border color', type: 'color', value: '#000000', prop: 'borderColor', classReference: 'container' },
    { label: 'Border Width', type: 'number', value: 0, unit: 'px', prop: 'borderWidth', classReference: 'container' },
    {
      label: 'Border Style',
      type: 'select',
      value: 'solid',
      prop: 'borderStyle',
      classReference: 'container',
      options: { solid: 'Solid', dashed: 'Dashed', dotted: 'Dotted' },
    },
    { label: 'Top border width', type: 'number', value: 0, unit: 'px', prop: 'borderTopWidth', classReference: 'container' },
    { label: 'Right border width', type: 'number', value: 0, unit: 'px', prop: 'borderRightWidth', classReference: 'container' },
    { label: 'Bottom border width', type: 'number', value: 0, unit: 'px', prop: 'borderBottomWidth', classReference: 'container' },
    { label: 'Left border width', type: 'number', value: 0, unit: 'px', prop: 'borderLeftWidth', classReference: 'container' },
    { label: 'Top border color', type: 'color', value: '#000000', prop: 'borderTopColor', classReference: 'container' },
    { label: 'Right border color', type: 'color', value: '#000000', prop: 'borderRightColor', classReference: 'container' },
    { label: 'Bottom border color', type: 'color', value: '#000000', prop: 'borderBottomColor', classReference: 'container' },
    { label: 'Left border color', type: 'color', value: '#000000', prop: 'borderLeftColor', classReference: 'container' },
    {
      label: 'Top border style',
      type: 'select',
      value: 'solid',
      prop: 'borderTopStyle',
      classReference: 'container',
      options: { solid: 'Solid', dashed: 'Dashed', dotted: 'Dotted' },
    },
    {
      label: 'Right border style',
      type: 'select',
      value: 'solid',
      prop: 'borderRightStyle',
      classReference: 'container',
      options: { solid: 'Solid', dashed: 'Dashed', dotted: 'Dotted' },
    },
    {
      label: 'Bottom border style',
      type: 'select',
      value: 'solid',
      prop: 'borderBottomStyle',
      classReference: 'container',
      options: { solid: 'Solid', dashed: 'Dashed', dotted: 'Dotted' },
    },
    {
      label: 'Left border style',
      type: 'select',
      value: 'solid',
      prop: 'borderLeftStyle',
      classReference: 'container',
      options: { solid: 'Solid', dashed: 'Dashed', dotted: 'Dotted' },
    },
  ],
}

const DEFAULT_LEAD_FLOW_METADATA: LeadFlowEditorMetadata = {
  theme: {},
  globalCss: '',
  pageStyleUi: { ...DEFAULT_PAGE_STYLE_UI },
  variables: [],
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function cloneValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}

function toNonNegativeInt(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.floor(parsed))
}

function toColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback
}

function toAlign(value: unknown): PageStyleBodyAlign {
  return value === 'left' || value === 'right' ? value : 'center'
}

function toHeight(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return String(Math.floor(value))
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const trimmed = value.trim()
    if (trimmed.toLowerCase() === 'auto') return 'auto'
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed) && parsed > 0) {
      return String(Math.floor(parsed))
    }
  }

  return 'auto'
}

function toBorderStyle(value: unknown, fallback: BorderStyleKind): BorderStyleKind {
  return value === 'dashed' || value === 'dotted' || value === 'solid' ? value : fallback
}

function toDimensionUnit(value: unknown, fallback: PageStyleDimensionUnit): PageStyleDimensionUnit {
  return value === 'px' || value === '%' ? value : fallback
}

function normalizeLeadFlowVariables(value: unknown): LeadFlowVariableDefinition[] {
  if (!Array.isArray(value)) {
    return []
  }

  const deduped = new Map<string, LeadFlowVariableDefinition>()

  for (const item of value) {
    if (!isRecord(item)) continue

    const key = typeof item.key === 'string' ? item.key.trim() : ''
    if (!key) continue

    const normalizedKey = key.toLowerCase()
    deduped.set(normalizedKey, {
      key,
      type: item.type === 'number' ? 'number' : 'string',
      fallbackValue:
        typeof item.fallbackValue === 'string' && item.fallbackValue.trim().length > 0
          ? item.fallbackValue.trim()
          : undefined,
    })
  }

  return Array.from(deduped.values())
}

function ensurePageStyleUi(leadFlow: UnknownRecord, doc: UnknownRecord) {
  if (isRecord(leadFlow.pageStyleUi)) {
    return
  }

  const derivedStyle = derivePageStyleFromDoc(doc)
  leadFlow.pageStyleUi = {
    pagePaddingMode: derivedStyle.pagePaddingMode,
    bodyPaddingMode: derivedStyle.bodyPaddingMode,
    bodyRadiusMode: derivedStyle.bodyRadiusMode,
    bodyBorderMode: derivedStyle.bodyBorderMode,
    bodyWidthUnit: derivedStyle.bodyWidthUnit,
    bodyHeightUnit: derivedStyle.bodyHeightUnit,
  }
}

function createDefaultMailyJson(): UnknownRecord {
  return {
    type: 'doc',
    content: [
      {
        type: 'globalContent',
        attrs: {
          data: {
            styles: [cloneValue(DEFAULT_BODY_STYLE_GROUP), cloneValue(DEFAULT_CONTAINER_STYLE_GROUP)],
            __leadFlow: cloneValue(DEFAULT_LEAD_FLOW_METADATA),
          },
        },
      },
      {
        type: 'container',
        content: [{ type: 'paragraph' }],
      },
    ],
  }
}

function ensureDoc(raw: unknown): UnknownRecord {
  if (isRecord(raw) && Array.isArray(raw.content)) {
    const cloned = cloneValue(raw)
    if (cloned.type !== 'doc') {
      cloned.type = 'doc'
    }
    return cloned
  }

  return createDefaultMailyJson()
}

function ensureDocContent(doc: UnknownRecord): UnknownRecord[] {
  if (!Array.isArray(doc.content)) {
    doc.content = []
  }

  return (doc.content as unknown[]).filter(isRecord)
}

function ensureGlobalContent(doc: UnknownRecord): UnknownRecord {
  const content = ensureDocContent(doc)
  const existing = content.find((node) => node.type === 'globalContent')

  if (existing) {
    if (!isRecord(existing.attrs)) {
      existing.attrs = {}
    }
    if (!isRecord((existing.attrs as UnknownRecord).data)) {
      ;(existing.attrs as UnknownRecord).data = {}
    }
    return existing
  }

  const created = {
    type: 'globalContent',
    attrs: {
      data: {
        styles: [cloneValue(DEFAULT_BODY_STYLE_GROUP), cloneValue(DEFAULT_CONTAINER_STYLE_GROUP)],
        __leadFlow: cloneValue(DEFAULT_LEAD_FLOW_METADATA),
      },
    },
  }

  content.unshift(created)
  return created
}

function ensureGlobalData(doc: UnknownRecord): UnknownRecord {
  const globalContent = ensureGlobalContent(doc)
  const attrs = globalContent.attrs as UnknownRecord
  if (!isRecord(attrs.data)) {
    attrs.data = {}
  }
  return attrs.data as UnknownRecord
}

function ensureStyles(doc: UnknownRecord): StyleGroup[] {
  const data = ensureGlobalData(doc)

  if (!Array.isArray(data.styles)) {
    data.styles = [cloneValue(DEFAULT_BODY_STYLE_GROUP), cloneValue(DEFAULT_CONTAINER_STYLE_GROUP)]
  }

  const styles = (data.styles as unknown[])
    .filter(isRecord)
    .map((style) => {
      if (!Array.isArray(style.inputs)) {
        style.inputs = []
      }
      return style as unknown as StyleGroup
    })

  data.styles = styles
  return styles
}

function ensureLeadFlowStore(doc: UnknownRecord): UnknownRecord {
  const data = ensureGlobalData(doc)

  if (!isRecord(data.__leadFlow)) {
    data.__leadFlow = {}
  }

  const leadFlow = data.__leadFlow as UnknownRecord
  if (!isRecord(leadFlow.theme)) {
    leadFlow.theme = {}
  }
  if (typeof leadFlow.globalCss !== 'string') {
    leadFlow.globalCss = ''
  }
  leadFlow.variables = normalizeLeadFlowVariables(leadFlow.variables)

  return leadFlow
}

function ensureStyleGroup(styles: StyleGroup[], defaults: StyleGroup): StyleGroup {
  const existing = styles.find((style) => style.id === defaults.id || style.classReference === defaults.classReference)

  if (existing) {
    return existing
  }

  const created = cloneValue(defaults)
  styles.push(created)
  return created
}

function getInput(group: StyleGroup, prop: string, fallback: StyleInput): StyleInput {
  const existing = group.inputs.find((input) => input.prop === prop)

  if (existing) {
    return existing
  }

  const created = cloneValue(fallback)
  group.inputs.push(created)
  return created
}

function readGroupValue(styles: StyleGroup[], defaults: StyleGroup, prop: string): unknown {
  const group = styles.find((style) => style.id === defaults.id || style.classReference === defaults.classReference)
  return group?.inputs.find((input) => input.prop === prop)?.value
}

function readGroupUnit(
  styles: StyleGroup[],
  defaults: StyleGroup,
  prop: string,
  fallback: PageStyleDimensionUnit
): PageStyleDimensionUnit {
  const group = styles.find((style) => style.id === defaults.id || style.classReference === defaults.classReference)
  return toDimensionUnit(group?.inputs.find((input) => input.prop === prop)?.unit, fallback)
}

function isUniformSpacing(value: BoxSpacing) {
  return value.top === value.right && value.top === value.bottom && value.top === value.left
}

function isUniformRadius(value: BoxRadius) {
  return (
    value.topLeft === value.topRight &&
    value.topLeft === value.bottomRight &&
    value.topLeft === value.bottomLeft
  )
}

function isUniformBorder(value: BorderValues) {
  const reference = value.top
  return (
    reference.width === value.right.width &&
    reference.width === value.bottom.width &&
    reference.width === value.left.width &&
    reference.style === value.right.style &&
    reference.style === value.bottom.style &&
    reference.style === value.left.style &&
    reference.color === value.right.color &&
    reference.color === value.bottom.color &&
    reference.color === value.left.color
  )
}

function inferPageStyleUi(values: {
  pagePadding: BoxSpacing
  bodyPadding: BoxSpacing
  bodyRadius: BoxRadius
  bodyBorder: BorderValues
  bodyWidthUnit: PageStyleDimensionUnit
  bodyHeightUnit: PageStyleDimensionUnit
}): LeadFlowPageStyleUi {
  return {
    pagePaddingMode: isUniformSpacing(values.pagePadding) ? 'uniform' : 'per-side',
    bodyPaddingMode: isUniformSpacing(values.bodyPadding) ? 'uniform' : 'per-side',
    bodyRadiusMode: isUniformRadius(values.bodyRadius) ? 'uniform' : 'per-corner',
    bodyBorderMode: isUniformBorder(values.bodyBorder) ? 'uniform' : 'per-side',
    bodyWidthUnit: values.bodyWidthUnit,
    bodyHeightUnit: values.bodyHeightUnit,
  }
}

function normalizePageStyleUi(value: unknown, fallback: LeadFlowPageStyleUi): LeadFlowPageStyleUi {
  if (!isRecord(value)) {
    return fallback
  }

  return {
    pagePaddingMode: value.pagePaddingMode === 'per-side' ? 'per-side' : fallback.pagePaddingMode,
    bodyPaddingMode: value.bodyPaddingMode === 'per-side' ? 'per-side' : fallback.bodyPaddingMode,
    bodyRadiusMode: value.bodyRadiusMode === 'per-corner' ? 'per-corner' : fallback.bodyRadiusMode,
    bodyBorderMode: value.bodyBorderMode === 'per-side' ? 'per-side' : fallback.bodyBorderMode,
    bodyWidthUnit: toDimensionUnit(value.bodyWidthUnit, fallback.bodyWidthUnit),
    bodyHeightUnit: toDimensionUnit(value.bodyHeightUnit, fallback.bodyHeightUnit),
  }
}

function readSpacingValue(styles: StyleGroup[], defaults: StyleGroup, fallback: BoxSpacing): BoxSpacing {
  return {
    top: toNonNegativeInt(readGroupValue(styles, defaults, 'paddingTop'), fallback.top),
    right: toNonNegativeInt(readGroupValue(styles, defaults, 'paddingRight'), fallback.right),
    bottom: toNonNegativeInt(readGroupValue(styles, defaults, 'paddingBottom'), fallback.bottom),
    left: toNonNegativeInt(readGroupValue(styles, defaults, 'paddingLeft'), fallback.left),
  }
}

function readRadiusValue(styles: StyleGroup[], defaults: StyleGroup, fallback: BoxRadius): BoxRadius {
  const uniformRadius = toNonNegativeInt(readGroupValue(styles, defaults, 'borderRadius'), fallback.topLeft)

  return {
    topLeft: toNonNegativeInt(readGroupValue(styles, defaults, 'borderTopLeftRadius'), uniformRadius),
    topRight: toNonNegativeInt(readGroupValue(styles, defaults, 'borderTopRightRadius'), uniformRadius),
    bottomRight: toNonNegativeInt(readGroupValue(styles, defaults, 'borderBottomRightRadius'), uniformRadius),
    bottomLeft: toNonNegativeInt(readGroupValue(styles, defaults, 'borderBottomLeftRadius'), uniformRadius),
  }
}

function readBorderValue(styles: StyleGroup[], defaults: StyleGroup, fallback: BorderValues): BorderValues {
  const uniformWidth = toNonNegativeInt(readGroupValue(styles, defaults, 'borderWidth'), fallback.top.width)
  const uniformStyle = toBorderStyle(readGroupValue(styles, defaults, 'borderStyle'), fallback.top.style)
  const uniformColor = toColor(readGroupValue(styles, defaults, 'borderColor'), fallback.top.color)

  return {
    top: {
      width: toNonNegativeInt(readGroupValue(styles, defaults, 'borderTopWidth'), uniformWidth),
      style: toBorderStyle(readGroupValue(styles, defaults, 'borderTopStyle'), uniformStyle),
      color: toColor(readGroupValue(styles, defaults, 'borderTopColor'), uniformColor),
    },
    right: {
      width: toNonNegativeInt(readGroupValue(styles, defaults, 'borderRightWidth'), uniformWidth),
      style: toBorderStyle(readGroupValue(styles, defaults, 'borderRightStyle'), uniformStyle),
      color: toColor(readGroupValue(styles, defaults, 'borderRightColor'), uniformColor),
    },
    bottom: {
      width: toNonNegativeInt(readGroupValue(styles, defaults, 'borderBottomWidth'), uniformWidth),
      style: toBorderStyle(readGroupValue(styles, defaults, 'borderBottomStyle'), uniformStyle),
      color: toColor(readGroupValue(styles, defaults, 'borderBottomColor'), uniformColor),
    },
    left: {
      width: toNonNegativeInt(readGroupValue(styles, defaults, 'borderLeftWidth'), uniformWidth),
      style: toBorderStyle(readGroupValue(styles, defaults, 'borderLeftStyle'), uniformStyle),
      color: toColor(readGroupValue(styles, defaults, 'borderLeftColor'), uniformColor),
    },
  }
}

function mergePageStyle(current: MailyPageStyle, patch: Partial<MailyPageStyle>): MailyPageStyle {
  return {
    pageBackground: patch.pageBackground ?? current.pageBackground,
    pagePaddingMode: patch.pagePaddingMode ?? current.pagePaddingMode,
    pagePadding: patch.pagePadding ? { ...current.pagePadding, ...patch.pagePadding } : { ...current.pagePadding },
    bodyAlign: patch.bodyAlign ?? current.bodyAlign,
    bodyTextColor: patch.bodyTextColor ?? current.bodyTextColor,
    bodyBackground: patch.bodyBackground ?? current.bodyBackground,
    bodyWidth: patch.bodyWidth ?? current.bodyWidth,
    bodyWidthUnit: patch.bodyWidthUnit ?? current.bodyWidthUnit,
    bodyHeight: patch.bodyHeight !== undefined ? toHeight(patch.bodyHeight) : current.bodyHeight,
    bodyHeightUnit: patch.bodyHeightUnit ?? current.bodyHeightUnit,
    bodyPaddingMode: patch.bodyPaddingMode ?? current.bodyPaddingMode,
    bodyPadding: patch.bodyPadding ? { ...current.bodyPadding, ...patch.bodyPadding } : { ...current.bodyPadding },
    bodyRadiusMode: patch.bodyRadiusMode ?? current.bodyRadiusMode,
    bodyRadius: patch.bodyRadius ? { ...current.bodyRadius, ...patch.bodyRadius } : { ...current.bodyRadius },
    bodyBorderMode: patch.bodyBorderMode ?? current.bodyBorderMode,
    bodyBorder: patch.bodyBorder
      ? {
          top: patch.bodyBorder.top ? { ...current.bodyBorder.top, ...patch.bodyBorder.top } : { ...current.bodyBorder.top },
          right: patch.bodyBorder.right
            ? { ...current.bodyBorder.right, ...patch.bodyBorder.right }
            : { ...current.bodyBorder.right },
          bottom: patch.bodyBorder.bottom
            ? { ...current.bodyBorder.bottom, ...patch.bodyBorder.bottom }
            : { ...current.bodyBorder.bottom },
          left: patch.bodyBorder.left ? { ...current.bodyBorder.left, ...patch.bodyBorder.left } : { ...current.bodyBorder.left },
        }
      : {
          top: { ...current.bodyBorder.top },
          right: { ...current.bodyBorder.right },
          bottom: { ...current.bodyBorder.bottom },
          left: { ...current.bodyBorder.left },
        },
  }
}

function normalizePageStyleForModes(style: MailyPageStyle): MailyPageStyle {
  const normalized = cloneValue(style)

  if (normalized.pagePaddingMode === 'uniform') {
    normalized.pagePadding = createSpacing(normalized.pagePadding.top)
  }

  if (normalized.bodyPaddingMode === 'uniform') {
    normalized.bodyPadding = createSpacing(normalized.bodyPadding.top)
  }

  if (normalized.bodyRadiusMode === 'uniform') {
    normalized.bodyRadius = createRadius(normalized.bodyRadius.topLeft)
  }

  if (normalized.bodyBorderMode === 'uniform') {
    normalized.bodyBorder = createBorderValues(normalized.bodyBorder.top)
  }

  return normalized
}

function writeSpacing(group: StyleGroup, defaults: StyleGroup, spacing: BoxSpacing) {
  const mapping: Array<keyof BoxSpacing> = ['top', 'right', 'bottom', 'left']

  mapping.forEach((side) => {
    const prop = `padding${side.charAt(0).toUpperCase()}${side.slice(1)}` as const
    const fallback = defaults.inputs.find((input) => input.prop === prop)
    if (!fallback) return
    getInput(group, prop, fallback).value = spacing[side]
  })
}

function writeRadius(group: StyleGroup, defaults: StyleGroup, radius: BoxRadius, mode: PageStyleRadiusMode) {
  const mapping: Array<{ key: keyof BoxRadius; prop: string }> = [
    { key: 'topLeft', prop: 'borderTopLeftRadius' },
    { key: 'topRight', prop: 'borderTopRightRadius' },
    { key: 'bottomRight', prop: 'borderBottomRightRadius' },
    { key: 'bottomLeft', prop: 'borderBottomLeftRadius' },
  ]

  mapping.forEach(({ key, prop }) => {
    const fallback = defaults.inputs.find((input) => input.prop === prop)
    if (!fallback) return
    getInput(group, prop, fallback).value = radius[key]
  })

  const borderRadiusInput = defaults.inputs.find((input) => input.prop === 'borderRadius')
  if (borderRadiusInput) {
    getInput(group, 'borderRadius', borderRadiusInput).value =
      mode === 'uniform' && isUniformRadius(radius) ? radius.topLeft : ''
  }
}

function writeBorder(group: StyleGroup, defaults: StyleGroup, border: BorderValues, mode: PageStyleBorderMode) {
  const mapping: Array<{ key: keyof BorderValues; suffix: string }> = [
    { key: 'top', suffix: 'Top' },
    { key: 'right', suffix: 'Right' },
    { key: 'bottom', suffix: 'Bottom' },
    { key: 'left', suffix: 'Left' },
  ]

  mapping.forEach(({ key, suffix }) => {
    const side = border[key]
    const widthFallback = defaults.inputs.find((input) => input.prop === `border${suffix}Width`)
    const styleFallback = defaults.inputs.find((input) => input.prop === `border${suffix}Style`)
    const colorFallback = defaults.inputs.find((input) => input.prop === `border${suffix}Color`)

    if (widthFallback) getInput(group, `border${suffix}Width`, widthFallback).value = side.width
    if (styleFallback) getInput(group, `border${suffix}Style`, styleFallback).value = side.style
    if (colorFallback) getInput(group, `border${suffix}Color`, colorFallback).value = side.color
  })

  const shorthandEnabled = mode === 'uniform' && isUniformBorder(border)
  const borderWidthFallback = defaults.inputs.find((input) => input.prop === 'borderWidth')
  const borderStyleFallback = defaults.inputs.find((input) => input.prop === 'borderStyle')
  const borderColorFallback = defaults.inputs.find((input) => input.prop === 'borderColor')

  if (borderWidthFallback) {
    getInput(group, 'borderWidth', borderWidthFallback).value = shorthandEnabled ? border.top.width : ''
  }
  if (borderStyleFallback) {
    getInput(group, 'borderStyle', borderStyleFallback).value = shorthandEnabled ? border.top.style : ''
  }
  if (borderColorFallback) {
    getInput(group, 'borderColor', borderColorFallback).value = shorthandEnabled ? border.top.color : ''
  }
}

function derivePageStyleFromDoc(doc: UnknownRecord): MailyPageStyle {
  const styles = ensureStyles(doc)
  const leadFlow = ensureLeadFlowStore(doc)

  const pagePadding = readSpacingValue(styles, DEFAULT_BODY_STYLE_GROUP, DEFAULT_PAGE_STYLE.pagePadding)
  const bodyPadding = readSpacingValue(styles, DEFAULT_CONTAINER_STYLE_GROUP, DEFAULT_PAGE_STYLE.bodyPadding)
  const bodyRadius = readRadiusValue(styles, DEFAULT_CONTAINER_STYLE_GROUP, DEFAULT_PAGE_STYLE.bodyRadius)
  const bodyBorder = readBorderValue(styles, DEFAULT_CONTAINER_STYLE_GROUP, DEFAULT_PAGE_STYLE.bodyBorder)
  const bodyWidthUnit = readGroupUnit(
    styles,
    DEFAULT_CONTAINER_STYLE_GROUP,
    'width',
    DEFAULT_PAGE_STYLE.bodyWidthUnit
  )
  const bodyHeightUnit = readGroupUnit(
    styles,
    DEFAULT_CONTAINER_STYLE_GROUP,
    'height',
    DEFAULT_PAGE_STYLE.bodyHeightUnit
  )

  const inferredUi = inferPageStyleUi({
    pagePadding,
    bodyPadding,
    bodyRadius,
    bodyBorder,
    bodyWidthUnit,
    bodyHeightUnit,
  })
  const pageStyleUi = normalizePageStyleUi(leadFlow.pageStyleUi, inferredUi)
  leadFlow.pageStyleUi = cloneValue(pageStyleUi)

  return {
    pageBackground: toColor(
      readGroupValue(styles, DEFAULT_BODY_STYLE_GROUP, 'backgroundColor'),
      DEFAULT_PAGE_STYLE.pageBackground
    ),
    pagePaddingMode: pageStyleUi.pagePaddingMode,
    pagePadding,
    bodyAlign: toAlign(readGroupValue(styles, DEFAULT_CONTAINER_STYLE_GROUP, 'align')),
    bodyTextColor: toColor(
      readGroupValue(styles, DEFAULT_CONTAINER_STYLE_GROUP, 'color'),
      DEFAULT_PAGE_STYLE.bodyTextColor
    ),
    bodyBackground: toColor(
      readGroupValue(styles, DEFAULT_CONTAINER_STYLE_GROUP, 'backgroundColor'),
      DEFAULT_PAGE_STYLE.bodyBackground
    ),
    bodyWidth: toNonNegativeInt(
      readGroupValue(styles, DEFAULT_CONTAINER_STYLE_GROUP, 'width'),
      DEFAULT_PAGE_STYLE.bodyWidth
    ),
    bodyWidthUnit: pageStyleUi.bodyWidthUnit,
    bodyHeight: toHeight(readGroupValue(styles, DEFAULT_CONTAINER_STYLE_GROUP, 'height')),
    bodyHeightUnit: pageStyleUi.bodyHeightUnit,
    bodyPaddingMode: pageStyleUi.bodyPaddingMode,
    bodyPadding,
    bodyRadiusMode: pageStyleUi.bodyRadiusMode,
    bodyRadius,
    bodyBorderMode: pageStyleUi.bodyBorderMode,
    bodyBorder,
  }
}

export function derivePageStyleFromMailyJson(raw: unknown): MailyPageStyle {
  return derivePageStyleFromDoc(ensureDoc(raw))
}

export function patchPageStyleInMailyJson(raw: unknown, patch: Partial<MailyPageStyle>): unknown {
  const doc = ensureDoc(raw)
  const styles = ensureStyles(doc)
  const leadFlow = ensureLeadFlowStore(doc)
  const bodyGroup = ensureStyleGroup(styles, DEFAULT_BODY_STYLE_GROUP)
  const containerGroup = ensureStyleGroup(styles, DEFAULT_CONTAINER_STYLE_GROUP)
  const nextStyle = normalizePageStyleForModes(mergePageStyle(derivePageStyleFromDoc(doc), patch))

  leadFlow.pageStyleUi = {
    pagePaddingMode: nextStyle.pagePaddingMode,
    bodyPaddingMode: nextStyle.bodyPaddingMode,
    bodyRadiusMode: nextStyle.bodyRadiusMode,
    bodyBorderMode: nextStyle.bodyBorderMode,
    bodyWidthUnit: nextStyle.bodyWidthUnit,
    bodyHeightUnit: nextStyle.bodyHeightUnit,
  }

  const bodyBackgroundFallback = DEFAULT_BODY_STYLE_GROUP.inputs.find((input) => input.prop === 'backgroundColor')
  if (bodyBackgroundFallback) {
    getInput(bodyGroup, 'backgroundColor', bodyBackgroundFallback).value = nextStyle.pageBackground
  }

  const alignFallback = DEFAULT_CONTAINER_STYLE_GROUP.inputs.find((input) => input.prop === 'align')
  if (alignFallback) {
    getInput(containerGroup, 'align', alignFallback).value = nextStyle.bodyAlign
  }

  const textFallback = DEFAULT_CONTAINER_STYLE_GROUP.inputs.find((input) => input.prop === 'color')
  if (textFallback) {
    getInput(containerGroup, 'color', textFallback).value = nextStyle.bodyTextColor
  }

  const containerBackgroundFallback = DEFAULT_CONTAINER_STYLE_GROUP.inputs.find(
    (input) => input.prop === 'backgroundColor'
  )
  if (containerBackgroundFallback) {
    getInput(containerGroup, 'backgroundColor', containerBackgroundFallback).value = nextStyle.bodyBackground
  }

  const widthFallback = DEFAULT_CONTAINER_STYLE_GROUP.inputs.find((input) => input.prop === 'width')
  if (widthFallback) {
    const widthInput = getInput(containerGroup, 'width', widthFallback)
    widthInput.value = nextStyle.bodyWidth
    widthInput.unit = nextStyle.bodyWidthUnit
  }

  const heightFallback = DEFAULT_CONTAINER_STYLE_GROUP.inputs.find((input) => input.prop === 'height')
  if (heightFallback) {
    const heightInput = getInput(containerGroup, 'height', heightFallback)
    heightInput.value = nextStyle.bodyHeight === 'auto' ? '' : Math.max(0, Math.floor(Number(nextStyle.bodyHeight)))
    heightInput.unit = nextStyle.bodyHeightUnit
  }

  writeSpacing(bodyGroup, DEFAULT_BODY_STYLE_GROUP, nextStyle.pagePadding)
  writeSpacing(containerGroup, DEFAULT_CONTAINER_STYLE_GROUP, nextStyle.bodyPadding)
  writeRadius(containerGroup, DEFAULT_CONTAINER_STYLE_GROUP, nextStyle.bodyRadius, nextStyle.bodyRadiusMode)
  writeBorder(containerGroup, DEFAULT_CONTAINER_STYLE_GROUP, nextStyle.bodyBorder, nextStyle.bodyBorderMode)

  return doc
}

export function getLeadFlowMetadata(raw: unknown): LeadFlowEditorMetadata {
  const doc = ensureDoc(raw)
  const leadFlow = ensureLeadFlowStore(doc)
  const pageStyle = derivePageStyleFromDoc(doc)

  return {
    theme: cloneValue(leadFlow.theme as Record<string, unknown>),
    globalCss: leadFlow.globalCss as string,
    pageStyleUi: {
      pagePaddingMode: pageStyle.pagePaddingMode,
      bodyPaddingMode: pageStyle.bodyPaddingMode,
      bodyRadiusMode: pageStyle.bodyRadiusMode,
      bodyBorderMode: pageStyle.bodyBorderMode,
      bodyWidthUnit: pageStyle.bodyWidthUnit,
      bodyHeightUnit: pageStyle.bodyHeightUnit,
    },
    variables: cloneValue(leadFlow.variables as LeadFlowVariableDefinition[]),
  }
}

export function setLeadFlowTheme(raw: unknown, theme: Record<string, unknown>): unknown {
  const doc = ensureDoc(raw)
  const leadFlow = ensureLeadFlowStore(doc)
  ensurePageStyleUi(leadFlow, doc)
  leadFlow.theme = cloneValue(theme)
  return doc
}

export function setLeadFlowGlobalCss(raw: unknown, globalCss: string): unknown {
  const doc = ensureDoc(raw)
  const leadFlow = ensureLeadFlowStore(doc)
  ensurePageStyleUi(leadFlow, doc)
  leadFlow.globalCss = globalCss
  return doc
}

export function getLeadFlowVariables(raw: unknown): LeadFlowVariableDefinition[] {
  const doc = ensureDoc(raw)
  const leadFlow = ensureLeadFlowStore(doc)
  return cloneValue(leadFlow.variables as LeadFlowVariableDefinition[])
}

export function setLeadFlowVariables(raw: unknown, variables: LeadFlowVariableDefinition[]): unknown {
  const doc = ensureDoc(raw)
  const leadFlow = ensureLeadFlowStore(doc)
  ensurePageStyleUi(leadFlow, doc)
  leadFlow.variables = normalizeLeadFlowVariables(variables)
  return doc
}
