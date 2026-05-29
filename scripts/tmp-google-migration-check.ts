import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const [profilesMissingFk, backofficeMissing, duplicateEmails, brokenLinkedRefs] =
    await Promise.all([
      prisma.$queryRawUnsafe<Array<{ c: number }>>(
        'select count(*)::int as c from corretor_studio_profiles where "googleCalendarConnected"=true and "googleConnectionId" is null'
      ),
      prisma.$queryRawUnsafe<Array<{ c: number }>>(
        'select count(*)::int as c from backoffice_users where "googleCalendarConnected"=true and "googleConnectionId" is null and "linkedCorretorStudioProfileId" is null'
      ),
      prisma.$queryRawUnsafe<Array<{ c: number }>>(
        'select count(*)::int as c from (select "googleEmail", count(*) from google_oauth_connections group by 1 having count(*)>1) t'
      ),
      prisma.$queryRawUnsafe<Array<{ c: number }>>(
        'select count(*)::int as c from backoffice_users b left join corretor_studio_profiles p on p.id=b."linkedCorretorStudioProfileId" where b."linkedCorretorStudioProfileId" is not null and p.id is null'
      ),
    ])

  console.info(
    JSON.stringify(
      {
        profiles_missing_fk: profilesMissingFk[0]?.c ?? 0,
        backoffice_missing_fk_or_link: backofficeMissing[0]?.c ?? 0,
        duplicate_google_email_rows: duplicateEmails[0]?.c ?? 0,
        broken_linked_profile_refs: brokenLinkedRefs[0]?.c ?? 0,
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
