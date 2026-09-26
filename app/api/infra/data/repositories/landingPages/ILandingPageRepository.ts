import type { LandingPage, LandingPagePublication } from "@prisma/client"

export type LandingPageWithPublication = LandingPage & {
  publications: LandingPagePublication[]
}

export interface ILandingPageRepository {
  listByTeam(teamId: string): Promise<LandingPage[]>
  findById(teamId: string, id: string): Promise<LandingPage | null>
  findPublicFormForTeam(teamId: string, publicFormId: string): Promise<{ id: string; status: string } | null>
  findPublic(publicId: string): Promise<LandingPageWithPublication | null>
  create(input: {
    teamId: string
    createdById: string
    name: string
    publicFormId: string
    templateSlug: string
    content: object
    offer: object
  }): Promise<LandingPage>
  update(
    teamId: string,
    id: string,
    input: {
      name: string
      publicFormId: string
      templateSlug: string
      content: object
      offer: object
    },
  ): Promise<LandingPage | null>
  publish(teamId: string, id: string, publishedById: string): Promise<LandingPagePublication | null>
  archive(teamId: string, id: string): Promise<LandingPage | null>
}
