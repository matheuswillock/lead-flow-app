import { Prisma, PrismaClient, LeadStatus, MeetingHeald } from "@prisma/client"

const prisma = new PrismaClient()

const TEAM_ID = "32ccdbe1-627f-4fe3-a506-056b997ed89b"
const MANAGER_ID = "8474aaf6-e7d1-4165-9bef-bf76bc701038"

const SDR_AND_CLOSER_PROFILE_IDS = [
  "8474aaf6-e7d1-4165-9bef-bf76bc701038", // Matheus
  "b0737bfd-7bea-493b-8cfc-14946fcea8cd", // Nathiele
] as const

const LEAD_STATUSES: LeadStatus[] = [
  LeadStatus.new_opportunity,
  LeadStatus.scheduled,
  LeadStatus.no_show,
  LeadStatus.pricingRequest,
  LeadStatus.future_sale,
  LeadStatus.offerNegotiation,
  LeadStatus.pending_documents,
  LeadStatus.offerSubmission,
  LeadStatus.dps_agreement,
  LeadStatus.invoicePayment,
  LeadStatus.disqualified,
  LeadStatus.opportunityLost,
  LeadStatus.operator_denied,
  LeadStatus.contract_finalized,
]

const FIRST_NAMES = [
  "Ana",
  "Bruno",
  "Carla",
  "Diego",
  "Eduarda",
  "Felipe",
  "Gabriela",
  "Henrique",
  "Isabela",
  "Joao",
  "Karen",
  "Lucas",
  "Mariana",
  "Nicolas",
  "Paula",
  "Rafael",
  "Sabrina",
  "Thiago",
  "Vanessa",
  "William",
]

const LAST_NAMES = [
  "Silva",
  "Santos",
  "Oliveira",
  "Souza",
  "Lima",
  "Pereira",
  "Ferreira",
  "Almeida",
  "Costa",
  "Rodrigues",
  "Martins",
  "Gomes",
  "Barbosa",
  "Ribeiro",
  "Carvalho",
  "Araujo",
]

const HEALTH_PLANS = [
  "Amil",
  "Bradesco Saude",
  "SulAmerica",
  "NotreDame Intermedica",
  "Unimed",
  "Porto Seguro Saude",
]

const HOSPITALS = [
  "Hospital Sao Luiz",
  "Hospital Albert Einstein",
  "Hospital Sirio-Libanes",
  "Hospital Samaritano",
  "Hospital Santa Catarina",
]

const TREATMENTS = [
  "Sem tratamento em andamento",
  "Acompanhamento cardiologico",
  "Fisioterapia",
  "Acompanhamento endocrinologico",
  "Oncologia (acompanhamento)",
]

function pad3(n: number): string {
  return String(n).padStart(3, "0")
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(items: readonly T[]): T {
  return items[randInt(0, items.length - 1)]!
}

function chance(probability: number): boolean {
  return Math.random() < probability
}

function currency(min: number, max: number): Prisma.Decimal {
  const raw = Math.random() * (max - min) + min
  const rounded = Math.round(raw * 100) / 100
  return new Prisma.Decimal(rounded)
}

function digits(length: number): string {
  let out = ""
  for (let i = 0; i < length; i += 1) out += String(randInt(0, 9))
  return out
}

function fakePhone(): string {
  // 11 digits, Sao Paulo-like
  return `11${randInt(900000000, 999999999)}`
}

function stableLeadCode(index1Based: number): string {
  return `SEED-LEAD-${pad3(index1Based)}`
}

function buildLeadName(index1Based: number): string {
  const first = pick(FIRST_NAMES)
  const last = pick(LAST_NAMES)
  const suffix = index1Based % 7 === 0 ? ` ${pick(LAST_NAMES)}` : ""
  return `${first} ${last}${suffix}`.trim()
}

function buildEmail(index1Based: number): string {
  return `seed.lead.${pad3(index1Based)}@example.com`
}

function buildCnpj(index1Based: number): string {
  // Not meant to be a real/valid CNPJ; just unique and formatted as digits
  const base = `${pad3(index1Based)}${digits(11)}`
  return base.slice(0, 14)
}

function statusEnteredAtFor(status: LeadStatus): Date {
  const now = Date.now()
  const daysAgo = randInt(0, 35)
  const hoursAgo = randInt(0, 23)
  const minutesAgo = randInt(0, 59)
  const base = new Date(now - daysAgo * 24 * 60 * 60 * 1000)
  base.setHours(base.getHours() - hoursAgo)
  base.setMinutes(base.getMinutes() - minutesAgo)

  if (status === LeadStatus.new_opportunity) return base
  if (status === LeadStatus.scheduled) return new Date(base.getTime() - randInt(1, 6) * 60 * 60 * 1000)
  if (status === LeadStatus.no_show) return new Date(base.getTime() - randInt(1, 18) * 60 * 60 * 1000)
  if (status === LeadStatus.future_sale) return new Date(base.getTime() - randInt(1, 10) * 24 * 60 * 60 * 1000)
  if (status === LeadStatus.contract_finalized) return new Date(base.getTime() - randInt(3, 20) * 24 * 60 * 60 * 1000)
  return base
}

function meetingDateFor(status: LeadStatus): Date | null {
  if (status !== LeadStatus.scheduled && status !== LeadStatus.no_show) return null
  const daysFromNow = status === LeadStatus.scheduled ? randInt(0, 10) : -randInt(1, 10)
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000)
  date.setHours(randInt(9, 19), pick([0, 15, 30, 45] as const), 0, 0)
  return date
}

