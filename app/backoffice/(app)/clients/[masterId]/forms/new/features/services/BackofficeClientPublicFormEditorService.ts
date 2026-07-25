import type { PublicFormDraftInput } from "@/lib/public-forms/types"
import { backofficeStudioPublicFormsService } from "../../../../features/services/BackofficeStudioPublicFormsService"
import type { IBackofficeClientPublicFormEditorService } from "./IBackofficeClientPublicFormEditorService"

export class BackofficeClientPublicFormEditorService
  implements IBackofficeClientPublicFormEditorService
{
  getWizardContext(masterId: string, teamId: string) {
    return backofficeStudioPublicFormsService.getWizardContext(masterId, teamId)
  }

  get(masterId: string, teamId: string, formId: string) {
    return backofficeStudioPublicFormsService.get(masterId, teamId, formId)
  }

  create(masterId: string, teamId: string, input: PublicFormDraftInput) {
    return backofficeStudioPublicFormsService.create(masterId, teamId, input)
  }

  update(masterId: string, teamId: string, formId: string, input: PublicFormDraftInput) {
    return backofficeStudioPublicFormsService.update(masterId, teamId, formId, input)
  }

  publish(masterId: string, teamId: string, formId: string) {
    return backofficeStudioPublicFormsService.action(masterId, teamId, formId, "publish")
  }
}

export const backofficeClientPublicFormEditorService =
  new BackofficeClientPublicFormEditorService()
