import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { getBillingSummary } from "@/app/api/services/billing/TeamBillingService";
import { AsaasSubscriptionService } from "@/app/api/services/AsaasSubscription/AsaasSubscriptionService";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getFullUrl } from "@/lib/utils/app-url";
import { getEmailService } from "@/lib/services/EmailService";
import { asaasApi, asaasFetch } from "@/lib/asaas";

export class PendingActionUseCase {
  async applyPendingActionByCheckout(checkoutId: string, paymentId?: string): Promise<Output> {
    const action = await prisma.pendingAction.findFirst({
      where: { checkoutId },
      include: { master: true },
    });

    if (!action) {
      return new Output(false, [], ["Ação pendente não encontrada"], null);
    }

    if (action.status === "applied") {
      return new Output(true, ["Ação já aplicada"], [], action);
    }

    if (action.status === "canceled") {
      return new Output(false, [], ["Ação cancelada"], null);
    }

    try {
      await prisma.$transaction(async (tx) => {
        if (action.actionType === "create_team") {
          const teamName = (action.payload as any)?.name as string | undefined;

          if (!teamName) {
            throw new Error("Nome do time não informado na ação pendente");
          }

          const team = await tx.team.create({
            data: {
              name: teamName,
              masterId: action.masterId,
              isDefault: false,
            },
          });

          await tx.teamMember.create({
            data: {
              teamId: team.id,
              profileId: action.masterId,
              role: "manager",
              functions: action.master.functions ?? [],
            },
          });

          await tx.pendingAction.update({
            where: { id: action.id },
            data: {
              status: "applied",
              paymentId: paymentId ?? action.paymentId,
              teamId: team.id,
            },
          });
          return;
        }

        if (action.actionType === "add_member") {
          const payload = action.payload as any;
          const teamId = action.teamId || payload?.teamId;
          const profileId = payload?.profileId as string | undefined;

          if (!teamId || !profileId) {
            throw new Error("Dados insuficientes para adicionar membro");
          }

          const existingMember = await tx.teamMember.findUnique({
            where: {
              teamId_profileId: {
                teamId,
                profileId,
              },
            },
          });

          if (!existingMember) {
            await tx.teamMember.create({
              data: {
                teamId,
                profileId,
                role: (payload?.role || "operator") as any,
                functions: payload?.functions ?? [],
              },
            });
          }

          await tx.pendingAction.update({
            where: { id: action.id },
            data: {
              status: "applied",
              paymentId: paymentId ?? action.paymentId,
              teamId,
            },
          });
          return;
        }

        if (action.actionType === "add_user") {
          const payload = action.payload as any;
          const teamId = action.teamId || payload?.teamId;
          const email = (payload?.email as string | undefined)?.trim().toLowerCase();
          const name = payload?.name as string | undefined;
          const role = payload?.role || "operator";
          const functions = payload?.functions ?? [];

          if (!teamId || !email || !name) {
            throw new Error("Dados insuficientes para criar usuário");
          }

          let profile = await tx.profile.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
            select: { id: true },
          });

          if (!profile) {
            profile = await tx.profile.create({
              data: {
                fullName: name,
                email,
                role,
                functions,
                managerId: action.masterId,
                isMaster: false,
              },
              select: { id: true },
            });
          }

          const existingMember = await tx.teamMember.findUnique({
            where: {
              teamId_profileId: {
                teamId,
                profileId: profile.id,
              },
            },
          });

          if (!existingMember) {
            await tx.teamMember.create({
              data: {
                teamId,
                profileId: profile.id,
                role,
                functions,
              },
            });
          }

          await tx.pendingAction.update({
            where: { id: action.id },
            data: {
              status: "applied",
              paymentId: paymentId ?? action.paymentId,
              teamId,
            },
          });
          return;
        }

        if (action.actionType === "transfer_team") {
          const payload = action.payload as any;
          const teamId = action.teamId || payload?.teamId;
          const newMasterId = payload?.newMasterId as string | undefined;

          if (!teamId || !newMasterId) {
            throw new Error("Dados insuficientes para transferir time");
          }

          const team = await tx.team.findUnique({
            where: { id: teamId },
            select: { masterId: true },
          });

          if (!team) {
            throw new Error("Time não encontrado");
          }

          await tx.team.update({
            where: { id: teamId },
            data: { masterId: newMasterId },
          });

          await tx.teamMember.update({
            where: {
              teamId_profileId: {
                teamId,
                profileId: newMasterId,
              },
            },
            data: { role: "manager" },
          });

          await tx.profile.update({
            where: { id: newMasterId },
            data: { isMaster: true },
          });

          await tx.pendingAction.update({
            where: { id: action.id },
            data: {
              status: "applied",
              paymentId: paymentId ?? action.paymentId,
              teamId,
            },
          });
          return;
        } else {
          throw new Error(`Tipo de ação não suportado: ${action.actionType}`);
        }
      });

