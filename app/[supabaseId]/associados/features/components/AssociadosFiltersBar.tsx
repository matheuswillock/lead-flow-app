"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AssociateProposalRow, AssociadosFiltersState } from "../context/AssociadosTypes";

type AssociadosFiltersBarProps = {
  filters: AssociadosFiltersState;
  items: AssociateProposalRow[];
  onChange: (patch: Partial<AssociadosFiltersState>) => void;
  onRefresh: () => void;
};

const ALL_VALUE = "__all__";

export function AssociadosFiltersBar({
  filters,
  items,
  onChange,
  onRefresh,
}: AssociadosFiltersBarProps) {
  const accountOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      map.set(item.associateAccountId, item.associateAccountName);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [items]);

  const teamOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (filters.associateAccountId && item.associateAccountId !== filters.associateAccountId) continue;
      map.set(item.teamId, item.teamName);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [items, filters.associateAccountId]);

  const closerOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (filters.teamId && item.teamId !== filters.teamId) continue;
      if (!item.closerId || !item.closerName) continue;
      map.set(item.closerId, item.closerName);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [items, filters.teamId]);

  function clearFilters() {
    onChange({
      search: "",
      associateAccountId: "",
      teamId: "",
      closerId: "",
      from: "",
      to: "",
    });
  }

  return (
    <FieldGroup className="gap-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field>
          <FieldLabel htmlFor="associados-search">Busca</FieldLabel>
          <Input
            id="associados-search"
            placeholder="Nome, telefone ou código"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel>Conta</FieldLabel>
          <Select
            value={filters.associateAccountId || ALL_VALUE}
            onValueChange={(value) =>
              onChange({
                associateAccountId: value === ALL_VALUE ? "" : value,
                teamId: "",
                closerId: "",
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Todas</SelectItem>
              {accountOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Time</FieldLabel>
          <Select
            value={filters.teamId || ALL_VALUE}
            onValueChange={(value) =>
              onChange({
                teamId: value === ALL_VALUE ? "" : value,
                closerId: "",
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Todos</SelectItem>
              {teamOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Closer</FieldLabel>
          <Select
            value={filters.closerId || ALL_VALUE}
            onValueChange={(value) =>
              onChange({ closerId: value === ALL_VALUE ? "" : value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Todos</SelectItem>
              {closerOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="associados-from">De</FieldLabel>
          <Input
            id="associados-from"
            type="date"
            value={filters.from}
            onChange={(e) => onChange({ from: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="associados-to">Até</FieldLabel>
          <Input
            id="associados-to"
            type="date"
            value={filters.to}
            onChange={(e) => onChange({ to: e.target.value })}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={clearFilters}>
          Limpar filtros
        </Button>
        <Button variant="secondary" onClick={onRefresh}>
          Atualizar
        </Button>
      </div>
    </FieldGroup>
  );
}
