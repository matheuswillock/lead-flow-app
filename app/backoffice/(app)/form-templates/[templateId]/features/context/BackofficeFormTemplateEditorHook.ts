"use client"

import { useMemo } from "react"
import type { LeadCustomFieldDefinitionDTO } from "@/lib/leadCustomFields/types"
import type { PublicFormWizardHost } from "@/app/[supabaseId]/forms/features/container/PublicFormWizard"
import type { IBackofficeFormTemplatesService } from "../services/IBackofficeFormTemplatesService"
import type { BackofficeFormTemplateEditorContextValue } from "./BackofficeFormTemplateEditorTypes"

export function useBackofficeFormTemplateEditor(
  templateId: string | undefined,
  service: IBackofficeFormTemplatesService,
): BackofficeFormTemplateEditorContextValue {
  const host = useMemo<PublicFormWizardHost>(
    () => ({
      mode: "catalog-template",
      listHref: "/backoffice/form-templates",
      formHref: (id) => `/backoffice/form-templates/${id}`,
      previewHref: (id) => `/backoffice/form-templates/${id}?preview=1`,
      loadContext: async () => {
        const context = await service.getWizardContext()
        return {
          members: context.members as Array<{
            profileId: string
            name: string
            functions: ("SDR" | "CLOSER")[]
          }>,
          customFields: context.customFields as LeadCustomFieldDefinitionDTO[],
          healthPlans: context.healthPlans,
          settings: context.settings,
        }
      },
      getForm: async (id) => {
        const record = await service.get(id)
        return { ...record.draft, id: record.id }
      },
      getTemplate: async () => {
        throw new Error("Templates de catálogo não usam slug de bootstrap")
      },
      getTemplateRecord: async (id) => {
        const record = await service.get(id)
        return {
          id: record.id,
          slug: record.slug,
          sortOrder: record.sortOrder,
          description: record.description,
          draft: record.draft,
        }
      },
      save: async (id, input) => {
        if (!id) throw new Error("Use saveTemplate para criar templates")
        const updated = await service.update(id, {
          name: input.name,
          description: input.description ?? null,
          draft: input,
        })
        return { ...updated.draft, id: updated.id }
      },
      saveTemplate: async (id, input, meta) => {
        if (id) {
          const updated = await service.update(id, {
            name: input.name,
            description: meta.description ?? input.description ?? null,
            sortOrder: meta.sortOrder,
            draft: input,
          })
          return { id: updated.id }
        }
        const slug = meta.slug?.trim()
        if (!slug) throw new Error("Informe o slug do template")
        const created = await service.create({
          slug,
          name: input.name,
          description: meta.description ?? input.description ?? null,
          sortOrder: meta.sortOrder,
          draft: input,
        })
        return { id: created.id }
      },
      publish: async (id) => {
        await service.publish(id)
      },
      publishTemplate: async (id) => {
        await service.publish(id)
      },
    }),
    [service],
  )

  return { templateId, host }
}