      if (action.actionType === "add_user") {
        const payload = action.payload as any;
        const email = (payload?.email as string | undefined)?.trim().toLowerCase();
        const name = payload?.name as string | undefined;
        if (email && name) {
          try {
            const supabaseAdmin = createSupabaseAdmin();
            const emailService = getEmailService();
            const redirectTo = getFullUrl("/set-password");

            if (supabaseAdmin) {
              const { data, error } = await supabaseAdmin.auth.admin.generateLink({
                type: "invite",
                email,
                options: {
                  redirectTo,
                  data: {
                    name,
                    invited: true,
                    first_access: true,
                  },
                },
              });

              if (!error && data?.properties?.action_link) {
                const supabaseUserId = (data as any)?.user?.id as string | undefined;
                if (supabaseUserId) {
                  await prisma.profile.update({
                    where: { email },
                    data: { supabaseId: supabaseUserId },
                  });
                }

                await emailService.sendOperatorInviteEmail({
                  operatorName: name,
                  operatorEmail: email,
                  operatorRole: payload?.role || "operator",
                  managerName: action.master.fullName || action.master.email,
                  inviteUrl: data.properties.action_link,
                });
              }
            }
          } catch (inviteError) {
            console.warn("Erro ao enviar convite do usuário pendente:", inviteError);
          }
        }
      }

      const summary = await getBillingSummary(action.masterId);

      if (!summary.hasPermanentSubscription && action.master.asaasSubscriptionId) {
        await AsaasSubscriptionService.updateSubscription(action.master.asaasSubscriptionId, {
          value: summary.totalPrice,
        });
      }

