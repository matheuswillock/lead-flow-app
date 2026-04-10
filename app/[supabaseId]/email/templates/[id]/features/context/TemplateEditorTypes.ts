import { Template } from '../../../features/context/TemplatesTypes'

export type { Template }

export type EditorMode = 'maily' | 'html'

export interface TemplateEditorState {
  template: Template | null
  mode: EditorMode
  name: string
  subject: string
  previewText: string
  mailyJson: unknown | null
  html: string
  loading: boolean
  saving: boolean
  error: string | null
}