function followUpAtFor(status: LeadStatus): Date | null {
  if (status !== LeadStatus.future_sale) return null
  const daysFromNow = randInt(7, 90)
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000)
  date.setHours(randInt(9, 18), pick([0, 30] as const), 0, 0)
  return date
}

function lossReasonFor(status: LeadStatus): string | null {
  if (status !== LeadStatus.opportunityLost && status !== LeadStatus.disqualified && status !== LeadStatus.operator_denied) {
    return null
  }
  return pick([
    "Nao respondeu",
    "Sem interesse",
    "Preco alto",
    "Fora do perfil",
    "Escolheu concorrente",
    "Documentacao incompleta",
  ] as const)
}

function lossReasonDetailsFor(status: LeadStatus): string | null {
  const reason = lossReasonFor(status)
  if (!reason) return null
  return chance(0.5) ? `Detalhes: ${reason.toLowerCase()} (seed)` : null
}

function buildNotes(status: LeadStatus): string | null {
  const base = pick([
    "Lead criado via seed para testes.",
    "Contato pediu simulacao de valores.",
    "Tem interesse em plano com coparticipacao.",
    "Preferencia por rede premium.",
    "Cliente ja tem plano e quer migrar.",
    "Quer incluir dependentes.",
  ] as const)

  if (status === LeadStatus.scheduled) return `${base} Reuniao marcada.`
  if (status === LeadStatus.no_show) return `${base} Nao compareceu.`
  if (status === LeadStatus.future_sale) return `${base} Retornar mais pra frente.`
  if (status === LeadStatus.contract_finalized) return `${base} Negocio fechado.`
  if (status === LeadStatus.opportunityLost || status === LeadStatus.disqualified) return `${base} Lead perdido.`
  return chance(0.75) ? base : null
}

async function ensurePrerequisites() {
  const team = await prisma.team.findUnique({ where: { id: TEAM_ID }, select: { id: true } })
  if (!team) {
    throw new Error(`Team nao encontrado: ${TEAM_ID}`)
  }

  const manager = await prisma.profile.findUnique({ where: { id: MANAGER_ID }, select: { id: true } })
  if (!manager) {
    throw new Error(`Profile manager nao encontrado: ${MANAGER_ID}`)
  }

  const profiles = await prisma.profile.findMany({
    where: { id: { in: [...SDR_AND_CLOSER_PROFILE_IDS] } },
    select: { id: true },
  })

  if (profiles.length !== SDR_AND_CLOSER_PROFILE_IDS.length) {
    const found = new Set(profiles.map((p) => p.id))
    const missing = SDR_AND_CLOSER_PROFILE_IDS.filter((id) => !found.has(id))
    throw new Error(`Profiles ausentes para seed: ${missing.join(", ")}`)
  }
}

