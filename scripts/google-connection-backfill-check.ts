import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const [missingFk, missingWithEmail, missingWithoutEmail] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ c: number }>>(
      'select count(*)::int as c from corretor_studio_profiles where "googleCalendarConnected"=true and "googleConnectionId" is null'
    ),
    prisma.$queryRawUnsafe<Array<{ c: number }>>(
      'select count(*)::int as c from corretor_studio_profiles where "googleCalendarConnected"=true and "googleConnectionId" is null and "googleEmail" is not null'
    ),
    prisma.$queryRawUnsafe<Array<{ c: number }>>(
      'select count(*)::int as c from corretor_studio_profiles where "googleCalendarConnected"=true and "googleConnectionId" is null and "googleEmail" is null'
    ),
  ])

  console.info(
    JSON.stringify(
      {
        profiles_missing_google_connection_id: missingFk[0]?.c ?? 0,
        profiles_missing_google_connection_id_with_email: missingWithEmail[0]?.c ?? 0,
        profiles_missing_google_connection_id_without_email: missingWithoutEmail[0]?.c ?? 0,
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
