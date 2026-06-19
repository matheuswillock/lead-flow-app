export type TemplateStatus = "draft" | "published";
export type TemplateApprovalStatus = "pending_approval" | "approved" | "rejected";

export interface TemplateVariable {
  key: string;
  type: "string" | "number";
  fallbackValue?: string | null;
  reviewStatus?: "pending" | "reviewed";
}

export interface Template {
  id: string;
  versionGroupId: string;
  versionNumber: number;
  isCurrentPublished: boolean;
  name: string;
  subject: string;
  previewText: string | null;
  mailyJson: unknown | null;
  html: string | null;
  variables: TemplateVariable[] | null;
  status: TemplateStatus;
  approvalStatus: TemplateApprovalStatus;
  reviewNote: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  history?: TemplateHistoryItem[];
}

export interface TemplateHistoryItem {
  id: string;
  eventType: string;
  description: string | null;
  metadata: unknown | null;
  createdAt: string;
  actor: {
    id: string;
    fullName: string | null;
    email: string | null;
  } | null;
}

export interface TemplateEditorDraft {
  name: string;
  subject: string;
  previewText: string;
  html: string;
  mailyJson: unknown | null;
  variables: TemplateVariable[];
}

export interface TemplateEditorState {
  template: Template | null;
  draft: TemplateEditorDraft;
  loading: boolean;
  saving: boolean;
  error: string | null;
  isDirty: boolean;
  isNewTemplate: boolean;
  templateApprovalRequired: boolean;
}
