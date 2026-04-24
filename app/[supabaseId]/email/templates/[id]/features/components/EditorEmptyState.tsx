'use client'

import type { ReactNode } from 'react'
import { FileText, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface EditorEmptyStateProps {
  onPickTemplate: () => void
  onRequestUpload: () => void
  className?: string
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

export function EditorEmptyState({
  onPickTemplate,
  onRequestUpload,
  className,
}: EditorEmptyStateProps) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 z-10 select-none text-zinc-400',
        className
      )}
    >
      <p className="pl-9 pr-6 pt-1 text-[14px] leading-[155%]">Press '/' for commands</p>
      <div className="pointer-events-auto mt-2 flex flex-col gap-1 pl-9 text-[14px] text-zinc-400">
        <button
          type="button"
          onClick={onPickTemplate}
          aria-label="Escolher um template salvo"
          className="group flex w-fit items-center gap-2 text-[14px] text-zinc-400 transition-transform transition-colors hover:text-zinc-600 active:scale-[0.98]"
        >
          <FileText className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
          <span>Pick a template</span>
        </button>

        <button
          type="button"
          onClick={onRequestUpload}
          aria-label="Importar um arquivo HTML para o editor"
          className="group flex w-fit items-center gap-2 text-[14px] text-zinc-400 transition-transform transition-colors hover:text-zinc-600 active:scale-[0.98]"
        >
          <Upload className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
          <span>Upload HTML or</span>
          <KeyChip>Ctrl</KeyChip>
          <KeyChip>V</KeyChip>
        </button>
      </div>
    </div>
  )
}
