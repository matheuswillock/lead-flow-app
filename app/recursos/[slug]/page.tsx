import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createPublicPageMetadata } from "@/lib/metadata/policies"
import {
  getPublicResourceBySlug,
  getPublicResourcePath,
  getPublicResourceSlugs,
  isKnownPublicResourceSlug,
} from "@/lib/seo/publicResources"
import { ResourceDetailProvider } from "./features/context/ResourceDetailContext"
import { ResourceDetailContainer } from "./features/container/ResourceDetailContainer"

interface ResourceDetailPageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return getPublicResourceSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: ResourceDetailPageProps): Promise<Metadata> {
  const { slug } = await params
  const resource = getPublicResourceBySlug(slug)

  if (!resource) {
    return createPublicPageMetadata({
      title: "Recurso nao encontrado | Corretor Studio",
      description: "O recurso solicitado nao foi encontrado.",
      canonicalPath: "/recursos",
      keywords: ["corretor studio", "recursos"],
    })
  }

  return createPublicPageMetadata({
    title: resource.title,
    description: resource.description,
    canonicalPath: getPublicResourcePath(resource.slug),
    keywords: resource.keywords,
    ogType: "article",
    publishedTime: resource.publishedTime,
    modifiedTime: resource.modifiedTime,
  })
}

export default async function ResourceDetailPage({ params }: ResourceDetailPageProps) {
  const { slug } = await params

  if (!isKnownPublicResourceSlug(slug)) {
    notFound()
  }

  return (
    <ResourceDetailProvider slug={slug}>
      <ResourceDetailContainer />
    </ResourceDetailProvider>
  )
}
