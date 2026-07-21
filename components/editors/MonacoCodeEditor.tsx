'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import type * as Monaco from 'monaco-editor'
import type { editor as MonacoEditorNamespace } from 'monaco-editor'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((module) => module.default),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full" />,
  }
)

export interface MonacoCodeEditorProps {
  value: string
  onChange: (value: string) => void
  language?: string
  height?: string | number
  readOnly?: boolean
  className?: string
  options?: MonacoEditorNamespace.IStandaloneEditorConstructionOptions
  themeVariant?: 'auto' | 'dracula' | 'resend-dark'
  placeholder?: string
  editorKey?: string
  onMount?: (editor: MonacoEditorNamespace.IStandaloneCodeEditor, monaco: typeof Monaco) => void
}

function defineLeadFlowDracula(monaco: typeof Monaco) {
  monaco.editor.defineTheme('leadflow-dracula', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'F8F8F2', background: '282A36' },
      { token: 'comment', foreground: '6272A4' },
      { token: 'keyword', foreground: 'FF79C6' },
      { token: 'string', foreground: 'F1FA8C' },
      { token: 'number', foreground: 'BD93F9' },
      { token: 'tag', foreground: 'FF79C6' },
      { token: 'attribute.name', foreground: '50FA7B' },
      { token: 'attribute.value', foreground: 'F1FA8C' },
      { token: 'delimiter', foreground: 'F8F8F2' },
      { token: 'operator', foreground: 'FF79C6' },
      { token: 'type', foreground: '8BE9FD' },
      { token: 'identifier', foreground: 'F8F8F2' },
    ],
    colors: {
      'editor.background': '#282A36',
      'editor.foreground': '#F8F8F2',
      'editorLineNumber.foreground': '#6272A4',
      'editorLineNumber.activeForeground': '#F8F8F2',
      'editorCursor.foreground': '#F8F8F2',
      'editor.selectionBackground': '#44475ACC',
      'editor.inactiveSelectionBackground': '#44475A99',
      'editor.lineHighlightBackground': '#44475A66',
      'editorLineNumber.border': '#00000000',
      'editorGutter.background': '#282A36',
      'editorIndentGuide.background1': '#44475A55',
      'editorIndentGuide.activeBackground1': '#6272A4AA',
      'editorWhitespace.foreground': '#44475A77',
      'editorBracketMatch.background': '#44475A66',
      'editorBracketMatch.border': '#8BE9FD88',
      'editorWidget.background': '#1F2230',
      'editorWidget.border': '#44475A',
      'editorSuggestWidget.background': '#1F2230',
      'editorSuggestWidget.border': '#44475A',
      'editorSuggestWidget.foreground': '#F8F8F2',
      'editorSuggestWidget.selectedBackground': '#44475A',
      'minimap.background': '#282A36',
      'scrollbarSlider.background': '#6272A455',
      'scrollbarSlider.hoverBackground': '#6272A488',
      'scrollbarSlider.activeBackground': '#8BE9FD88',
    },
  })
}

function defineLeadFlowResendDark(monaco: typeof Monaco) {
  monaco.editor.defineTheme('leadflow-resend-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'FFFFFF', background: '05050A' },
      { token: 'comment', foreground: '8B8B8B' },
      { token: 'keyword', foreground: '99C592' },
      { token: 'string', foreground: 'FFC799' },
      { token: 'number', foreground: 'FFC799' },
      { token: 'tag', foreground: 'FFFFFF' },
      { token: 'metatag', foreground: 'FFFFFF' },
      { token: 'attribute.name', foreground: '99FFE4' },
      { token: 'attribute.value', foreground: 'FFC799' },
      { token: 'delimiter', foreground: 'FFFFFF' },
      { token: 'operator', foreground: 'FFFFFF' },
      { token: 'type', foreground: '99FFE4' },
      { token: 'identifier', foreground: 'FFFFFF' },
    ],
    colors: {
      'editor.background': '#05050A',
      'editor.foreground': '#FFFFFF',
      'editorLineNumber.foreground': '#505050',
      'editorLineNumber.activeForeground': '#FFFFFF',
      'editorCursor.foreground': '#61A8F8',
      'editor.selectionBackground': '#FFFFFF25',
      'editor.inactiveSelectionBackground': '#FFFFFF18',
      'editor.lineHighlightBackground': '#05050A',
      'editorLineNumber.border': '#00000000',
      'editorGutter.background': '#05050A',
      'editorIndentGuide.background1': '#23232B',
      'editorIndentGuide.activeBackground1': '#3A3A44',
      'editorWhitespace.foreground': '#2A2A33',
      'editorBracketMatch.background': '#111117',
      'editorBracketMatch.border': '#61A8F855',
      'editorWidget.background': '#0D0D12',
      'editorWidget.border': '#1D1D26',
      'editorSuggestWidget.background': '#0D0D12',
      'editorSuggestWidget.border': '#1D1D26',
      'editorSuggestWidget.foreground': '#FFFFFF',
      'editorSuggestWidget.selectedBackground': '#171721',
      'minimap.background': '#05050A',
      'scrollbarSlider.background': '#50505055',
      'scrollbarSlider.hoverBackground': '#6A6A6A88',
      'scrollbarSlider.activeBackground': '#8A8A8AAA',
    },
  })
}

