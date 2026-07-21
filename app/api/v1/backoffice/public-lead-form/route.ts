import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { detectSqlInjection } from "@/app/api/v1/utils/inputSecurity"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { backofficePublicLeadFormUseCase } from "@/app/api/useCases/backofficePublicLeadForm/BackofficePublicLeadFormUseCase"
import { BackofficePublicLeadFormRequestSchema } from "./DTO/requestBackofficePublicLeadForm"

const routePrefix = "[BackofficePublicLeadFormRoute][POST]"

const normalizeTrackingValue = (value?: string | null): string | undefined => {
  if (!value) return undefined
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = BackofficePublicLeadFormRequestSchema.safeParse(body)

    if (!validation.success) {
      const errors = validation.error.issues.map((issue) => issue.message)
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 })
    }

    const sqlInspectionCandidates: Array<{ field: string; value: string | undefined }> = [
      { field: "name", value: validation.data.name },
      { field: "email", value: validation.data.email },
      { field: "phone", value: validation.data.phone },
      { field: "cpfCnpj", value: validation.data.cpfCnpj },
      { field: "notes", value: validation.data.notes },
      { field: "qualificationLeadOrganization", value: validation.data.qualificationLeadOrganization },
      { field: "qualificationAvgUsers", value: validation.data.qualificationAvgUsers },
      { field: "qualificationProfileFit", value: validation.data.qualificationProfileFit },
    ]

    for (const candidate of sqlInspectionCandidates) {
      if (!candidate.value) continue
      const detection = detectSqlInjection(candidate.value)
      if (!detection.suspicious) continue

      console.warn(`${routePrefix} Conteúdo suspeito detectado`, {
        field: candidate.field,
        rule: detection.rule,
      })

      return NextResponse.json(
        new Output(false, [], ["Dados inválidos para submissão."], null),
        { status: 400 },
      )
    }

    const output = await backofficePublicLeadFormUseCase.create({
      ...validation.data,
      referrer:
        normalizeTrackingValue(validation.data.referrer) ||
        normalizeTrackingValue(request.headers.get("referer")),
      landingUrl:
        normalizeTrackingValue(validation.data.landingUrl) ||
        normalizeTrackingValue(request.headers.get("origin")),
    })

    if (!output.isValid) {
      return NextResponse.json(output, { status: 400 })
    }

    const result = output.result as { id?: string; duplicated?: boolean } | null
    console.info(`${routePrefix} Lead público criado`, {
      leadId: result?.id ?? null,
      duplicated: result?.duplicated ?? false,
    })

    return NextResponse.json(output, { status: result?.duplicated ? 200 : 201 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error(`${routePrefix} Erro ao criar lead público:`, error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno do servidor"], null),
      { status: 500 },
    )
  }
}
