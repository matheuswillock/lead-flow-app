'use client'

import { useEffect, useMemo, useState } from 'react'
import { MonacoCodeEditor } from '@/components/editors/MonacoCodeEditor'
import { EmailCanvasFrame } from './EmailCanvasFrame'
import type { MailyPageStyle } from '../utils/emailPageStyle'

type HtmlTransitionDirection = 'enter-html' | 'return-to-canvas' | 'none'

interface HtmlEditorProps {
  value: string
  subject: string
  previewText: string
  pageStyle: MailyPageStyle
  globalCss: string
  transitionDirection: HtmlTransitionDirection
  onChangeSubject: (subject: string) => void
  onChangePreviewText: (previewText: string) => void
  onChange: (html: string) => void
}

function buildPreviewDocument(html: string, globalCss: string) {
  const safeHtml = html.trim()
  const styleTag = globalCss.trim().length > 0 ? `<style>${globalCss}</style>` : ''

  if (/<html[\s>]/i.test(safeHtml) || /<!doctype/i.test(safeHtml)) {
    if (/<head[\s>]/i.test(safeHtml)) {
      return safeHtml.replace(/<\/head>/i, `${styleTag}</head>`)
    }

    return safeHtml.replace(/<html([^>]*)>/i, `<html$1><head>${styleTag}</head>`)
  }

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${styleTag}
  </head>
  <body style="margin:0;min-height:100vh;background:#ffffff;">
    ${safeHtml}
  </body>
</html>`
}

export function HtmlEditor({
  value,
  subject,
  previewText,
  pageStyle,
  globalCss,
  transitionDirection,
  onChangeSubject,
  onChangePreviewText,
  onChange,
}: HtmlEditorProps) {
  const [previewHtml, setPreviewHtml] = useState(value)
  const shouldAnimate = transitionDirection === 'enter-html'
  const [isExpanded, setIsExpanded] = useState(!shouldAnimate)

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setPreviewHtml(value)
    }, 250)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [value])

  useEffect(() => {
    if (!shouldAnimate) {
      setIsExpanded(true)
      return
    }

    setIsExpanded(false)
    const frame = requestAnimationFrame(() => {
      setIsExpanded(true)
    })

    return () => {
      cancelAnimationFrame(frame)
    }
  }, [shouldAnimate, transitionDirection])

  const gridTemplateColumns = useMemo(() => {
    return isExpanded ? '1.08fr 0.92fr' : '0.34fr 1fr'
  }, [isExpanded])

  return (
    <div
      className="grid h-full min-h-0 bg-[#05050A] transition-[grid-template-columns] duration-300 ease-out"
      style={{ gridTemplateColumns }}
    >
      <div className="flex min-w-0 flex-col border-r border-[#141820] bg-[#05050A] text-white">
        <div className="shrink-0 bg-[#05050A] px-7 py-6 text-base font-semibold tracking-[0.01em] text-white">
          HTML code editor
        </div>
        <div className="min-h-0 flex-1 bg-[#05050A] px-4 pb-4">
          <MonacoCodeEditor
            value={value}
            onChange={onChange}
            language="html"
            height="100%"
            className="h-full overflow-hidden rounded-[20px] border border-[#141820] bg-[#05050A]"
            themeVariant="resend-dark"
            placeholder="Comece escrevendo o seu template de e-mail..."
          />
        </div>
      </div>

      <div className="flex min-w-0 min-h-0 flex-col overflow-hidden bg-[#0b0b0f]">
        <EmailCanvasFrame
          subject={subject}
          previewText={previewText}
          pageStyle={pageStyle}
          onChangeSubject={onChangeSubject}
          onChangePreviewText={onChangePreviewText}
          surface="html-preview"
          className="h-full min-h-0 w-full"
        >
          <div className="min-h-0 flex-1 overflow-hidden">
            <iframe
              srcDoc={buildPreviewDocument(previewHtml, globalCss)}
              className="h-full w-full border-0 bg-white"
              sandbox="allow-same-origin"
              title="Visualização do email"
            />
          </div>
        </EmailCanvasFrame>
      </div>
    </div>
  )
}
