'use client'

import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { BorderSide, MailyPageStyle } from '../utils/emailPageStyle'

interface EmailCanvasFrameProps {
  subject: string
  previewText: string
  pageStyle: MailyPageStyle
  onChangeSubject: (value: string) => void
  onChangePreviewText: (value: string) => void
  children: ReactNode
  className?: string
  style?: CSSProperties
  bodyClassName?: string
  surface?: 'visual' | 'html-preview'
}

function getAlignClass(bodyAlign: MailyPageStyle['bodyAlign']) {
  if (bodyAlign === 'left') return 'justify-start'
  if (bodyAlign === 'right') return 'justify-end'
  return 'justify-center'
}

function resolveBodyHeight(bodyHeight: string) {
  const normalized = bodyHeight.trim().toLowerCase()
  if (!normalized || normalized === 'auto') {
    return undefined
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined
  }

  return `${Math.floor(parsed)}px`
}

function spacingToStyleValue(value: MailyPageStyle['pagePadding']) {
  return `${value.top}px ${value.right}px ${value.bottom}px ${value.left}px`
}

function applyBorderSideStyles(target: CSSProperties, side: BorderSide, prefix: 'Top' | 'Right' | 'Bottom' | 'Left') {
  if (prefix === 'Top') {
    target.borderTopWidth = `${side.width}px`
    target.borderTopStyle = side.style
    target.borderTopColor = side.color
    return
  }

  if (prefix === 'Right') {
    target.borderRightWidth = `${side.width}px`
    target.borderRightStyle = side.style
    target.borderRightColor = side.color
    return
  }

  if (prefix === 'Bottom') {
    target.borderBottomWidth = `${side.width}px`
    target.borderBottomStyle = side.style
    target.borderBottomColor = side.color
    return
  }

  target.borderLeftWidth = `${side.width}px`
  target.borderLeftStyle = side.style
  target.borderLeftColor = side.color
}

export function EmailCanvasFrame({
  subject,
  previewText,
  pageStyle,
  onChangeSubject,
  onChangePreviewText,
  children,
  className,
  style,
  bodyClassName,
  surface = 'visual',
}: EmailCanvasFrameProps) {
  const resolvedBodyHeight = resolveBodyHeight(pageStyle.bodyHeight)
  const contentMaxWidth = `${Math.max(0, Math.floor(pageStyle.bodyWidth))}px`
  const headerInlinePadding: CSSProperties = {
    paddingLeft: `${pageStyle.pagePadding.left}px`,
    paddingRight: `${pageStyle.pagePadding.right}px`,
  }

  const bodyStyles: CSSProperties = {
    width: '100%',
    maxWidth: contentMaxWidth,
    color: pageStyle.bodyTextColor,
    backgroundColor: pageStyle.bodyBackground,
    padding: spacingToStyleValue(pageStyle.bodyPadding),
    borderTopLeftRadius: `${pageStyle.bodyRadius.topLeft}px`,
    borderTopRightRadius: `${pageStyle.bodyRadius.topRight}px`,
    borderBottomRightRadius: `${pageStyle.bodyRadius.bottomRight}px`,
    borderBottomLeftRadius: `${pageStyle.bodyRadius.bottomLeft}px`,
    minHeight: resolvedBodyHeight ? undefined : '100%',
    height: resolvedBodyHeight,
  }

  applyBorderSideStyles(bodyStyles, pageStyle.bodyBorder.top, 'Top')
  applyBorderSideStyles(bodyStyles, pageStyle.bodyBorder.right, 'Right')
  applyBorderSideStyles(bodyStyles, pageStyle.bodyBorder.bottom, 'Bottom')
  applyBorderSideStyles(bodyStyles, pageStyle.bodyBorder.left, 'Left')

  return (
    <div
      className={cn(
        'flex min-h-0 w-full flex-col overflow-hidden border border-black/5 bg-white',
        surface === 'visual'
          ? 'h-full min-h-full rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.32)]'
          : 'h-full rounded-[24px] shadow-[0_16px_36px_rgba(0,0,0,0.14)]',
        className
      )}
      style={style}
    >
      <div className="shrink-0  pb-2 pt-7" style={headerInlinePadding}>
        <div className={cn('flex w-full', getAlignClass(pageStyle.bodyAlign))}>
          <div className="w-full" style={{ maxWidth: contentMaxWidth }}>
            <div className="grid grid-cols-[84px_minmax(0,1fr)_120px] items-center gap-x-4 border-b border-[#d0d0d0] pb-2">
              <span className="text-[13px] font-medium text-zinc-500">From</span>
              <span className="truncate text-[13px] text-zinc-400">Acme &lt;acme@example.com&gt;</span>
              <span className="justify-self-end text-[13px] font-medium text-zinc-500">Reply-To</span>
            </div>
            <div className="mt-1 grid grid-cols-[84px_minmax(0,1fr)_120px] items-center gap-x-4 border-b border-[#d0d0d0] pb-2">
              <span className="text-[13px] font-medium text-zinc-500">Subject</span>
              <input
                value={subject}
                onChange={(event) => onChangeSubject(event.target.value)}
                placeholder="Assunto do email"
                className="min-w-0 bg-white text-[15px] text-zinc-600 outline-none placeholder:text-zinc-400"
              />
              <input
                value={previewText}
                onChange={(event) => onChangePreviewText(event.target.value)}
                placeholder="Preview text"
                className="min-w-0 bg-white text-right text-[15px] text-zinc-600 outline-none placeholder:text-zinc-400"
              />
            </div>
          </div>
        </div>
      </div>

      <div
        className="flex min-h-0 w-full flex-1 flex-col"
        style={{
          colorScheme: 'light',
          color: '#09090b',
          backgroundColor: pageStyle.pageBackground,
          padding: spacingToStyleValue(pageStyle.pagePadding),
        }}
      >
        <div className={cn('flex min-h-0 flex-1', getAlignClass(pageStyle.bodyAlign))}>
          <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', bodyClassName)} style={bodyStyles}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
