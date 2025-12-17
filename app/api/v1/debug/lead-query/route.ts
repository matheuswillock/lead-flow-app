import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/api/infra/data/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const leadId = searchParams.get('leadId');

    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório" }, { status: 400 });
    }

    // Buscar informações do usuário
    const user = await prisma.profile.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isMaster: true,
        managerId: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // Determinar o masterId esperado
    const expectedMasterId = user.isMaster ? user.id : user.managerId;

    // Buscar lead específico se fornecido
    let lead = null;
    if (leadId) {
      lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: {
          id: true,
          name: true,
          managerId: true,
          createdBy: true,
          assignedTo: true,
        }
      });
    }

    // Buscar todos os leads desse manager
    const leadsForUser = await prisma.lead.findMany({
      where: {
        OR: [
          { managerId: user.id },
          { managerId: expectedMasterId || undefined }
        ]
      },
      select: {
        id: true,
        name: true,
        managerId: true,
        createdBy: true,
        assignedTo: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      debug: {
        user: {
          ...user,
          expectedMasterId,
          queryWouldSearchFor: expectedMasterId
        },
        specificLead: lead,
        allLeadsFound: leadsForUser,
        totalLeadsFound: leadsForUser.length,
        analysis: {
          userIsMaster: user.isMaster,
          userHasManagerId: !!user.managerId,
          searchingForManagerId: expectedMasterId,
          leadsWithUserAsManager: leadsForUser.filter(l => l.managerId === user.id).length,
          leadsWithExpectedManager: leadsForUser.filter(l => l.managerId === expectedMasterId).length,
        }
      }
    });

  } catch (error) {
    console.error("Erro no debug:", error);
    return NextResponse.json(
      { error: "Erro interno", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
