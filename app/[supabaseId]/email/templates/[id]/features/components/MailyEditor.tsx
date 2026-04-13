'use client'

import type { HTMLAttributes, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Editor } from '@maily-to/core'
import type { Editor as TiptapEditor } from '@tiptap/core'
import { FileText, GripVertical, ImageIcon, Type, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { EmailCanvasFrame } from './EmailCanvasFrame'
import { createResendSlashCommandExtension, resendMailyBlocks } from './mailyEditorSlash'
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
  const [editorInstance, setEditorInstance] = useState<TiptapEditor | null>(null)
  const [isEditorEmpty, setIsEditorEmpty] = useState(() => !hasEditorContent(value))
  const showCommandsHelper = editorInstance ? isEditorEmpty : !hasEditorContent(value)
  const slashExtensions = useMemo(() => [createResendSlashCommandExtension(resendMailyBlocks)], [])

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

  const syncEditorEmptyState = (editor: TiptapEditor) => {
    setEditorInstance(editor)
    setIsEditorEmpty(editor.isEmpty)
  }

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
        <div className="relative flex min-h-0 flex-1 border-t px-4 pb-6">
          {showCommandsHelper ? (
            <div className="pointer-events-none absolute inset-x-0 top-4 z-10 px-10 text-[13px] text-zinc-400">
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
          <div
            className={cn(
              'maily-canvas-host flex h-full min-h-0 flex-1 flex-col overflow-hidden',
              '[&_.editor-scrollable-container]:!h-full',
              '[&_.editor-scrollable-container]:!min-h-full',
              '[&_.editor-scrollable-container]:!max-h-none',
              '[&_.editor-scrollable-container]:!overflow-y-auto',
              '[&_.editor-scrollable-container]:!rounded-none',
              '[&_.editor-scrollable-container]:!border-0',
              '[&_.editor-scrollable-container]:!w-full',
              '[&_.editor-scrollable-container]:!pt-0'
            )}
          >
            <Editor
              contentJson={(value as never) ?? undefined}
              blocks={resendMailyBlocks}
              extensions={slashExtensions}
              onCreate={(editor: TiptapEditor) => {
                syncEditorEmptyState(editor)
              }}
              onUpdate={(editor: TiptapEditor) => {
                syncEditorEmptyState(editor)
                const json = editor.getJSON()
                const html = editor.getHTML()
                onChange(json, html)
              }}
              config={{
                hasMenuBar: false,
                hideContextMenu: false,
                wrapClassName: 'h-full',
                bodyClassName: '!mt-0 !h-full !rounded-none !border-0 !bg-transparent !px-0 !pt-3 !pb-8',
                contentClassName: 'min-h-full pl-9 pr-6 pt-1',
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

      <style jsx global>{`
        .maily-canvas-host .mly-editor {
          height: 100%;
        }

        .maily-canvas-host .mly-editor .ProseMirror {
          min-height: 100%;
          padding-bottom: 48px;
        }

        .maily-canvas-host .mly-editor .ProseMirror > * {
          scroll-margin-top: 32px;
        }

        .maily-canvas-host [data-tippy-root] .mly\\:flex.mly\\:items-center.mly\\:pr-1\\.5 {
          gap: 4px;
          padding-right: 0;
          transform: translateX(-8px);
        }

        .maily-canvas-host [data-tippy-root] .mly\\:cursor-grab {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px !important;
          height: 26px !important;
          border: 1px solid rgba(221, 221, 227, 0.92);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 10px 25px rgba(17, 24, 39, 0.14);
          color: #71717a;
        }

        .maily-canvas-host [data-tippy-root] .mly\\:cursor-grab:hover {
          background: #ffffff;
          color: #111827;
        }

        .maily-canvas-host [data-tippy-root] .mly\\:cursor-grab svg {
          width: 15px;
          height: 15px;
        }

        .maily-canvas-host [data-tippy-root] .mly\\:relative.mly\\:flex.mly\\:flex-col {
          display: flex;
          flex-direction: row;
        }

        .tippy-box[data-theme~='maily-slash'] {
          border: 1px solid rgba(39, 39, 42, 0.92);
          border-radius: 14px;
          background: #09090b;
          box-shadow: 0 24px 40px rgba(0, 0, 0, 0.38);
          color: #f4f4f5;
        }

        .tippy-box[data-theme~='maily-slash'] .tippy-content {
          padding: 0;
        }

        .maily-slash-menu {
          width: min(320px, calc(100vw - 32px));
          overflow: hidden;
          border-radius: 14px;
          background: #09090b;
        }

        .maily-slash-menu__scroll {
          max-height: 332px;
          overflow-y: auto;
          padding: 8px;
        }

        .maily-slash-menu__group + .maily-slash-menu__group {
          margin-top: 10px;
        }

        .maily-slash-menu__label {
          padding: 0 8px 8px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: #a1a1aa;
          text-transform: uppercase;
        }

        .maily-slash-menu__items {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .maily-slash-menu__item {
          display: flex;
          width: 100%;
          align-items: center;
          gap: 10px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          padding: 10px 12px;
          text-align: left;
          color: #fafafa;
          transition: background-color 160ms ease, color 160ms ease;
        }

        .maily-slash-menu__item[data-selected='true'] {
          background: #18181b;
        }

        .maily-slash-menu__item:hover {
          background: #18181b;
        }

        .maily-slash-menu__icon {
          display: inline-flex;
          min-width: 18px;
          align-items: center;
          justify-content: center;
          color: #d4d4d8;
        }

        .maily-slash-menu__title {
          font-size: 15px;
          line-height: 1.15;
          color: inherit;
        }

        .maily-slash-menu__footer {
          display: flex;
          align-items: center;
          gap: 10px;
          border-top: 1px solid rgba(39, 39, 42, 0.9);
          padding: 11px 14px 12px;
          color: #a1a1aa;
        }

        .maily-slash-menu__footer-text {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          line-height: 1;
        }

        .maily-slash-menu__kbd {
          display: inline-flex;
          min-width: 24px;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(63, 63, 70, 0.96);
          border-radius: 6px;
          background: #111114;
          padding: 4px 6px;
          font-size: 10px;
          font-weight: 600;
          color: #e4e4e7;
        }

        .maily-slash-menu__dot {
          color: #52525b;
        }
      `}</style>
    </div>
  )
}
