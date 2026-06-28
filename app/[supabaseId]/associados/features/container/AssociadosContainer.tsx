"use client";

import { useRef, useState } from "react";
import { Handshake } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAssociadosContext } from "../context/AssociadosContext";
import type { AssociateProposalRow } from "../context/AssociadosTypes";

function formatCurrency(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function AssociadosContainer() {
  const {
    isLoading,
    error,
    data,
    filters,
    setFilters,
    load,
    openLead,
    drawerOpen,
    closeDrawer,
    selectedLeadId,
    criticize,
    registerSale,
  } = useAssociadosContext();

  const selectedRow = data?.items.find((item) => item.leadId === selectedLeadId) ?? null;

  const [criticizeOpen, setCriticizeOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [criticizeTitle, setCriticizeTitle] = useState("");
  const [criticizeMessage, setCriticizeMessage] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [proposalNumber, setProposalNumber] = useState("");
  const [saleNotes, setSaleNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  async function handleCriticizeSubmit() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      await criticize({ title: criticizeTitle, message: criticizeMessage });
      toast.success("Proposta criticada");
      setCriticizeOpen(false);
      setCriticizeTitle("");
      setCriticizeMessage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criticar");
    } finally {
      setSubmitting(false);
      inFlight.current = false;
    }
  }

  async function handleRegisterSubmit() {
    if (inFlight.current || !operatorName.trim()) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      await registerSale({
        operatorName: operatorName.trim(),
        proposalNumber: proposalNumber.trim() || undefined,
        notes: saleNotes.trim() || undefined,
      });
      toast.success("Venda registrada");
      setRegisterOpen(false);
      setOperatorName("");
      setProposalNumber("");
      setSaleNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar venda");
    } finally {
      setSubmitting(false);
      inFlight.current = false;
    }
  }

  return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Handshake />
            <h1 className="text-2xl font-semibold tracking-tight">Associados</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Propostas aguardando registro de venda na operadora
          </p>
        </div>

        <Card>
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <Field className="flex-1">
                <FieldLabel htmlFor="associados-search">Busca</FieldLabel>
                <Input
                  id="associados-search"
                  placeholder="Nome, telefone ou código"
                  value={filters.search}
                  onChange={(e) => setFilters({ search: e.target.value })}
                />
              </Field>
              <Button variant="outline" onClick={() => setFilters({ search: "" })}>
                Limpar filtros
              </Button>
              <Button variant="secondary" onClick={() => void load()}>
                Atualizar
              </Button>
            </div>
            <p className="text-muted-foreground text-sm">
              {data?.pagination.totalItems ?? 0} proposta(s) pendente(s)
            </p>
          </CardHeader>
          <CardContent>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription className="flex items-center justify-between gap-4">
                  <span>{error}</span>
                  <Button size="sm" variant="outline" onClick={() => void load()}>
                    Tentar novamente
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}

            {isLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conta</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Closer</TableHead>
                    <TableHead>Enviado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.items ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-muted-foreground py-10 text-center">
                        Nenhuma proposta aguardando registro
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.items.map((row: AssociateProposalRow) => (
                      <TableRow key={row.leadId}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span>{row.associateAccountName}</span>
                            <Badge
                              variant="outline"
                              className="w-fit border-precision-border-soft bg-precision-indigo/10 text-precision-indigo"
                            >
                              Associado
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>{row.teamName}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{row.leadName}</span>
                            <span className="text-muted-foreground text-xs">{row.leadCode}</span>
                          </div>
                        </TableCell>
                        <TableCell>{row.soldPlan ?? "—"}</TableCell>
                        <TableCell>{formatCurrency(row.ticket)}</TableCell>
                        <TableCell>{row.closerName ?? "—"}</TableCell>
                        <TableCell>
                          {new Date(row.statusEnteredAt).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => openLead(row.leadId)}>
                            Detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Sheet open={drawerOpen} onOpenChange={(open) => !open && closeDrawer()}>
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>{selectedRow?.leadName ?? "Detalhe"}</SheetTitle>
            </SheetHeader>
            {selectedRow ? (
              <div className="flex flex-col gap-4 p-4">
                <div className="text-sm">
                  <p>
                    <span className="text-muted-foreground">Conta:</span> {selectedRow.associateAccountName}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Time:</span> {selectedRow.teamName}
                  </p>
                  {selectedRow.reviewStatus === "criticized" ? (
                    <Badge variant="destructive" className="mt-2">
                      Proposta criticada
                    </Badge>
                  ) : null}
                  {selectedRow.requiredDocumentsSummary.pending > 0 ? (
                    <Badge variant="outline" className="mt-2 border-semantic-warning-border text-semantic-warning">
                      Docs pendentes
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  <Button onClick={() => setRegisterOpen(true)}>Registrar venda</Button>
                  <Button
                    variant="outline"
                    disabled={selectedRow.reviewStatus === "criticized"}
                    onClick={() => setCriticizeOpen(true)}
                  >
                    Criticar proposta
                  </Button>
                </div>
              </div>
            ) : null}
          </SheetContent>
        </Sheet>

        <Dialog open={criticizeOpen} onOpenChange={submitting ? undefined : setCriticizeOpen}>
          <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Criticar proposta</DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto flex-1">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="criticize-title">Título</FieldLabel>
                  <Input
                    id="criticize-title"
                    value={criticizeTitle}
                    onChange={(e) => setCriticizeTitle(e.target.value)}
                    disabled={submitting}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="criticize-message">Mensagem</FieldLabel>
                  <Textarea
                    id="criticize-message"
                    value={criticizeMessage}
                    onChange={(e) => setCriticizeMessage(e.target.value)}
                    disabled={submitting}
                    rows={6}
                  />
                </Field>
              </FieldGroup>
            </div>
            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => setCriticizeOpen(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={submitting || criticizeTitle.length < 3 || criticizeMessage.length < 10}
                onClick={() => void handleCriticizeSubmit()}
              >
                {submitting ? "Enviando..." : "Confirmar crítica"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={registerOpen} onOpenChange={submitting ? undefined : setRegisterOpen}>
          <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Registrar venda</DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto flex-1">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="operator-name">Operadora</FieldLabel>
                  <Input
                    id="operator-name"
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    disabled={submitting}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="proposal-number">Número da proposta</FieldLabel>
                  <Input
                    id="proposal-number"
                    value={proposalNumber}
                    onChange={(e) => setProposalNumber(e.target.value)}
                    disabled={submitting}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="sale-notes">Observações</FieldLabel>
                  <Textarea
                    id="sale-notes"
                    value={saleNotes}
                    onChange={(e) => setSaleNotes(e.target.value)}
                    disabled={submitting}
                    rows={4}
                  />
                </Field>
              </FieldGroup>
            </div>
            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => setRegisterOpen(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button
                disabled={submitting || operatorName.trim().length < 2}
                onClick={() => void handleRegisterSubmit()}
              >
                {submitting ? "Salvando..." : "Registrar venda"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
