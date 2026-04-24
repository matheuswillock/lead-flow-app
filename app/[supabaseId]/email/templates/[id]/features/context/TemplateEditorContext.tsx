'use client'

import type { Editor as TiptapEditor } from '@tiptap/core'
import { createContext, ReactNode, useContext } from 'react'
import { Template, EditorMode, TemplateEditorState } from './TemplateEditorTypes'
import { useTemplateEditor } from './TemplateEditorHook'
import type {
  GeneratedTemplateXAsset,
  GenerateTemplateXAssetInput,
  UploadedTemplateImageAsset,
} from '../services/ITemplateEditorAssetService'

interface ITemplateEditorContext extends TemplateEditorState {
  setMode: (mode: EditorMode) => void
  setName: (name: string) => void
  setSubject: (subject: string) => void
  setPreviewText: (previewText: string) => void
  setMailyJson: (json: unknown) => void
  setHtml: (html: string) => void
  setVisualEditorInstance: (editor: TiptapEditor | null) => void
  isTemplatePickerOpen: boolean
  openTemplatePicker: () => void
  closeTemplatePicker: () => void
  applyTemplate: (templateId: string) => Promise<void>
  uploadEditorImage: (file: File) => Promise<UploadedTemplateImageAsset>
  generateTemplateXAsset: (input: GenerateTemplateXAssetInput) => Promise<GeneratedTemplateXAsset>
  handleSave: () => Promise<void>
}

const TemplateEditorContext = createContext<ITemplateEditorContext | undefined>(undefined)

interface TemplateEditorProviderProps {
  children: ReactNode
  supabaseId: string
  templateId: string
}

export function TemplateEditorProvider({
  children,
  supabaseId,
  templateId,
}: TemplateEditorProviderProps) {
  const value = useTemplateEditor(supabaseId, templateId)

  return (
    <TemplateEditorContext.Provider value={value}>
      {children}
    </TemplateEditorContext.Provider>
  )
}

export function useTemplateEditorContext(): ITemplateEditorContext {
  const context = useContext(TemplateEditorContext)
  if (!context) {
    throw new Error('useTemplateEditorContext must be used within a TemplateEditorProvider')
  }
  return context
}

export type { Template }
