import { prisma } from "@/app/api/infra/data/prisma"

const FORM_URL_PATTERN = /\/forms\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi

export type LinkedTemplateForm = {
  id: string
  name: string
  publicId: string
}

export function extractFormPublicIdsFromHtml(html: string | null | undefined): string[] {
  if (!html) return []

  const ids = new Set<string>()
  for (const match of html.matchAll(FORM_URL_PATTERN)) {
    const publicId = match[1]
    if (publicId) ids.add(publicId)
  }
  return Array.from(ids)
}

export async function detectLinkedFormFromTemplateHtml(
  teamId: string,
  html: string | null | undefined
): Promise<LinkedTemplateForm | null> {
  const publicIds = extractFormPublicIdsFromHtml(html)
  if (publicIds.length === 0) return null

  const form = await prisma.publicForm.findFirst({
    where: {
      teamId,
      publicId: { in: publicIds },
      status: "published",
      approvalStatus: "approved",
    },
    select: {
      id: true,
      name: true,
      publicId: true,
    },
    orderBy: { updatedAt: "desc" },
  })

  return form ?? null
}
