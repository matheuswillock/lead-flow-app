type PublicFormStatus = "draft" | "published" | "archived"

export function canRequestPublicFormApproval(input: {
  canEdit: boolean
  approvalRequired: boolean
  status: PublicFormStatus
}) {
  return input.canEdit && input.approvalRequired && input.status !== "archived" && input.status !== "published"
}
