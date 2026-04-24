'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type * as Monaco from 'monaco-editor'
import type { editor as MonacoEditorNamespace } from 'monaco-editor'
import { Check, Copy, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { MonacoCodeEditor } from '@/components/editors/MonacoCodeEditor'
import { buildPreviewDocument } from '@/lib/email-editor-embeds'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
  const [isFormatting, setIsFormatting] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const editorRef = useRef<MonacoEditorNamespace.IStandaloneCodeEditor | null>(null)
  const copyTimeoutRef = useRef<number | null>(null)

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

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  const handleEditorMount = useCallback(
    (editor: MonacoEditorNamespace.IStandaloneCodeEditor, _monaco: typeof Monaco) => {
      editorRef.current = editor
    },
    []
  )

  const handleFormat = useCallback(async () => {
    const editor = editorRef.current
    if (!editor) {
      toast.error('Não foi possível formatar o HTML')
      return
    }

    const formatAction = editor.getAction('editor.action.formatDocument')
    if (!formatAction) {
      toast.error('Formatação indisponível neste editor')
      return
    }

    setIsFormatting(true)
    try {
      await formatAction.run()
      toast.success('HTML formatado')
    } catch (error) {
      console.error('[HtmlEditor] format error', error)
      toast.error('Não foi possível formatar o HTML')
    } finally {
      setIsFormatting(false)
    }
  }, [])

  const handleCopy = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      toast.error('Copiar não está disponível neste navegador')
      return
    }

    try {
      await navigator.clipboard.writeText(value)
      setIsCopied(true)
      toast.success('HTML copiado')

      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current)
      }

      copyTimeoutRef.current = window.setTimeout(() => {
        setIsCopied(false)
        copyTimeoutRef.current = null
      }, 1600)
    } catch (error) {
      console.error('[HtmlEditor] copy error', error)
      toast.error('Não foi possível copiar o HTML')
    }
  }, [value])

  const gridTemplateColumns = useMemo(() => {
    return isExpanded ? '1.08fr 0.92fr' : '0.34fr 1fr'
  }, [isExpanded])

  return (
    <div
      className="grid h-full min-h-0 bg-[#05050A] transition-[grid-template-columns] duration-300 ease-out"
      style={{ gridTemplateColumns }}
    >
      <div className="flex min-w-0 flex-col border-r border-[#141820] bg-[#05050A] text-white">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#141820] px-7 py-5">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold tracking-[0.01em] text-white">HTML code editor</h2>
            <Badge
              variant="secondary"
              className="rounded-full border border-[#23232b] bg-[#111117] px-2 py-0.5 text-[11px] font-medium text-white/70"
            >
              Code
            </Badge>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleFormat}
              disabled={isFormatting}
              title="Formatar HTML"
              className="h-8 w-8 rounded-lg border border-[#232833] bg-[#111117] text-white/68 hover:border-[#303746] hover:bg-[#171a21] hover:text-white"
            >
              {isFormatting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              title={isCopied ? 'HTML copiado' : 'Copiar HTML'}
              className={cn(
                'h-8 w-8 rounded-lg border border-[#232833] bg-[#111117] text-white/68 hover:border-[#303746] hover:bg-[#171a21] hover:text-white',
                isCopied && 'border-[#3d8f6e] bg-[#12392c] text-white'
              )}
            >
              {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-[#05050A] px-4 pb-4 pt-4">
          <MonacoCodeEditor
            value={value}
            onChange={onChange}
            language="html"
            height="100%"
            className="h-full overflow-hidden rounded-[20px] border border-[#141820] bg-[#05050A]"
            themeVariant="resend-dark"
            placeholder="Comece escrevendo o seu template de e-mail..."
            onMount={handleEditorMount}
          />
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#0b0b0f]">
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
              sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
              title="Visualização do email"
            />
          </div>
        </EmailCanvasFrame>
      </div>
    </div>
  )
}
