/**
 * Fixture multi-time das agendas (Calendário e widget do Dashboard).
 *
 * Reproduz a armadilha do bug de 15/09/2026: o mesmo perfil é **manager** num
 * time e **operator** em outro, de **masters diferentes**, e nenhum dos dois é
 * o time ativo da sessão. O esperado, time a time:
 *
 * | time            | papel    | o que o usuário enxerga            |
 * |-----------------|----------|------------------------------------|
 * | manager (A)     | manager  | agendamento de QUALQUER membro     |
 * | operator (B)    | operator | só os agendamentos que são dele    |
 *
 * O master E2E seedado por `bun run db:seed:e2e` é o sujeito do teste — assim a
 * sessão, a assinatura e o time ativo continuam sendo os de sempre.
 */

import { E2E_MASTER_SUPABASE_ID } from "./e2e-ids";
import { getPrisma } from "./db";

/**
 * `playwright.config.ts` roda `fullyParallel` com vários workers, e as duas
 * specs que usam esta fixture podem cair em workers diferentes ao mesmo tempo.
 * Cada spec recebe um NAMESPACE próprio: ids, e-mails, códigos de lead e títulos
 * ficam disjuntos, então nenhum `beforeAll` apaga o dado da outra nem colide no
 * `team.create`. O namespace é fixo por spec (não por worker) para o cleanup
 * continuar determinístico.
 */
export type MultiTeamAgendaNamespace = "ca" | "da";

const AGENDA_UUID_PREFIX = "e2e30000-0000-4000-8000-00000000";

export type MultiTeamAgendaIds = {
  managerTeamId: string;
  operatorTeamId: string;
  otherMasterProfileId: string;
  teammateProfileId: string;
  managerTeamLeadId: string;
  operatorTeamOwnLeadId: string;
  operatorTeamOtherLeadId: string;
  managerTeamTaskId: string;
  operatorTeamOwnTaskId: string;
  operatorTeamOtherTaskId: string;
  managerTeamScheduleId: string;
  operatorTeamOwnScheduleId: string;
  operatorTeamOtherScheduleId: string;
};

export function multiTeamAgendaIds(namespace: MultiTeamAgendaNamespace): MultiTeamAgendaIds {
  const id = (slot: string) => `${AGENDA_UUID_PREFIX}${namespace}${slot}`;
  return {
    managerTeamId: id("11"),
    operatorTeamId: id("12"),
    otherMasterProfileId: id("21"),
    teammateProfileId: id("22"),
    managerTeamLeadId: id("31"),
    operatorTeamOwnLeadId: id("32"),
    operatorTeamOtherLeadId: id("33"),
    managerTeamTaskId: id("41"),
    operatorTeamOwnTaskId: id("42"),
    operatorTeamOtherTaskId: id("43"),
    managerTeamScheduleId: id("51"),
    operatorTeamOwnScheduleId: id("52"),
    operatorTeamOtherScheduleId: id("53"),
  };
}

export type MultiTeamAgendaTitles = {
  /** Time onde o perfil é manager, agendamento de OUTRO membro — deve aparecer. */
  managerTeamTask: string;
  /** Time onde o perfil é operator, agendamento DELE — deve aparecer. */
  operatorTeamOwnTask: string;
  /** Time onde o perfil é operator, agendamento de OUTRO membro — NÃO deve aparecer. */
  operatorTeamOtherTask: string;
};

/** Títulos únicos por namespace: os asserts procuram texto, não contagem de linhas. */
export function multiTeamAgendaTitles(
  namespace: MultiTeamAgendaNamespace,
): MultiTeamAgendaTitles {
  const suffix = namespace.toUpperCase();
  return {
    managerTeamTask: `E2E MultiTime ${suffix} Manager Agendamento`,
    operatorTeamOwnTask: `E2E MultiTime ${suffix} Operator Proprio`,
    operatorTeamOtherTask: `E2E MultiTime ${suffix} Operator Alheio`,
  };
}

export type MultiTeamAgendaLeadNames = {
  managerTeam: string;
  operatorTeamOwn: string;
  operatorTeamOther: string;
};

export function multiTeamAgendaLeadNames(
  namespace: MultiTeamAgendaNamespace,
): MultiTeamAgendaLeadNames {
  const suffix = namespace.toUpperCase();
  return {
    managerTeam: `Lead MultiTime ${suffix} Manager E2E`,
    operatorTeamOwn: `Lead MultiTime ${suffix} Operator Proprio E2E`,
    operatorTeamOther: `Lead MultiTime ${suffix} Operator Alheio E2E`,
  };
}

function multiTeamAgendaLeadCodes(namespace: MultiTeamAgendaNamespace) {
  const suffix = namespace.toUpperCase();
  return {
    managerTeam: `E2EAGENDA${suffix}MANAGER`,
    operatorTeamOwn: `E2EAGENDA${suffix}OPOWN`,
    operatorTeamOther: `E2EAGENDA${suffix}OPOTHER`,
  };
}

