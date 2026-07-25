"use client"

import { useMemo } from "react"
import type { LeadCustomFieldDefinitionDTO } from "@/lib/leadCustomFields/types"
import type { PublicFormWizardHost } from "@/app/[supabaseId]/forms/features/container/PublicFormWizard"
import type { IBackofficeClientPublicFormEditorService } from "../services/IBackofficeClientPublicFormEditorService"
import type { BackofficeClientPublicFormEditorContextValue } from "./BackofficeClientPublicFormEditorTypes"

export function useBackofficeClientPublicFormEditor(
  masterId: string,
  teamId: string | null,
  formId: string | undefined,
  service: IBackofficeClientPublicFormEditorService
): BackofficeClientPublicFormEditorContextValue {
  const host = useMemo<PublicFormWizardHost | null>(() => {
    if (!teamId) return null
    const listHref = `/backoffice/clients/${masterId}?tab=forms&teamId=${teamId}`
    return {
      listHref,
      formHref: (id) => `/backoffice/clients/${masterId}/forms/${id}?teamId=${teamId}`,
      previewHref: (id) =>
        `/backoffice/clients/${masterId}/forms/${id}?teamId=${teamId}&preview=1`,
      loadContext: async () => {
        const context = await service.getWizardContext(masterId, teamId)
        return {
          members: context.members,
          customFields: context.customFields as LeadCustomFieldDefinitionDTO[],
          healthPlans: context.healthPlans,
          settings: context.settings,
        }
      },
      getForm: (id) => service.get(masterId, teamId, id),
      save: (id, input) =>
        id
          ? service.update(masterId, teamId, id, input)
          : service.create(masterId, teamId, input),
      publish: async (id) => {
        await service.publish(masterId, teamId, id)
      },
    }
  }, [masterId, service, teamId])

  return {
    masterId,
    teamId,
    formId,
    host,
    error: teamId ? null : "Selecione um time para editar formulários",
  }
}
