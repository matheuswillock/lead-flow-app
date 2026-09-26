import { NextResponse, after } from "next/server"
import { publicFormSubmissionUseCase, type PublicFormSubmissionBackgroundJob } from "@/app/api/useCases/publicForms/PublicFormSubmissionUseCase"
import { landingPageUseCase } from "@/app/api/useCases/landingPages/LandingPageUseCase"
import { publicFormSubmissionSchema } from "@/lib/public-forms/validation"
import { isPublicFormRequestOriginAllowed } from "@/lib/public-forms/request-origin-guard"
import { rejectLandingPageRequestOnForeignHost } from "@/lib/landing-pages/landing-page-host-tenancy"
import { Output } from "@/lib/output"

export async function POST(request: Request, { params }: { params: Promise<{ landingPageId: string }> }) {
  const { landingPageId } = await params
  if (!isPublicFormRequestOriginAllowed(request)) return NextResponse.json(new Output(false, [], ["Origem não autorizada"], null), { status: 400 })
  const foreignHost = await rejectLandingPageRequestOnForeignHost(request, landingPageId)
  if (foreignHost) return foreignHost

  const landing = await landingPageUseCase.getPublic(landingPageId)
  if (!landing.isValid || !landing.result) return NextResponse.json(landing, { status: 404 })
  const snapshot = (landing.result as { snapshot: { form: { publicId: string } } }).snapshot
  const parsed = publicFormSubmissionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(new Output(false, [], parsed.error.issues.map((issue) => issue.message), null), { status: 400 })

  const output = await publicFormSubmissionUseCase.accept(snapshot.form.publicId, parsed.data)
  if (!output.isValid) return NextResponse.json(output, { status: 422 })
  const background = (output.result as { background?: PublicFormSubmissionBackgroundJob } | null)?.background
  if (background) after(() => publicFormSubmissionUseCase.queueForBackgroundProcessing(background))
  return NextResponse.json(new Output(true, ["Respostas recebidas"], [], { submissionId: (output.result as { submissionId?: string } | null)?.submissionId ?? null }), { status: 201 })
}
