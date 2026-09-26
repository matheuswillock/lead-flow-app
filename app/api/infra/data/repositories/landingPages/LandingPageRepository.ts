import { prisma } from "@/app/api/infra/data/prisma"
import type { ILandingPageRepository } from "./ILandingPageRepository"

export class LandingPageRepository implements ILandingPageRepository {
  async listByTeam(teamId: string) {
    return prisma.landingPage.findMany({
      where: { teamId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        teamId: true,
        publicFormId: true,
        createdById: true,
        publicId: true,
        name: true,
        status: true,
        templateSlug: true,
        content: true,
        offer: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async findById(teamId: string, id: string) {
    return prisma.landingPage.findFirst({
      where: { id, teamId },
      select: {
        id: true,
        teamId: true,
        publicFormId: true,
        createdById: true,
        publicId: true,
        name: true,
        status: true,
        templateSlug: true,
        content: true,
        offer: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async findPublicFormForTeam(teamId: string, publicFormId: string) {
    return prisma.publicForm.findFirst({
      where: { id: publicFormId, teamId },
      select: { id: true, status: true },
    })
  }

  async findPublic(publicId: string) {
    return prisma.landingPage.findUnique({
      where: { publicId, status: "published" },
      select: {
        id: true,
        teamId: true,
        publicFormId: true,
        createdById: true,
        publicId: true,
        name: true,
        status: true,
        templateSlug: true,
        content: true,
        offer: true,
        createdAt: true,
        updatedAt: true,
        publications: {
          where: { endedAt: null },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    })
  }

  async create(input: Parameters<ILandingPageRepository["create"]>[0]) {
    return prisma.landingPage.create({
      data: input,
      select: {
        id: true,
        teamId: true,
        publicFormId: true,
        createdById: true,
        publicId: true,
        name: true,
        status: true,
        templateSlug: true,
        content: true,
        offer: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async update(teamId: string, id: string, input: Parameters<ILandingPageRepository["update"]>[2]) {
    const current = await prisma.landingPage.findFirst({ where: { id, teamId }, select: { id: true } })
    if (!current) return null

    return prisma.landingPage.update({
      where: { id },
      data: input,
      select: {
        id: true,
        teamId: true,
        publicFormId: true,
        createdById: true,
        publicId: true,
        name: true,
        status: true,
        templateSlug: true,
        content: true,
        offer: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async publish(teamId: string, id: string, publishedById: string) {
    const landing = await prisma.landingPage.findFirst({
      where: { id, teamId, status: { not: "archived" } },
      select: {
        id: true,
        teamId: true,
        publicFormId: true,
        publicId: true,
        name: true,
        templateSlug: true,
        content: true,
        offer: true,
        publications: { orderBy: { version: "desc" }, take: 1 },
        publicForm: {
          select: {
            publications: {
              where: { endedAt: null },
              orderBy: { version: "desc" },
              take: 1,
            },
          },
        },
      },
    })
    if (!landing || landing.publicForm.publications.length === 0) return null

    const version = (landing.publications[0]?.version ?? 0) + 1
    const formPublication = landing.publicForm.publications[0]
    const snapshot = {
      landingPageId: landing.id,
      publicId: landing.publicId,
      version,
      publishedAt: new Date().toISOString(),
      name: landing.name,
      templateSlug: landing.templateSlug,
      content: landing.content,
      offer: landing.offer,
      formPublicationId: formPublication.id,
      form: formPublication.snapshot,
    }

    return prisma.$transaction(async (transaction) => {
      await transaction.landingPagePublication.updateMany({
        where: { landingPageId: landing.id, endedAt: null },
        data: { endedAt: new Date() },
      })
      await transaction.landingPage.update({ where: { id: landing.id }, data: { status: "published" } })
      return transaction.landingPagePublication.create({
        data: { landingPageId: landing.id, publishedById, version, snapshot },
      })
    })
  }

  async archive(teamId: string, id: string) {
    const current = await prisma.landingPage.findFirst({ where: { id, teamId }, select: { id: true } })
    if (!current) return null
    return prisma.landingPage.update({
      where: { id },
      data: { status: "archived" },
      select: {
        id: true,
        teamId: true,
        publicFormId: true,
        createdById: true,
        publicId: true,
        name: true,
        status: true,
        templateSlug: true,
        content: true,
        offer: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }
}

export const landingPageRepository = new LandingPageRepository()