export function MonacoCodeEditor({
  value,
  onChange,
  language = 'html',
  height = '100%',
  readOnly = false,
  className,
  options,
  themeVariant = 'auto',
  placeholder,
  editorKey,
  onMount,
}: MonacoCodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<MonacoEditorNamespace.IStandaloneCodeEditor | null>(null)
  const [containerHeight, setContainerHeight] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)

  const { resolvedTheme } = useTheme()
  const editorTheme =
    themeVariant === 'dracula'
      ? 'leadflow-dracula'
      : themeVariant === 'resend-dark'
        ? 'leadflow-resend-dark'
        : resolvedTheme === 'light'
          ? 'vs'
          : 'vs-dark'

  const mergedOptions = useMemo<MonacoEditorNamespace.IStandaloneEditorConstructionOptions>(
    () => ({
      minimap: { enabled: false },
      wordWrap: 'on',
      fontSize: 14,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      padding: { top: 12, bottom: 12 },
      lineNumbersMinChars: 3,
      ...options,
      readOnly,
    }),
    [options, readOnly]
  )

  const handleBeforeMount = useCallback((monaco: typeof Monaco) => {
    defineLeadFlowDracula(monaco)
    defineLeadFlowResendDark(monaco)
  }, [])

  const handleMount = useCallback(
    (editor: MonacoEditorNamespace.IStandaloneCodeEditor, monaco: typeof Monaco) => {
      editorRef.current = editor
      onMount?.(editor, monaco)
    },
    [onMount]
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const updateSize = () => {
      const rect = el.getBoundingClientRect()
      setContainerHeight(Math.floor(rect.height))
      setContainerWidth(Math.floor(rect.width))
    }

    updateSize()
    const ro = new ResizeObserver(() => updateSize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    return () => {
      editorRef.current = null
    }
  }, [])

  const loadingBackgroundClass =
    themeVariant === 'dracula'
      ? 'bg-[#282A36]'
      : themeVariant === 'resend-dark'
        ? 'bg-[#05050A]'
        : 'bg-[#111111]'
  const shouldShowPlaceholder = !readOnly && value.trim().length === 0 && Boolean(placeholder)
  const isContainerReady = containerHeight > 0 && containerWidth > 0
  const resolvedHeight = typeof height === 'number' ? height : containerHeight

  return (
    <div ref={containerRef} className={cn('relative h-full w-full', className)}>
      {isContainerReady ? (
        <div className="absolute inset-0">
          <MonacoEditor
            key={editorKey}
            beforeMount={handleBeforeMount}
            height={resolvedHeight}
            width={containerWidth}
            language={language}
            value={value}
            theme={editorTheme}
            options={mergedOptions}
            loading={<Skeleton className={cn('h-full w-full', loadingBackgroundClass)} />}
            onChange={(nextValue) => onChange(nextValue ?? '')}
            onMount={handleMount}
          />
        </div>
      ) : (
        <Skeleton className={cn('h-full w-full', loadingBackgroundClass)} />
      )}
      {shouldShowPlaceholder ? (
        <div className="pointer-events-none absolute left-[3.25rem] top-3 z-10 text-[14px] text-[#8B8B8B]">
          {placeholder}
        </div>
      ) : null}
    </div>
  )
}