async function seedLeads() {
  await ensurePrerequisites()

  const count = 150

  for (let i = 1; i <= count; i += 1) {
    const leadCode = stableLeadCode(i)
    const status = pick(LEAD_STATUSES)
    const statusEnteredAt = statusEnteredAtFor(status)

    const name = buildLeadName(i)
    const email = chance(0.85) ? buildEmail(i) : null
    const phone = chance(0.92) ? fakePhone() : null
    const cnpj = chance(0.25) ? buildCnpj(i) : null

    const assignedTo = chance(0.9) ? pick(SDR_AND_CLOSER_PROFILE_IDS) : null
    const closerId = chance(0.85) ? pick(SDR_AND_CLOSER_PROFILE_IDS) : null

    const meetingDate = meetingDateFor(status)
    const meetingTitle = meetingDate ? `Estudo Plano de Saude: ${name}` : null
    const meetingLink = meetingDate && chance(0.6) ? `https://meet.example.com/${leadCode.toLowerCase()}` : null
    const meetingNotes = meetingDate && chance(0.6) ? "Reuniao de alinhamento (seed)" : null
    const meetingHeald =
      status === LeadStatus.no_show ? MeetingHeald.no : status === LeadStatus.scheduled ? null : null

    const followUpAt = followUpAtFor(status)
    const followUpNotes = followUpAt ? "Acompanhar em data futura (seed)" : null
    const followUpSourceStatus = followUpAt ? LeadStatus.future_sale : null

    const currentHealthPlan = chance(0.7) ? pick(HEALTH_PLANS) : null
    const currentValue = chance(0.7) ? currency(120, 2200) : null
    const referenceHospital = chance(0.45) ? pick(HOSPITALS) : null
    const currentTreatment = chance(0.4) ? pick(TREATMENTS) : null
    const age = chance(0.85) ? String(randInt(19, 74)) : null

    const lossReason = lossReasonFor(status)
    const lossReasonDetails = lossReasonDetailsFor(status)

    const isFinalized = status === LeadStatus.contract_finalized
    const ticket = isFinalized ? currency(800, 18000) : null
    const soldPlan = isFinalized ? pick(HEALTH_PLANS) : null
    const contractDueDate = isFinalized
      ? new Date(Date.now() + randInt(1, 45) * 24 * 60 * 60 * 1000)
      : null

    const actorId = chance(0.7) ? pick(SDR_AND_CLOSER_PROFILE_IDS) : MANAGER_ID

    await prisma.lead.upsert({
      where: { leadCode },
      create: {
        leadCode,
        managerId: MANAGER_ID,
        teamId: TEAM_ID,
        assignedTo,
        closerId,
        status,
        name,
        email,
        phone,
        cnpj,
        age,
        currentHealthPlan,
        currentValue,
        referenceHospital,
        currentTreatment,
        meetingDate,
        meetingTitle,
        meetingNotes,
        meetingLink,
        meetingHeald,
        followUpAt,
        followUpNotes,
        followUpSourceStatus,
        lossReason,
        lossReasonDetails,
        statusEnteredAt,
        notes: buildNotes(status),
        createdBy: actorId,
        updatedBy: actorId,
        ticket,
        contractDueDate,
        soldPlan,
      },
      update: {
        managerId: MANAGER_ID,
        teamId: TEAM_ID,
        assignedTo,
        closerId,
        status,
        name,
        email,
        phone,
        cnpj,
        age,
        currentHealthPlan,
        currentValue,
        referenceHospital,
        currentTreatment,
        meetingDate,
        meetingTitle,
        meetingNotes,
        meetingLink,
        meetingHeald,
        followUpAt,
        followUpNotes,
        followUpSourceStatus,
        lossReason,
        lossReasonDetails,
        statusEnteredAt,
        notes: buildNotes(status),
        updatedBy: actorId,
        ticket,
        contractDueDate,
        soldPlan,
      },
    })
  }
}

async function main() {
  console.info("[seed:leads] Iniciando...")
  await seedLeads()
  console.info("[seed:leads] Concluido.")
}

main()
  .catch((e) => {
    console.error("[seed:leads] Falhou:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

