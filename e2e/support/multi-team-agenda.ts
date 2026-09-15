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

const AGENDA_PREFIX = "e2e30000-0000-4000-8000-0000000000";

export const MULTI_TEAM_AGENDA = {
  managerTeamId: `${AGENDA_PREFIX}11`,
  operatorTeamId: `${AGENDA_PREFIX}12`,
  otherMasterProfileId: `${AGENDA_PREFIX}21`,
  teammateProfileId: `${AGENDA_PREFIX}22`,
  managerTeamLeadId: `${AGENDA_PREFIX}31`,
  operatorTeamOwnLeadId: `${AGENDA_PREFIX}32`,
  operatorTeamOtherLeadId: `${AGENDA_PREFIX}33`,
  managerTeamTaskId: `${AGENDA_PREFIX}41`,
  operatorTeamOwnTaskId: `${AGENDA_PREFIX}42`,
  operatorTeamOtherTaskId: `${AGENDA_PREFIX}43`,
  managerTeamScheduleId: `${AGENDA_PREFIX}51`,
  operatorTeamOwnScheduleId: `${AGENDA_PREFIX}52`,
  operatorTeamOtherScheduleId: `${AGENDA_PREFIX}53`,
} as const;

/** Títulos únicos: os asserts procuram por texto, não por contagem de linhas. */
export const MULTI_TEAM_AGENDA_TITLES = {
  /** Time onde o perfil é manager, agendamento de OUTRO membro — deve aparecer. */
  managerTeamTask: "E2E MultiTime Manager Agendamento",
  /** Time onde o perfil é operator, agendamento DELE — deve aparecer. */
  operatorTeamOwnTask: "E2E MultiTime Operator Proprio",
  /** Time onde o perfil é operator, agendamento de OUTRO membro — NÃO deve aparecer. */
  operatorTeamOtherTask: "E2E MultiTime Operator Alheio",
} as const;

export const MULTI_TEAM_AGENDA_LEAD_NAMES = {
  managerTeam: "Lead MultiTime Manager E2E",
  operatorTeamOwn: "Lead MultiTime Operator Proprio E2E",
  operatorTeamOther: "Lead MultiTime Operator Alheio E2E",
} as const;

const LEAD_CODES = {
  managerTeam: "E2EAGENDAMANAGER1",
  operatorTeamOwn: "E2EAGENDAOPOWN001",
  operatorTeamOther: "E2EAGENDAOPOTHER1",
} as const;

