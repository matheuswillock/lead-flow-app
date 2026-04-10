"use client"

import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useHistoricoContext } from "../context/HistoricoContext"

export function LogFiltersBar() {
  const { search, statusFilter, dateFrom, dateTo, handleSearch, handleStatusFilter, handleDateFilter } =
    useHistoricoContext()

  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative min-w-52 flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por email ou assunto..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={statusFilter || "__all"} onValueChange={(v) => handleStatusFilter(v === "__all" ? "" : v)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">Todos os status</SelectItem>
          <SelectItem value="queued">Na fila</SelectItem>
          <SelectItem value="sent">Enviado</SelectItem>
          <SelectItem value="delivered">Entregue</SelectItem>
          <SelectItem value="opened">Aberto</SelectItem>
          <SelectItem value="clicked">Clicado</SelectItem>
          <SelectItem value="bounced">Bounce</SelectItem>
          <SelectItem value="complained">Reclamação</SelectItem>
          <SelectItem value="failed">Falhou</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => handleDateFilter(e.target.value, dateTo)}
          className="w-40"
          title="De"
        />
        <span className="text-sm text-muted-foreground">até</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => handleDateFilter(dateFrom, e.target.value)}
          className="w-40"
          title="Até"
        />
      </div>
    </div>
  )
}
