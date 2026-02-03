"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Settings, UserPlus, ShieldAlert, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTeamContext } from "@/app/context/TeamContext";
import { useUser } from "@/app/context/UserContext";

type BillingSummary = {
  teamCount: number;
  distinctUserCount: number;
  totalUsersIncludingMaster: number;
  billableTeams: number;
  billableUsers: number;
  basePrice: number;
  extraTeamsPrice: number;
  extraUsersPrice: number;
  totalPrice: number;
  hasPermanentSubscription: boolean;
};

type TeamMember = {
  id: string;
  profileId: string;
  name: string;
  email: string;
  role: "manager" | "operator";
  functions: ("SDR" | "CLOSER")[];
  profileIconUrl: string | null;
  isMaster: boolean;
};

type EligibleProfile = {
  id: string;
  name: string;
  email: string;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export default function TeamsPage() {
  const { user } = useUser();
  const { teams, activeTeamId, setActiveTeamId, refreshTeams, isLoading: teamsLoading, error: teamsError } = useTeamContext();
  const [switchingTeamId, setSwitchingTeamId] = useState<string | null>(null);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [manageTeamId, setManageTeamId] = useState<string | null>(null);
  const [manageTeamName, setManageTeamName] = useState("");
  const [manageLoading, setManageLoading] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [eligibleProfiles, setEligibleProfiles] = useState<EligibleProfile[]>([]);
  const [transferCandidates, setTransferCandidates] = useState<EligibleProfile[]>([]);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"delete" | "transfer" | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [transferCandidateId, setTransferCandidateId] = useState("");

  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const isOnlyMasterTeam = user?.id
    ? teams.filter((team) => team.masterId === user.id).length <= 1
    : false;

  const handleSetActiveTeam = async (teamId: string) => {
    if (!teamId || teamId === activeTeamId) {
      return;
    }

    setSwitchingTeamId(teamId);
    try {
      await setActiveTeamId(teamId);
      toast.success("Time ativo atualizado.");
    } catch (error) {
      console.error("Erro ao atualizar time ativo:", error);
      toast.error("Não foi possível atualizar o time ativo.");
    } finally {
      setSwitchingTeamId(null);
    }
  };

  const handleCreateTeam = async () => {
    const trimmedName = newTeamName.trim();
    if (!trimmedName) {
      toast.error("Informe um nome para o time.");
      return;
    }

    setIsCreatingTeam(true);
    try {
      const response = await fetch("/api/v1/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
        },
        body: JSON.stringify({ name: trimmedName }),
      });

      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Nao foi possivel criar o time.");
      }

      if (result?.result?.checkoutUrl) {
        window.location.href = result.result.checkoutUrl as string;
        return;
      }

      toast.success("Time criado com sucesso!");
      setIsCreateTeamOpen(false);
      setNewTeamName("");
      await refreshTeams();
      await loadBillingSummary();
    } catch (error: any) {
      console.error("Erro ao criar time:", error);
      toast.error(error?.message || "Erro ao criar time.");
    } finally {
      setIsCreatingTeam(false);
    }
  };

  const loadManageData = async (teamId: string) => {
    if (!teamId) return;
    setManageLoading(true);
    try {
      const response = await fetch(`/api/v1/teams/${teamId}/members`, {
        headers: { "x-supabase-user-id": supabaseId },
      });
      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Nao foi possivel carregar o time.");
      }

      const payload = result.result as {
        team: { id: string; name: string };
        members: TeamMember[];
        eligibleProfiles: EligibleProfile[];
        transferCandidates: EligibleProfile[];
      };

      setMembers(payload.members || []);
      setEligibleProfiles(payload.eligibleProfiles || []);
      setTransferCandidates(payload.transferCandidates || []);
      setRenameValue(payload.team.name || "");
      setManageTeamName(payload.team.name || "");
      if (payload.transferCandidates?.length) {
        setTransferCandidateId(payload.transferCandidates[0].id);
      } else {
        setTransferCandidateId("");
      }
    } catch (error: any) {
      console.error("Erro ao carregar membros:", error);
      toast.error(error?.message || "Erro ao carregar dados do time.");
    } finally {
      setManageLoading(false);
    }
  };

  const handleOpenManageTeam = (teamId: string, teamName: string) => {
    setManageTeamId(teamId);
    setManageTeamName(teamName);
    setIsManageOpen(true);
    setSelectedProfileId("");
    setSelectedProfileId("");
    loadManageData(teamId);
  };

  const handleRenameTeam = async () => {
    if (!manageTeamId) return;
    const trimmedName = renameValue.trim();
    if (!trimmedName) {
      toast.error("Informe um nome valido para o time.");
      return;
    }

    setIsRenaming(true);
    try {
      const response = await fetch(`/api/v1/teams/${manageTeamId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
        },
        body: JSON.stringify({ name: trimmedName }),
      });
      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Nao foi possivel atualizar o time.");
      }
      toast.success("Nome do time atualizado.");
      setManageTeamName(trimmedName);
      await refreshTeams();
    } catch (error: any) {
      console.error("Erro ao atualizar time:", error);
      toast.error(error?.message || "Erro ao atualizar time.");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleAddMember = async () => {
    if (!manageTeamId || !selectedProfileId) {
      toast.error("Selecione um usuario para adicionar.");
      return;
    }

    setIsAddingMember(true);
    try {
      const response = await fetch(`/api/v1/teams/${manageTeamId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
        },
        body: JSON.stringify({
          profileId: selectedProfileId,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Nao foi possivel adicionar membro.");
      }
      toast.success("Membro adicionado.");
      setSelectedProfileId("");
      await loadManageData(manageTeamId);
      await refreshTeams();
    } catch (error: any) {
      console.error("Erro ao adicionar membro:", error);
      toast.error(error?.message || "Erro ao adicionar membro.");
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (profileId: string) => {
    if (!manageTeamId) return;
    setRemovingMemberId(profileId);
    try {
      const response = await fetch(`/api/v1/teams/${manageTeamId}/members`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
        },
        body: JSON.stringify({ profileId }),
      });
      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Nao foi possivel remover membro.");
      }
      toast.success("Membro removido.");
      await loadManageData(manageTeamId);
      await refreshTeams();
    } catch (error: any) {
      console.error("Erro ao remover membro:", error);
      toast.error(error?.message || "Erro ao remover membro.");
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction || !manageTeamId) return;
    if (!confirmPassword) {
      toast.error("Informe sua senha para confirmar.");
      return;
    }

    setConfirming(true);
    try {
      if (confirmAction === "delete") {
        const response = await fetch(`/api/v1/teams/${manageTeamId}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
          },
          body: JSON.stringify({ password: confirmPassword }),
        });
        const result = await response.json();
        if (!response.ok || !result?.isValid) {
          throw new Error(result?.errorMessages?.join(", ") || "Nao foi possivel deletar o time.");
        }
        toast.success("Time deletado com sucesso.");
        setIsManageOpen(false);
        await refreshTeams();
        await loadBillingSummary();
      }

      if (confirmAction === "transfer") {
        if (!transferCandidateId) {
          toast.error("Selecione um novo master para transferir.");
          return;
        }
        const response = await fetch(`/api/v1/teams/${manageTeamId}/transfer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
          },
          body: JSON.stringify({
            newMasterId: transferCandidateId,
            password: confirmPassword,
          }),
        });
        const result = await response.json();
        if (!response.ok || !result?.isValid) {
          throw new Error(result?.errorMessages?.join(", ") || "Nao foi possivel transferir o time.");
        }
        toast.success("Time transferido com sucesso.");
        setIsManageOpen(false);
        await refreshTeams();
        await loadBillingSummary();
      }
    } catch (error: any) {
      console.error("Erro ao confirmar acao:", error);
      toast.error(error?.message || "Erro ao confirmar acao.");
    } finally {
      setConfirming(false);
      setConfirmAction(null);
      setConfirmPassword("");
    }
  };


  const loadBillingSummary = async () => {
    if (!user?.isMaster || !supabaseId) {
      setBillingSummary(null);
      return;
    }

    setBillingLoading(true);
    try {
      const response = await fetch("/api/v1/billing/summary", {
        headers: { "x-supabase-user-id": supabaseId },
      });
      const result = await response.json();

      if (response.ok && result?.isValid) {
        setBillingSummary(result.result as BillingSummary);
      } else {
        setBillingSummary(null);
      }
    } catch (error) {
      console.error("Erro ao buscar resumo de cobrança:", error);
      setBillingSummary(null);
    } finally {
      setBillingLoading(false);
    }
  };

  useEffect(() => {
    loadBillingSummary();
  }, [user?.isMaster, supabaseId, teams.length]);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="container mx-auto max-w-4xl px-4 py-10">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Gerenciar times</CardTitle>
            <p className="text-sm text-muted-foreground">
              Gerencie os times aos quais voce pertence e defina o time ativo.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {teams.length} time(s) encontrado(s).
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={refreshTeams}
                  disabled={teamsLoading}
                >
                  {teamsLoading ? "Atualizando..." : "Atualizar"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsCreateTeamOpen(true)}
                  disabled={!user?.isMaster}
                >
                  Criar time
                </Button>
              </div>
            </div>

            {user?.isMaster ? (
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Resumo de cobranca</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {billingLoading ? (
                    <p className="text-sm text-muted-foreground">Carregando resumo...</p>
                  ) : billingSummary ? (
                    <>
                      <div className="grid gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>Times cadastrados</span>
                          <span className="font-medium text-foreground">
                            {billingSummary.teamCount}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Usuarios (distinct)</span>
                          <span className="font-medium text-foreground">
                            {billingSummary.distinctUserCount}
                          </span>
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span>Base (1 time)</span>
                          <span className="font-medium">
                            {formatCurrency(billingSummary.basePrice)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Times adicionais</span>
                          <span className="font-medium">
                            {formatCurrency(billingSummary.extraTeamsPrice)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Usuarios adicionais</span>
                          <span className="font-medium">
                            {formatCurrency(billingSummary.extraUsersPrice)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-base font-semibold">
                          <span>Total</span>
                          <span>{formatCurrency(billingSummary.totalPrice)}</span>
                        </div>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
                        {billingSummary.hasPermanentSubscription
                          ? "Assinatura permanente ativa. Nenhuma cobranca sera gerada."
                          : "Base inclui 1 time. Times extras custam R$ 29,90 cada e usuarios adicionais R$ 19,90 cada (master incluso na base)."}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nao foi possivel carregar o resumo de cobranca.
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : null}

            {teamsError ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                {teamsError}
              </div>
            ) : teamsLoading ? (
              <div className="flex items-center justify-center rounded-lg border border-border/60 py-10 text-sm text-muted-foreground">
                Carregando times...
              </div>
            ) : teams.length === 0 ? (
              <div className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
                Nenhum time encontrado para este usuario.
              </div>
            ) : (
              <div className="space-y-3">
                {teams.map((team) => {
                  const isActive = team.id === activeTeamId
                  const isMaster = user?.id && team.masterId === user.id
                  return (
                    <div
                      key={team.id}
                      className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border/60 p-4"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{team.name}</p>
                          {isActive ? (
                            <Badge className="rounded-full px-3 py-1 text-xs">Ativo</Badge>
                          ) : null}
                          {team.isDefault ? (
                            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                              Time padrao
                            </Badge>
                          ) : null}
                          {isMaster ? (
                            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                              Master
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>Papel: {team.role === "manager" ? "Manager" : "Operator"}</span>
                          {team.functions?.length ? (
                            <span>Funcoes: {team.functions.join(", ")}</span>
                          ) : (
                            <span>Sem funcoes</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant={isActive ? "outline" : "default"}
                          disabled={isActive || switchingTeamId === team.id}
                          onClick={() => handleSetActiveTeam(team.id)}
                        >
                          {switchingTeamId === team.id
                            ? "Alterando..."
                            : isActive
                              ? "Time ativo"
                              : "Definir ativo"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenManageTeam(team.id, team.name)}
                          aria-label={`Gerenciar ${team.name}`}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isCreateTeamOpen} onOpenChange={setIsCreateTeamOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Criar novo time</DialogTitle>
            <DialogDescription>
              Informe um nome para o time. Se houver cobranca adicional, voce sera direcionado ao
              checkout.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="teamName">Nome do time</Label>
            <Input
              id="teamName"
              value={newTeamName}
              onChange={(event) => setNewTeamName(event.target.value)}
              placeholder="Ex: Time Comercial"
              disabled={isCreatingTeam}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateTeamOpen(false)}
              disabled={isCreatingTeam}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleCreateTeam} disabled={isCreatingTeam}>
              {isCreatingTeam ? "Criando..." : "Criar time"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isManageOpen}
        onOpenChange={(open) => {
          setIsManageOpen(open)
          if (!open) {
            setManageTeamId(null)
            setMembers([])
            setEligibleProfiles([])
            setTransferCandidates([])
            setConfirmAction(null)
            setConfirmPassword("")
          }
        }}
      >
        <DialogContent className="sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>Gerenciar time</DialogTitle>
            <DialogDescription>
              {manageTeamName
                ? `Time selecionado: ${manageTeamName}.`
                : "Atualize as configuracoes do time."}
            </DialogDescription>
          </DialogHeader>

          {manageLoading ? (
            <div className="flex items-center justify-center rounded-lg border border-border/60 py-10 text-sm text-muted-foreground">
              Carregando dados do time...
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label>Nome do time</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    placeholder="Nome do time"
                    disabled={!user?.isMaster || isRenaming}
                  />
                  <Button
                    type="button"
                    onClick={handleRenameTeam}
                    disabled={!user?.isMaster || isRenaming || !renameValue.trim()}
                  >
                    {isRenaming ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium">Gerenciar membros</h3>
                    <p className="text-xs text-muted-foreground">
                      Adicione ou remova membros deste time.
                    </p>
                  </div>
                  {!user?.isMaster ? (
                    <Badge variant="outline" className="text-xs">
                      Apenas master
                    </Badge>
                  ) : null}
                </div>

                {user?.isMaster ? (
                  <div className="space-y-3 rounded-lg border border-border/60 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <UserPlus className="h-4 w-4" />
                      Adicionar membro
                    </div>
                    <div className="space-y-2">
                      <Label>Usuário</Label>
                      <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um usuario" />
                        </SelectTrigger>
                        <SelectContent>
                          {eligibleProfiles.map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              {profile.name} ({profile.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-end">
                      <Button
                        type="button"
                        onClick={handleAddMember}
                        disabled={isAddingMember || !selectedProfileId}
                      >
                        {isAddingMember ? "Adicionando..." : "Adicionar membro"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-lg border border-border/60">
                  <ScrollArea className="h-[320px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Papel</TableHead>
                          <TableHead>Funções</TableHead>
                          <TableHead className="w-[80px] text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {members.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                              Nenhum membro encontrado para este time.
                            </TableCell>
                          </TableRow>
                        ) : (
                          members.map((member) => (
                            <TableRow key={member.id}>
                              <TableCell className="text-sm font-medium">{member.name}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{member.email}</TableCell>
                              <TableCell className="text-sm">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span>{member.role === "manager" ? "Manager" : "Operator"}</span>
                                  {member.isMaster ? <Badge variant="secondary">Master</Badge> : null}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {member.functions?.length ? member.functions.join(", ") : "Sem funções"}
                              </TableCell>
                              <TableCell className="text-right">
                                {user?.isMaster && !member.isMaster ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveMember(member.profileId)}
                                        disabled={removingMemberId === member.profileId}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Remover</TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </div>

              {user?.isMaster ? (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2 text-base font-semibold">
                        <ShieldAlert className="h-4 w-4 text-destructive" />
                        Zona de Perigo
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Ações irreversíveis. Proceda com cautela.
                      </p>
                    </div>

                    <div className="rounded-md border border-red-600/30 bg-muted/20">
                      {manageTeamId && manageTeamId === activeTeamId && isOnlyMasterTeam ? null : (
                        <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Deletar time</p>
                            <p className="text-xs text-muted-foreground">
                              Remove o time e todos os dados vinculados (leads, membros,
                              agendamentos).
                            </p>
                          </div>
                          <Button
                            type="button"
                            className="h-9 font-medium border-foreground/20 hover:border-red-400 border-1 bg-transparent hover:bg-red-500 text-red-500/90 hover:text-foreground cursor-pointer"
                            onClick={() => setConfirmAction("delete")}
                          >
                            Deletar time
                          </Button>
                        </div>
                      )}
                      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Transferir time</p>
                          <p className="text-xs text-muted-foreground">
                            O novo master assumira a cobranca e a gestao deste time.
                          </p>
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[260px]">
                          <Select
                            value={transferCandidateId}
                            onValueChange={setTransferCandidateId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um novo master" />
                            </SelectTrigger>
                            <SelectContent>
                              {transferCandidates.map((candidate) => (
                                <SelectItem key={candidate.id} value={candidate.id}>
                                  {candidate.name} ({candidate.email})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (!transferCandidateId) {
                                toast.error("Selecione um novo master.")
                                return
                              }
                              setConfirmAction("transfer")
                            }}
                          >
                            Transferir time
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null)
            setConfirmPassword("")
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "delete"
                ? "Confirmar delecao do time"
                : "Confirmar transferencia do time"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "delete"
                ? "Esta acao e irreversivel e remove o time permanentemente."
                : "Ao transferir, o novo master assumira a cobranca e o gerenciamento do time."}
            </DialogDescription>
          </DialogHeader>
          {confirmAction === "delete" ? (
            <div className="rounded-md border border-red-600/30 bg-muted/20 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Voce perdera:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Leads cadastrados neste time</li>
                <li>Agendamentos vinculados ao time</li>
                <li>Usuarios deste time perderao acesso se nao estiverem em outro time</li>
              </ul>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Digite sua senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Senha da conta"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmAction(null)
                setConfirmPassword("")
              }}
              disabled={confirming}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant={confirmAction === "delete" ? "destructive" : "default"}
              onClick={handleConfirmAction}
              disabled={confirming || !confirmPassword}
            >
              {confirming ? "Confirmando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
