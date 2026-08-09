npm warn Unknown env config "devdir". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
═══════════════════════════════════════════════════
🔍 INVESTIGAÇÃO: Campanhas Katherein
═══════════════════════════════════════════════════

📋 Buscando time Katherein...

❌ Erro na investigação:
PrismaClientValidationError: 
Invalid `prisma.team.findFirst()` invocation in
/home/matheuswillock/develop/lead-flow-app/scripts/investigate-katherein.ts:21:43

  18 // 1. Buscar time Katherein
  19 console.log('📋 Buscando time Katherein...\n');
  20 
→ 21 const kathereinTeam = await prisma.team.findFirst({
       where: {
         OR: [
           {
             ownerProfile: {
               email: {
                 contains: "katherein",
                 mode: "insensitive"
               }
             }
           },
           {
             name: {
               contains: "katherein",
               mode: "insensitive"
             }
           }
         ]
       },
       include: {
         ownerProfile: {
           select: {
             email: true
           }
         }
       }
     })

Unknown argument `ownerProfile`. Available options are marked with ?.
    at throwValidationException (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/core/errorRendering/throwValidationException.ts:45:9)
    at ei.handleRequestError (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/RequestHandler.ts:202:7)
    at ei.handleAndLogRequestError (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/RequestHandler.ts:174:12)
    at ei.request (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/RequestHandler.ts:143:12)
    at async a (/home/matheuswillock/develop/lead-flow-app/node_modules/@prisma/client/src/runtime/getPrismaClient.ts:833:24)
    at async main (/home/matheuswillock/develop/lead-flow-app/scripts/investigate-katherein.ts:21:25) {
  clientVersion: '6.19.3'
}