      return new Output(true, ["Ação pendente aplicada com sucesso"], [], null);
    } catch (error: any) {
      console.error("Erro ao aplicar ação pendente:", error);

      await prisma.pendingAction.update({
        where: { id: action.id },
        data: {
          status: "failed",
          paymentId: paymentId ?? action.paymentId,
        },
      });

      return new Output(false, [], [error?.message || "Erro ao aplicar ação pendente"], null);
    }
  }

  async applyPendingActionByPaymentId(paymentId: string): Promise<Output> {
    let action = await prisma.pendingAction.findFirst({
      where: { paymentId },
      include: { master: true },
    });

    if (!action) {
      try {
        const payment = await asaasFetch(`${asaasApi.payments}/${paymentId}`, { method: "GET" });
        const externalReference = payment?.externalReference as string | undefined;

        if (externalReference?.startsWith("pending-action-")) {
          const actionId = externalReference.replace("pending-action-", "");
          action = await prisma.pendingAction.findUnique({
            where: { id: actionId },
            include: { master: true },
          });

          if (action && !action.paymentId) {
            await prisma.pendingAction.update({
              where: { id: action.id },
              data: { paymentId },
            });
            action = { ...action, paymentId };
          }
        }
      } catch (error) {
        console.warn("[applyPendingActionByPaymentId] Erro ao buscar payment no Asaas:", error);
      }
    }

    if (!action) {
      return new Output(false, [], ["Ação pendente não encontrada"], null);
    }

    if (action.status === "applied") {
      return new Output(true, ["Ação já aplicada"], [], action);
    }

    if (action.status === "canceled") {
      return new Output(false, [], ["Ação cancelada"], null);
    }

    try {
      await prisma.$transaction(async (tx) => {
        if (action.actionType === "create_team") {
          const teamName = (action.payload as any)?.name as string | undefined;

          if (!teamName) {
            throw new Error("Nome do time não informado na ação pendente");
          }

          const team = await tx.team.create({
            data: {
              name: teamName,
              masterId: action.masterId,
              isDefault: false,
            },
          });

          await tx.teamMember.create({
            data: {
              teamId: team.id,
              profileId: action.masterId,
              role: "manager",
              functions: action.master.functions ?? [],
            },
          });

          await tx.pendingAction.update({
            where: { id: action.id },
            data: {
              status: "applied",
              paymentId: paymentId ?? action.paymentId,
              teamId: team.id,
            },
          });
          return;
        }

        if (action.actionType === "add_member") {
          const payload = action.payload as any;
          const teamId = action.teamId || payload?.teamId;
          const profileId = payload?.profileId as string | undefined;

          if (!teamId || !profileId) {
            throw new Error("Dados insuficientes para adicionar membro");
          }

          const existingMember = await tx.teamMember.findUnique({
            where: {
              teamId_profileId: {
                teamId,
                profileId,
              },
            },
          });

          if (!existingMember) {
            await tx.teamMember.create({
              data: {
                teamId,
                profileId,
                role: (payload?.role || "operator") as any,
                functions: payload?.functions ?? [],
              },
            });
          }

          await tx.pendingAction.update({
            where: { id: action.id },
            data: {
              status: "applied",
              paymentId: paymentId ?? action.paymentId,
              teamId,
            },
          });
          return;
        }

        if (action.actionType === "add_user") {
          const payload = action.payload as any;
          const teamId = action.teamId || payload?.teamId;
          const email = (payload?.email as string | undefined)?.trim().toLowerCase();
          const name = payload?.name as string | undefined;
          const role = payload?.role || "operator";
          const functions = payload?.functions ?? [];

          if (!teamId || !email || !name) {
            throw new Error("Dados insuficientes para criar usuário");
          }

          let profile = await tx.profile.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
            select: { id: true },
          });

          if (!profile) {
            profile = await tx.profile.create({
              data: {
                fullName: name,
                email,
                role,
                functions,
                managerId: action.masterId,
                isMaster: false,
              },
              select: { id: true },
            });
          }

          const existingMember = await tx.teamMember.findUnique({
            where: {
              teamId_profileId: {
                teamId,
                profileId: profile.id,
              },
            },
          });

          if (!existingMember) {
            await tx.teamMember.create({
              data: {
                teamId,
                profileId: profile.id,
                role,
                functions,
              },
            });
          }

          await tx.pendingAction.update({
            where: { id: action.id },
            data: {
              status: "applied",
              paymentId: paymentId ?? action.paymentId,
              teamId,
            },
          });
          return;
        }

        if (action.actionType === "transfer_team") {
          const payload = action.payload as any;
          const teamId = action.teamId || payload?.teamId;
          const newMasterId = payload?.newMasterId as string | undefined;

          if (!teamId || !newMasterId) {
            throw new Error("Dados insuficientes para transferir time");
          }

          const team = await tx.team.findUnique({
            where: { id: teamId },
            select: { masterId: true },
          });

          if (!team) {
            throw new Error("Time não encontrado");
          }

          await tx.team.update({
            where: { id: teamId },
            data: { masterId: newMasterId },
          });

          await tx.teamMember.update({
            where: {
              teamId_profileId: {
                teamId,
                profileId: newMasterId,
              },
            },
            data: { role: "manager" },
          });

          await tx.profile.update({
            where: { id: newMasterId },
            data: { isMaster: true },
          });

          await tx.pendingAction.update({
            where: { id: action.id },
            data: {
              status: "applied",
              paymentId: paymentId ?? action.paymentId,
              teamId,
            },
          });
          return;
        }

        throw new Error(`Tipo de ação não suportado: ${action.actionType}`);
      });

      if (action.actionType === "add_user") {
        const payload = action.payload as any;
        const email = (payload?.email as string | undefined)?.trim().toLowerCase();
        const name = payload?.name as string | undefined;
        if (email && name) {
          try {
            const supabaseAdmin = createSupabaseAdmin();
            const emailService = getEmailService();
            const redirectTo = getFullUrl("/set-password");

            if (supabaseAdmin) {
              const { data, error } = await supabaseAdmin.auth.admin.generateLink({
                type: "invite",
                email,
                options: {
                  redirectTo,
                  data: {
                    name,
                    invited: true,
                    first_access: true,
                  },
                },
              });

              if (!error && data?.properties?.action_link) {
                const supabaseUserId = (data as any)?.user?.id as string | undefined;
                if (supabaseUserId) {
                  await prisma.profile.update({
                    where: { email },
                    data: { supabaseId: supabaseUserId },
                  });
                }

                await emailService.sendOperatorInviteEmail({
                  operatorName: name,
                  operatorEmail: email,
                  operatorRole: payload?.role || "operator",
                  managerName: action.master.fullName || action.master.email,
                  inviteUrl: data.properties.action_link,
                });
              }
            }
          } catch (inviteError) {
            console.warn("Erro ao enviar convite do usuário pendente:", inviteError);
          }
        }
      }

      const summary = await getBillingSummary(action.masterId);

      if (!summary.hasPermanentSubscription && action.master.asaasSubscriptionId) {
        await AsaasSubscriptionService.updateSubscription(action.master.asaasSubscriptionId, {
          value: summary.totalPrice,
        });
      }

      return new Output(true, ["Ação pendente aplicada com sucesso"], [], null);
    } catch (error: any) {
      console.error("Erro ao aplicar ação pendente:", error);

      await prisma.pendingAction.update({
        where: { id: action.id },
        data: {
          status: "failed",
          paymentId: paymentId ?? action.paymentId,
        },
      });

      return new Output(false, [], [error?.message || "Erro ao aplicar ação pendente"], null);
    }
  }
}

export const pendingActionUseCase = new PendingActionUseCase();
