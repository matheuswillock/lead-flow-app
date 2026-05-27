import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const [profileColumns, backofficeColumns] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `select column_name
       from information_schema.columns
       where table_schema='public'
         and table_name='corretor_studio_profiles'
         and column_name like 'google%'
       order by column_name`
    ),
    prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `select column_name
       from information_schema.columns
       where table_schema='public'
         and table_name='backoffice_users'
         and (column_name like 'google%' or column_name='linkedCorretorStudioProfileId')
       order by column_name`
    ),
  ])

  console.info(
    JSON.stringify(
      {
        profile_google_columns: profileColumns.map((item) => item.column_name),
        backoffice_google_columns: backofficeColumns.map((item) => item.column_name),
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
