import type { CreateTemplateOptions, Template, UpdateTemplateOptions } from "resend"
import { assertResend } from "@/lib/email"

export type EmailTemplateListItem = {
  id: string
  name: string
  alias: string | null
  status: "draft" | "published"
  published_at: string | null
  created_at: string
  updated_at: string
}

export class BackofficeEmailTemplatesService {
  async list(): Promise<EmailTemplateListItem[]> {
    const r = assertResend()
    const { data, error } = await r.templates.list()
    if (error) throw new Error(error.message)
    return (data?.data ?? []) as EmailTemplateListItem[]
  }

  async create(payload: CreateTemplateOptions): Promise<{ id: string }> {
    const r = assertResend()
    const { data, error } = await r.templates.create(payload)
    if (error) throw new Error(error.message)
    return data as { id: string }
  }

  async get(id: string): Promise<Template> {
    const r = assertResend()
    const { data, error } = await r.templates.get(id)
    if (error) throw new Error(error.message)
    return data as Template
  }

  async update(id: string, payload: UpdateTemplateOptions): Promise<{ id: string }> {
    const r = assertResend()
    const { data, error } = await r.templates.update(id, payload)
    if (error) throw new Error(error.message)
    return data as { id: string }
  }

  async remove(id: string): Promise<void> {
    const r = assertResend()
    const { error } = await r.templates.remove(id)
    if (error) throw new Error(error.message)
  }

  async publish(id: string): Promise<{ id: string }> {
    const r = assertResend()
    const { data, error } = await r.templates.publish(id)
    if (error) throw new Error(error.message)
    return data as { id: string }
  }

  async duplicate(id: string): Promise<{ id: string }> {
    const r = assertResend()
    const { data, error } = await r.templates.duplicate(id)
    if (error) throw new Error(error.message)
    return data as { id: string }
  }
}

export const backofficeEmailTemplatesService = new BackofficeEmailTemplatesService()
