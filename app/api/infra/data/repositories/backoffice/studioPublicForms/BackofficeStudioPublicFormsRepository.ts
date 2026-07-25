import { prisma } from "@/app/api/infra/data/prisma"

export class BackofficeStudioPublicFormsRepository {
  async stampForm(id: string, backofficeUserId: string): Promise<void> {
    await prisma.publicForm.update({
      where: { id },
      data: { managedByBackofficeUserId: backofficeUserId },
    })
  }

  async getWizardContext(teamId: string) {
    const [members, customFields, healthPlans] = await Promise.all([
      prisma.teamMember.findMany({
        where: { teamId },
        select: {
          profileId: true,
          functions: true,
          profile: { select: { fullName: true } },
        },
      }),
      prisma.leadCustomFieldDefinition.findMany({
        where: { teamId, isActive: true },
        select: {
          id: true,
          teamId: true,
          key: true,
          label: true,
          type: true,
          options: true,
          isRequired: true,
          displayOrder: true,
          isActive: true,
          showOnPublicForm: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { label: "asc" },
      }),
      prisma.healthPlanOption.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ])

    return {
      members: members.map((member) => ({
        profileId: member.profileId,
        name: member.profile.fullName || "Sem nome",
        functions: member.functions,
      })),
      customFields,
      healthPlans,
    }
  }
}

export const backofficeStudioPublicFormsRepository = new BackofficeStudioPublicFormsRepository()
