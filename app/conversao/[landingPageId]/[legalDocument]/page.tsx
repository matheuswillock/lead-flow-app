import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { landingPageUseCase } from "@/app/api/useCases/landingPages/LandingPageUseCase"
import { isLandingPageServableOnHost } from "@/lib/landing-pages/landing-page-host-tenancy"
import { resolveLegacyPublicHostRedirect } from "@/lib/public-studio/team-studio-domain-tenancy"
import type { LandingPageSnapshot } from "@/lib/landing-pages/types"
import { LegalPageContainer } from "../features/container/LegalPageContainer"
import { legalPageService } from "../features/services/LegalPageService"
import type { LegalDocumentKind } from "../features/context/LegalPageTypes"

const kinds: LegalDocumentKind[] = ["privacidade", "cookies", "termos"]
async function getDocument(params: Promise<{ landingPageId: string; legalDocument: string }>) { const { landingPageId, legalDocument } = await params; if (!kinds.includes(legalDocument as LegalDocumentKind)) notFound(); const host = (await headers()).get("host"); const redirectBase = await resolveLegacyPublicHostRedirect({ resource: "landing", publicId: landingPageId, hostHeader: host }); if (redirectBase) redirect(`${redirectBase}/conversao/${landingPageId}/${legalDocument}`); if (!(await isLandingPageServableOnHost({ landingPageId, hostHeader: host }))) notFound(); return legalPageService.getPublic(landingPageId, legalDocument as LegalDocumentKind) }
export async function generateMetadata({ params }: { params: Promise<{ landingPageId: string; legalDocument: string }> }): Promise<Metadata> { const document = await getDocument(params); if (!document) return { robots: { index: false, follow: false } }; return { title: `${document.title} | ${document.snapshot.content.templateConfig?.identity.tradeName ?? document.snapshot.content.brandName ?? ""}`, description: document.description, robots: { index: false, follow: false } } }
export default async function LegalDocumentPage({ params }: { params: Promise<{ landingPageId: string; legalDocument: string }> }) { const document = await getDocument(params); if (!document) notFound(); return <LegalPageContainer document={document} /> }
