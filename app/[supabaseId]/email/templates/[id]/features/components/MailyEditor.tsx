'use client'

import type { HTMLAttributes, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Editor } from '@maily-to/core'
import type { Editor as TiptapEditor } from '@tiptap/core'
import { FileText, GripVertical, ImageIcon, Type, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { EmailCanvasFrame } from './EmailCanvasFrame'
import type { MailyPageStyle } from '../utils/emailPageStyle'

type MailyTransitionDirection = 'enter-html' | 'return-to-canvas' | 'none'

const STRUCTURAL_NODE_TYPES = new Set(['doc', 'globalContent', 'container', 'paragraph'])

function hasEditorContent(tree: unknown): boolean {
  if (!tree || typeof tree !== 'object') return false

  const stack: unknown[] = [tree]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || typeof current !== 'object') continue

    const node = current as {
      type?: string
      text?: string
      content?: unknown[]
    }

    if (node.type === 'text' && typeof node.text === 'string' && node.text.trim().length > 0) {
      return true
    }

    if (node.type && !STRUCTURAL_NODE_TYPES.has(node.type) && node.type !== 'text') {
      return true
    }

    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        stack.push(child)
      }
    }
  }

  return false
}

function FloatingToolButton({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-xl text-white/62 transition-colors hover:bg-[#171a21] hover:text-white/90',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function FloatingGridIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={cn('h-4 w-4', className)}
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

function VariableGlyphIcon() {
  return <span className="text-[11px] font-semibold tracking-[-0.03em] text-current">(x)</span>
}

function KeyChip({ children }: { children: ReactNode }) {
  return (
    <Badge
      variant="secondary"
      className="h-5 rounded-md border border-[#d8d8de] bg-[#f1f1f4] px-1.5 text-[11px] font-medium text-zinc-600"
    >
      {children}
    </Badge>
  )
}

interface MailyEditorProps {
  value: unknown | null
  subject: string
  previewText: string
  pageStyle: MailyPageStyle
  transitionDirection: MailyTransitionDirection
  onChangeSubject: (value: string) => void
  onChangePreviewText: (value: string) => void
  onChange: (json: unknown, html: string) => void
}

export function MailyEditor({
  value,
  subject,
  previewText,
  pageStyle,
  transitionDirection,
  onChangeSubject,
  onChangePreviewText,
  onChange,
}: MailyEditorProps) {
  const shouldAnimateReturn = transitionDirection === 'return-to-canvas'
  const [isExpanded, setIsExpanded] = useState(!shouldAnimateReturn)
  const showCommandsHelper = !hasEditorContent(value)

  useEffect(() => {
    if (!shouldAnimateReturn) {
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
  }, [shouldAnimateReturn, transitionDirection])

  return (
    <div className="relative flex h-full min-h-0 flex-1 overflow-hidden bg-[#0b0b0f]">
      <EmailCanvasFrame
        subject={subject}
        previewText={previewText}
        pageStyle={pageStyle}
        onChangeSubject={onChangeSubject}
        onChangePreviewText={onChangePreviewText}
        surface="visual"
        style={{
          width: isExpanded ? '100%' : '72%',
          opacity: isExpanded ? 1 : 0.9,
          transform: isExpanded ? 'translateX(0)' : 'translateX(6%)',
          transition: shouldAnimateReturn
            ? 'width 320ms ease-out, opacity 320ms ease-out, transform 320ms ease-out'
            : undefined,
        }}
      >
        {showCommandsHelper ? (
          <div className="px-7 py-4 text-[13px] text-zinc-400">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-zinc-400" />
              <span>Press '/' for commands</span>
            </div>
            <div className="mt-3 flex flex-col gap-2 pl-6 text-[14px] text-zinc-400">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-zinc-300/80" />
                <span>Pick a template</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Upload className="h-3.5 w-3.5 text-zinc-300/80" />
                <span>Upload HTML or</span>
                <KeyChip>Ctrl</KeyChip>
                <KeyChip>V</KeyChip>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 border-t px-4 pb-6">
          <div
            className={cn(
              'maily-canvas-host flex h-full min-h-0 flex-1 flex-col overflow-hidden',
              '[&_.editor-scrollable-container]:!h-full',
              '[&_.editor-scrollable-container]:!min-h-full',
              '[&_.editor-scrollable-container]:!max-h-none',
              '[&_.editor-scrollable-container]:!overflow-y-auto',
              '[&_.editor-scrollable-container]:!rounded-none',
              '[&_.editor-scrollable-container]:!border-x-0',
              '[&_.editor-scrollable-container]:!border-b-0',
              '[&_.editor-scrollable-container]:!w-full',
              '[&_.editor-scrollable-container]:!pt-6'
            )}
          >
            <Editor
              contentJson={(value as never) ?? undefined}
              onUpdate={(editor: TiptapEditor) => {
                const json = editor.getJSON()
                const html = editor.getHTML()
                onChange(json, html)
              }}
              config={{
                hasMenuBar: false,
              }}
            />
          </div>
        </div>
      </EmailCanvasFrame>

      <div className="absolute left-6 top-1/2 hidden -translate-y-1/2 rounded-[22px] border border-[#1c2027] bg-[#111117]/96 p-1 shadow-[0_20px_35px_rgba(0,0,0,0.42)] lg:block">
        <div className="flex flex-col gap-1">
          <FloatingToolButton title="Texto">
            <Type className="h-4 w-4" />
          </FloatingToolButton>
          <FloatingToolButton title="Imagem">
            <ImageIcon className="h-4 w-4" />
          </FloatingToolButton>
          <FloatingToolButton title="Grade">
            <FloatingGridIcon />
          </FloatingToolButton>
          <FloatingToolButton title="Variáveis">
            <VariableGlyphIcon />
          </FloatingToolButton>
        </div>
      </div>
    </div>
  )
}
