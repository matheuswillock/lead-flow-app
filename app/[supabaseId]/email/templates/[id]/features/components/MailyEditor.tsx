'use client'

import { Editor } from '@maily-to/core'
import type { Editor as TiptapEditor } from '@tiptap/core'

interface MailyEditorProps {
  value: unknown | null
  subject: string
  previewText: string
  onChangeSubject: (v: string) => void
  onChangePreviewText: (v: string) => void
  onChange: (json: unknown, html: string) => void
}

export function MailyEditor({
  value,
  subject,
  previewText,
  onChangeSubject,
  onChangePreviewText,
  onChange,
}: MailyEditorProps) {
  return (
    <div className="h-full overflow-auto flex justify-center py-8 px-4">
      <div
        className="w-full max-w-[640px] bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden"
        style={{ colorScheme: 'light', color: '#09090b' }}
      >
        {/* Subject and preview text — inside white canvas */}
        <div className="border-b border-zinc-200 px-6 pt-5 pb-4 space-y-3">
          <div className="flex items-baseline gap-3">
            <span className="text-xs font-medium text-zinc-400 w-24 shrink-0">Assunto</span>
            <input
              value={subject}
              onChange={(e) => onChangeSubject(e.target.value)}
              placeholder="Assunto do email"
              className="flex-1 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 bg-transparent"
            />
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-xs font-medium text-zinc-400 w-24 shrink-0">Pré-visualização</span>
            <input
              value={previewText}
              onChange={(e) => onChangePreviewText(e.target.value)}
              placeholder="Texto exibido antes de abrir o email"
              className="flex-1 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 bg-transparent"
            />
          </div>
        </div>

        {/* Maily editor body */}
        <div className="flex-1 min-h-[400px]">
          <Editor
            contentJson={value as never ?? undefined}
            onUpdate={(editor: TiptapEditor) => {
              const json = editor.getJSON()
              const html = editor.getHTML()
              onChange(json, html)
            }}
          />
        </div>
      </div>
    </div>
  )
}
