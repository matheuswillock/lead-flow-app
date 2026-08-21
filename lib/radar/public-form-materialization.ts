/**
 * Projeção materializada das respostas de formulário público dentro de
 * `RadarProfile.profileData.publicForms[formId]`.
 *
 * Contrato causal v1: revisões são ordenadas por `(answeredAt, sourceEventId)`.
 * Um evento atrasado permanece no histórico (RadarEvent append-only) mas nunca
 * substitui uma projeção mais nova. Valor canônico idêntico não gera revisão.
 *
 * Este módulo é puro: não conhece Prisma nem transações. O repositório aplica o
 * resultado dentro do lock por `teamId + radarProfileId`.
 */

export type MaterializedPublicFormAnswer = {
  value: unknown
  mappingKey: string | null
  answeredAt: string
  sourceEventId: string
}

export type MaterializedPublicFormProjection = {
  publicationId: string
  answers: Record<string, MaterializedPublicFormAnswer>
}

export type PublicFormAnswerRevision = {
  formId: string
  publicationId: string
  questionId: string
  value: unknown
  mappingKey: string | null
  answeredAt: Date
  sourceEventId: string
}

export type PublicFormMaterializationOutcome = "applied" | "stale" | "unchanged"

export type PublicFormMaterializationDecision = {
  outcome: PublicFormMaterializationOutcome
  profileData: Record<string, unknown>
  previous: MaterializedPublicFormAnswer | null
}

const PUBLIC_FORMS_KEY = "publicForms"

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {}
}

/** JSON estável: chaves de objeto ordenadas para que a igualdade não dependa da ordem. */
export function canonicalizePublicFormAnswerValue(value: unknown): string {
  return JSON.stringify(sortJsonKeys(value))
}

function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonKeys)
  if (!value || typeof value !== "object") return value ?? null
  const source = value as Record<string, unknown>
  return Object.keys(source)
    .sort()
    .reduce<Record<string, unknown>>((accumulator, key) => {
      accumulator[key] = sortJsonKeys(source[key])
      return accumulator
    }, {})
}

export function readMaterializedPublicFormAnswer(
  profileData: unknown,
  formId: string,
  questionId: string,
): MaterializedPublicFormAnswer | null {
  const forms = asRecord(asRecord(profileData)[PUBLIC_FORMS_KEY])
  const answers = asRecord(asRecord(forms[formId]).answers)
  const answer = answers[questionId]
  if (!answer || typeof answer !== "object") return null
  const candidate = answer as Partial<MaterializedPublicFormAnswer>
  if (typeof candidate.answeredAt !== "string" || typeof candidate.sourceEventId !== "string") {
    return null
  }
  return {
    value: candidate.value ?? null,
    mappingKey: typeof candidate.mappingKey === "string" ? candidate.mappingKey : null,
    answeredAt: candidate.answeredAt,
    sourceEventId: candidate.sourceEventId,
  }
}

/**
 * Ordem causal `(answeredAt, sourceEventId)`: a revisão recebida é descartada
 * quando é anterior à armazenada, ou quando empata no timestamp e perde o
 * desempate determinístico por `sourceEventId`.
 */
export function isStalePublicFormRevision(
  stored: MaterializedPublicFormAnswer | null,
  incoming: Pick<PublicFormAnswerRevision, "answeredAt" | "sourceEventId">,
): boolean {
  if (!stored) return false
  const storedTime = new Date(stored.answeredAt).getTime()
  if (Number.isNaN(storedTime)) return false
  const incomingTime = incoming.answeredAt.getTime()
  if (incomingTime !== storedTime) return incomingTime < storedTime
  return incoming.sourceEventId < stored.sourceEventId
}

/**
 * Deep merge apenas da pergunta alterada: respostas irmãs e outros formulários
 * do mesmo perfil permanecem intactos.
 */
export function applyPublicFormAnswerRevision(
  profileData: unknown,
  revision: PublicFormAnswerRevision,
): PublicFormMaterializationDecision {
  const root = asRecord(profileData)
  const previous = readMaterializedPublicFormAnswer(root, revision.formId, revision.questionId)

  if (isStalePublicFormRevision(previous, revision)) {
    return { outcome: "stale", profileData: root, previous }
  }
  if (
    previous &&
    canonicalizePublicFormAnswerValue(previous.value) ===
      canonicalizePublicFormAnswerValue(revision.value) &&
    previous.mappingKey === revision.mappingKey
  ) {
    return { outcome: "unchanged", profileData: root, previous }
  }

  const forms = asRecord(root[PUBLIC_FORMS_KEY])
  const form = asRecord(forms[revision.formId])
  const answers = asRecord(form.answers)

  answers[revision.questionId] = {
    value: revision.value ?? null,
    mappingKey: revision.mappingKey,
    answeredAt: revision.answeredAt.toISOString(),
    sourceEventId: revision.sourceEventId,
  } satisfies MaterializedPublicFormAnswer

  form.publicationId = revision.publicationId
  form.answers = answers
  forms[revision.formId] = form
  root[PUBLIC_FORMS_KEY] = forms

  return { outcome: "applied", profileData: root, previous }
}
