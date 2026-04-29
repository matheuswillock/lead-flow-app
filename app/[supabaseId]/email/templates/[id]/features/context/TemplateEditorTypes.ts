export interface Template {
  id: string;
  name: string;
  subject: string;
  previewText: string | null;
  mailyJson: unknown | null;
  html: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateEditorDraft {
  name: string;
  subject: string;
  previewText: string;
  html: string;
  mailyJson: unknown | null;
}

export interface TemplateEditorState {
  template: Template | null;
  draft: TemplateEditorDraft;
  loading: boolean;
  saving: boolean;
  error: string | null;
  isDirty: boolean;
  isNewTemplate: boolean;
}
