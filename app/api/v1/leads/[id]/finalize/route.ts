import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/api/infra/data/prisma';
import { Output } from '@/lib/output';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;
    const body = await request.json();

    const { amount, startDateAt, finalizedDateAt, notes } = body;

    // Validações
    if (!amount || amount <= 0) {
      return NextResponse.json(
        new Output(false, [], ['O valor do contrato deve ser maior que zero'], null),
        { status: 400 }
      );
    }

    if (!startDateAt) {
      return NextResponse.json(
        new Output(false, [], ['A data de início é obrigatória'], null),
        { status: 400 }
      );
    }

    if (!finalizedDateAt) {
      return NextResponse.json(
        new Output(false, [], ['A data de finalização é obrigatória'], null),
        { status: 400 }
      );
    }

    // Buscar o lead
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json(
        new Output(false, [], ['Lead não encontrado'], null),
        { status: 404 }
      );
    }

    // Calcular a duração em dias desde a criação do lead até a finalização
    const createdAt = new Date(lead.createdAt);
    const finalizedDate = new Date(finalizedDateAt);
    const durationInDays = Math.floor(
      (finalizedDate.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Criar o registro de lead finalizado e atualizar o status do lead em uma transação
    const result = await prisma.$transaction([
      // Criar registro na tabela LeadFinalized
      prisma.leadFinalized.create({
        data: {
          leadId,
          amount: amount,
          startDateAt: new Date(startDateAt),
          finalizedDateAt: new Date(finalizedDateAt),
          duration: durationInDays,
          notes: notes || null,
        },
      }),

      // Atualizar o status do lead para contract_finalized
      prisma.lead.update({
        where: { id: leadId },
        data: {
          status: 'contract_finalized',
          currentValue: amount,
        },
      }),

      // Criar atividade de mudança de status
      prisma.leadActivity.create({
        data: {
          leadId,
          type: 'status_change',
          body: `Contrato finalizado no valor de R$ ${amount.toFixed(2)}`,
          payload: {
            previousStatus: lead.status,
            newStatus: 'contract_finalized',
            amount,
            startDateAt,
            finalizedDateAt,
            duration: durationInDays,
          },
        },
      }),
    ]);

    return NextResponse.json(
      new Output(
        true,
        ['Contrato finalizado com sucesso'],
        [],
        {
          leadFinalized: result[0],
          lead: result[1],
        }
      ),
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro ao finalizar contrato:', error);
    return NextResponse.json(
      new Output(
        false,
        [],
        ['Erro interno ao finalizar contrato'],
        null
      ),
      { status: 500 }
    );
  }
}
