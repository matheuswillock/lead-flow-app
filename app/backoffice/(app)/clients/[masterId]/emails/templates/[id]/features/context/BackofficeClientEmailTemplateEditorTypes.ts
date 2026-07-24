export type StudioEmailTemplateDetail = {
  id: string
  name: string
  subject: string
  html: string | null
  managedByCorretorStudio?: boolean
}

export type BackofficeClientEmailTemplateEditorState = {
  loading: boolean
  saving: boolean
  template: StudioEmailTemplateDetail | null
  name: string
  subject: string
  html: string
  error: string | null
}

export type BackofficeClientEmailTemplateEditorActions = {
  load: () => Promise<void>
  save: () => Promise<void>
  setName: (value: string) => void
  setSubject: (value: string) => void
  setHtml: (value: string) => void
}

export type BackofficeClientEmailTemplateEditorContextValue =
  BackofficeClientEmailTemplateEditorState & BackofficeClientEmailTemplateEditorActions