export type MultiTeamAgendaFixture = {
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

export async function seedMultiTeamAgendaFixture(): Promise<MultiTeamAgendaFixture> {
  const prisma = getPrisma();

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

  await cleanupMultiTeamAgendaFixture();

  const otherMaster = await prisma.profile.upsert({
    where: { id: MULTI_TEAM_AGENDA.otherMasterProfileId },
    create: {
      id: MULTI_TEAM_AGENDA.otherMasterProfileId,
      email: "e2e.agenda.outro.master@example.com",
      fullName: "E2E Outro Master",
      isMaster: true,
      role: "manager",
      hasPermanentSubscription: true,
      subscriptionStatus: "active",
    },
    update: { hasPermanentSubscription: true, subscriptionStatus: "active" },
  });

  const teammate = await prisma.profile.upsert({
    where: { id: MULTI_TEAM_AGENDA.teammateProfileId },
    create: {
      id: MULTI_TEAM_AGENDA.teammateProfileId,
      email: "e2e.agenda.colega@example.com",
      fullName: "E2E Colega de Time",
      role: "operator",
      functions: ["SDR", "CLOSER"],
    },
    update: {},
  });

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
      id: MULTI_TEAM_AGENDA.managerTeamId,
      name: "E2E Time Manager MultiTime",
      masterId: subject.id,
    },
  });
  // Time B: master DIFERENTE (cross-master), sujeito entra como operator.
  await prisma.team.create({
    data: {
      id: MULTI_TEAM_AGENDA.operatorTeamId,
      name: "E2E Time Operator MultiTime",
      masterId: otherMaster.id,
    },
  });

  await prisma.teamMember.createMany({
    data: [
      {
        teamId: MULTI_TEAM_AGENDA.managerTeamId,
        profileId: subject.id,
        role: "manager",
        functions: ["SDR", "CLOSER"],
      },
      {
        teamId: MULTI_TEAM_AGENDA.managerTeamId,
        profileId: teammate.id,
        role: "operator",
        functions: ["SDR", "CLOSER"],
      },
      {
        teamId: MULTI_TEAM_AGENDA.operatorTeamId,
        profileId: subject.id,
        role: "operator",
        functions: ["SDR", "CLOSER"],
      },
      {
        teamId: MULTI_TEAM_AGENDA.operatorTeamId,
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
        id: MULTI_TEAM_AGENDA.managerTeamLeadId,
        leadCode: LEAD_CODES.managerTeam,
        name: MULTI_TEAM_AGENDA_LEAD_NAMES.managerTeam,
        managerId: subject.id,
        teamId: MULTI_TEAM_AGENDA.managerTeamId,
        status: "new_opportunity",
        // Atendido pelo COLEGA: no time onde o sujeito é manager, o agendamento
        // de outro membro precisa aparecer.
        assignedTo: teammate.id,
        createdBy: teammate.id,
        updatedBy: teammate.id,
      },
      {
        id: MULTI_TEAM_AGENDA.operatorTeamOwnLeadId,
        leadCode: LEAD_CODES.operatorTeamOwn,
        name: MULTI_TEAM_AGENDA_LEAD_NAMES.operatorTeamOwn,
        managerId: otherMaster.id,
        teamId: MULTI_TEAM_AGENDA.operatorTeamId,
        status: "new_opportunity",
        assignedTo: subject.id,
        createdBy: subject.id,
        updatedBy: subject.id,
      },
      {
        id: MULTI_TEAM_AGENDA.operatorTeamOtherLeadId,
        leadCode: LEAD_CODES.operatorTeamOther,
        name: MULTI_TEAM_AGENDA_LEAD_NAMES.operatorTeamOther,
        managerId: otherMaster.id,
        teamId: MULTI_TEAM_AGENDA.operatorTeamId,
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
      taskId: MULTI_TEAM_AGENDA.managerTeamTaskId,
      leadId: MULTI_TEAM_AGENDA.managerTeamLeadId,
      title: MULTI_TEAM_AGENDA_TITLES.managerTeamTask,
      body: "Agendamento de outro membro no time onde o sujeito é manager.",
      createdBy: teammate.id,
      assigneeProfileId: teammate.id,
    },
    {
      taskId: MULTI_TEAM_AGENDA.operatorTeamOwnTaskId,
      leadId: MULTI_TEAM_AGENDA.operatorTeamOwnLeadId,
      title: MULTI_TEAM_AGENDA_TITLES.operatorTeamOwnTask,
      body: "Agendamento do próprio sujeito no time onde ele é operator.",
      createdBy: subject.id,
      assigneeProfileId: subject.id,
    },
    {
      taskId: MULTI_TEAM_AGENDA.operatorTeamOtherTaskId,
      leadId: MULTI_TEAM_AGENDA.operatorTeamOtherLeadId,
      title: MULTI_TEAM_AGENDA_TITLES.operatorTeamOtherTask,
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
        id: MULTI_TEAM_AGENDA.managerTeamScheduleId,
        leadId: MULTI_TEAM_AGENDA.managerTeamLeadId,
        date: referenceDate,
        meetingTitle: MULTI_TEAM_AGENDA_TITLES.managerTeamTask,
      },
      {
        id: MULTI_TEAM_AGENDA.operatorTeamOwnScheduleId,
        leadId: MULTI_TEAM_AGENDA.operatorTeamOwnLeadId,
        date: referenceDate,
        meetingTitle: MULTI_TEAM_AGENDA_TITLES.operatorTeamOwnTask,
      },
      {
        id: MULTI_TEAM_AGENDA.operatorTeamOtherScheduleId,
        leadId: MULTI_TEAM_AGENDA.operatorTeamOtherLeadId,
        date: referenceDate,
        meetingTitle: MULTI_TEAM_AGENDA_TITLES.operatorTeamOtherTask,
      },
    ],
  });

  return {
    subjectProfileId: subject.id,
    activeTeamId: subject.activeTeamId,
    managerTeamId: MULTI_TEAM_AGENDA.managerTeamId,
    operatorTeamId: MULTI_TEAM_AGENDA.operatorTeamId,
    referenceDate,
  };
}

export async function cleanupMultiTeamAgendaFixture(): Promise<void> {
  const prisma = getPrisma();
  const teamIds = [MULTI_TEAM_AGENDA.managerTeamId, MULTI_TEAM_AGENDA.operatorTeamId];
  const leadIds = [
    MULTI_TEAM_AGENDA.managerTeamLeadId,
    MULTI_TEAM_AGENDA.operatorTeamOwnLeadId,
    MULTI_TEAM_AGENDA.operatorTeamOtherLeadId,
  ];

  // Ordem obrigatória pelas FKs: agendamento/tarefa → lead → membership → time.
  await prisma.leadsSchedule.deleteMany({ where: { leadId: { in: leadIds } } });
  await prisma.task.deleteMany({ where: { leadId: { in: leadIds } } });
  await prisma.leadActivity.deleteMany({ where: { leadId: { in: leadIds } } });
  await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
  await prisma.teamMember.deleteMany({ where: { teamId: { in: teamIds } } });
  await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
}
