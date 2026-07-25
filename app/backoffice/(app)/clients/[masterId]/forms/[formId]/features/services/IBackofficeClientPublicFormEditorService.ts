import type { PublicFormDraftInput } from "@/lib/public-forms/types"
import type {
  StudioPublicFormDetail,
  StudioPublicFormWizardContext,
} from "../../../../features/services/IBackofficeStudioPublicFormsService"

export interface IBackofficeClientPublicFormEditorService {
  getWizardContext(masterId: string, teamId: string): Promise<StudioPublicFormWizardContext>
  get(masterId: string, teamId: string, formId: string): Promise<StudioPublicFormDetail>
  create(
    masterId: string,
    teamId: string,
    input: PublicFormDraftInput
  ): Promise<StudioPublicFormDetail>
  update(
    masterId: string,
    teamId: string,
    formId: string,
    input: PublicFormDraftInput
  ): Promise<StudioPublicFormDetail>
  publish(masterId: string, teamId: string, formId: string): Promise<unknown>
}