export type MultiTeamAgendaFixture = {
  namespace: MultiTeamAgendaNamespace;
  ids: MultiTeamAgendaIds;
  titles: MultiTeamAgendaTitles;
  leadNames: MultiTeamAgendaLeadNames;
  subjectProfileId: string;
  activeTeamId: string;
  managerTeamId: string;
  operatorTeamId: string;
  /** Meio-dia UTC de hoje: dentro da janela do dia do Calendário e do widget. */
  referenceDate: Date;
};

function middayUtcToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0, 0),
  );
}

export async function seedMultiTeamAgendaFixture(
  namespace: MultiTeamAgendaNamespace,
): Promise<MultiTeamAgendaFixture> {
  const prisma = getPrisma();
  const ids = multiTeamAgendaIds(namespace);
  const titles = multiTeamAgendaTitles(namespace);
  const leadNames = multiTeamAgendaLeadNames(namespace);
  const leadCodes = multiTeamAgendaLeadCodes(namespace);

  const subject = await prisma.profile.findUnique({
    where: { supabaseId: E2E_MASTER_SUPABASE_ID },
    select: { id: true, activeTeamId: true },
  });
  if (!subject) {
    throw new Error("Seed E2E ausente — rode `bun run db:seed:e2e`");
  }
  if (!subject.activeTeamId) {
    throw new Error("Time ativo do master E2E ausente — rode `bun run db:seed:e2e`");
  }

  await cleanupMultiTeamAgendaFixture(namespace);

  const otherMaster = await prisma.profile.upsert({
    where: { id: ids.otherMasterProfileId },
    create: {
      id: ids.otherMasterProfileId,
      email: `e2e.agenda.${namespace}.outro.master@example.com`,
      fullName: `E2E Outro Master ${namespace.toUpperCase()}`,
      isMaster: true,
      role: "manager",
      hasPermanentSubscription: true,
      subscriptionStatus: "active",
    },
    update: { hasPermanentSubscription: true, subscriptionStatus: "active" },
  });

  const teammate = await prisma.profile.upsert({
    where: { id: ids.teammateProfileId },
    create: {
      id: ids.teammateProfileId,
      email: `e2e.agenda.${namespace}.colega@example.com`,
      fullName: `E2E Colega de Time ${namespace.toUpperCase()}`,
      role: "operator",
      functions: ["SDR", "CLOSER"],
    },
    update: {},
  });

  // A conta do time B precisa estar ativa: o escopo member-all descarta time
  // cujo master está com assinatura inativa ou banido.
  await prisma.profileSubscription.upsert({
    where: { profileId: otherMaster.id },
    create: {
      profileId: otherMaster.id,
      hasPermanentSubscription: true,
      subscriptionStatus: "active",
    },
    update: { hasPermanentSubscription: true, subscriptionStatus: "active" },
  });

  // Time A: mesmo master do sujeito, que entra como manager — enxerga o time todo.
  await prisma.team.create({
    data: {
      id: ids.managerTeamId,
      name: `E2E Time Manager MultiTime ${namespace.toUpperCase()}`,
      masterId: subject.id,
    },
  });
  // Time B: master DIFERENTE (cross-master), sujeito entra como operator.
  await prisma.team.create({
    data: {
      id: ids.operatorTeamId,
      name: `E2E Time Operator MultiTime ${namespace.toUpperCase()}`,
      masterId: otherMaster.id,
    },
  });

  await prisma.teamMember.createMany({
    data: [
      {
        teamId: ids.managerTeamId,
        profileId: subject.id,
        role: "manager",
        functions: ["SDR", "CLOSER"],
      },
      {
        teamId: ids.managerTeamId,
        profileId: teammate.id,
        role: "operator",
        functions: ["SDR", "CLOSER"],
      },
      {
        teamId: ids.operatorTeamId,
        profileId: subject.id,
        role: "operator",
        functions: ["SDR", "CLOSER"],
      },
      {
        teamId: ids.operatorTeamId,
        profileId: teammate.id,
        role: "operator",
        functions: ["SDR", "CLOSER"],
      },
    ],
  });

  const referenceDate = middayUtcToday();

  await prisma.lead.createMany({
    data: [
      {
        id: ids.managerTeamLeadId,
        leadCode: leadCodes.managerTeam,
        name: leadNames.managerTeam,
        managerId: subject.id,
        teamId: ids.managerTeamId,
        status: "new_opportunity",
        // Atendido pelo COLEGA: no time onde o sujeito é manager, o agendamento
        // de outro membro precisa aparecer.
        assignedTo: teammate.id,
        createdBy: teammate.id,
        updatedBy: teammate.id,
      },
      {
        id: ids.operatorTeamOwnLeadId,
        leadCode: leadCodes.operatorTeamOwn,
        name: leadNames.operatorTeamOwn,
        managerId: otherMaster.id,
        teamId: ids.operatorTeamId,
        status: "new_opportunity",
        assignedTo: subject.id,
        createdBy: subject.id,
        updatedBy: subject.id,
      },
      {
        id: ids.operatorTeamOtherLeadId,
        leadCode: leadCodes.operatorTeamOther,
        name: leadNames.operatorTeamOther,
        managerId: otherMaster.id,
        teamId: ids.operatorTeamId,
        status: "new_opportunity",
        assignedTo: teammate.id,
        createdBy: teammate.id,
        updatedBy: teammate.id,
      },
    ],
  });

  // Task e LeadActivity nascem juntas no app (`createActivityAndTask`) — o seed
  // reproduz isso: uma Task com `activityId` nulo não sobrevive a um PATCH pela
  // API, que é justamente o que invalida o cache no arrange das specs.
  const seededTasks = [
    {
      taskId: ids.managerTeamTaskId,
      leadId: ids.managerTeamLeadId,
      title: titles.managerTeamTask,
      body: "Agendamento de outro membro no time onde o sujeito é manager.",
      createdBy: teammate.id,
      assigneeProfileId: teammate.id,
    },
    {
      taskId: ids.operatorTeamOwnTaskId,
      leadId: ids.operatorTeamOwnLeadId,
      title: titles.operatorTeamOwnTask,
      body: "Agendamento do próprio sujeito no time onde ele é operator.",
      createdBy: subject.id,
      assigneeProfileId: subject.id,
    },
    {
      taskId: ids.operatorTeamOtherTaskId,
      leadId: ids.operatorTeamOtherLeadId,
      title: titles.operatorTeamOtherTask,
      body: "Agendamento alheio no time onde o sujeito é operator.",
      createdBy: teammate.id,
      assigneeProfileId: teammate.id,
    },
  ];

  for (const seeded of seededTasks) {
    const activity = await prisma.leadActivity.create({
      data: {
        leadId: seeded.leadId,
        type: "task",
        body: seeded.body,
        createdBy: seeded.createdBy,
        payload: {
          kind: "task",
          title: seeded.title,
          taskType: "meeting",
          isUrgent: false,
          assigneeProfileIds: [seeded.assigneeProfileId],
        },
      },
    });

    await prisma.task.create({
      data: {
        id: seeded.taskId,
        leadId: seeded.leadId,
        activityId: activity.id,
        title: seeded.title,
        taskType: "meeting",
        body: seeded.body,
        isUrgent: false,
        startAt: referenceDate,
        endAt: referenceDate,
        createdBy: seeded.createdBy,
        assignees: { create: [{ profileId: seeded.assigneeProfileId }] },
      },
    });
  }

  await prisma.leadsSchedule.createMany({
    data: [
      {
        id: ids.managerTeamScheduleId,
        leadId: ids.managerTeamLeadId,
        date: referenceDate,
        meetingTitle: titles.managerTeamTask,
      },
      {
        id: ids.operatorTeamOwnScheduleId,
        leadId: ids.operatorTeamOwnLeadId,
        date: referenceDate,
        meetingTitle: titles.operatorTeamOwnTask,
      },
      {
        id: ids.operatorTeamOtherScheduleId,
        leadId: ids.operatorTeamOtherLeadId,
        date: referenceDate,
        meetingTitle: titles.operatorTeamOtherTask,
      },
    ],
  });

  return {
    namespace,
    ids,
    titles,
    leadNames,
    subjectProfileId: subject.id,
    activeTeamId: subject.activeTeamId,
    managerTeamId: ids.managerTeamId,
    operatorTeamId: ids.operatorTeamId,
    referenceDate,
  };
}

export async function cleanupMultiTeamAgendaFixture(
  namespace: MultiTeamAgendaNamespace,
): Promise<void> {
  const prisma = getPrisma();
  const ids = multiTeamAgendaIds(namespace);
  const teamIds = [ids.managerTeamId, ids.operatorTeamId];
  const leadIds = [
    ids.managerTeamLeadId,
    ids.operatorTeamOwnLeadId,
    ids.operatorTeamOtherLeadId,
  ];

  // Ordem obrigatória pelas FKs: agendamento/tarefa → lead → membership → time.
  await prisma.leadsSchedule.deleteMany({ where: { leadId: { in: leadIds } } });
  await prisma.task.deleteMany({ where: { leadId: { in: leadIds } } });
  await prisma.leadActivity.deleteMany({ where: { leadId: { in: leadIds } } });
  await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
  await prisma.teamMember.deleteMany({ where: { teamId: { in: teamIds } } });
  await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
}
