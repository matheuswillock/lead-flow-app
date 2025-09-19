import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, ScrollText } from "lucide-react";

export default function BoardHeader() {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <ScrollText className="size-5" />
        <h1 className="text-xl font-semibold">Kanban de Leads</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Filter className="pointer-events-none absolute left-2 top-2.5 size-4 opacity-70" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou data (dd/mm/aaaa)"
              className="pl-8 w-64"
            />
          </div>

          {/* Filtro por período */}
          <div className="flex items-center gap-2">
            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="w-40" />
            <span className="text-sm text-muted-foreground">até</span>
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-40" />
          </div>

          {/* Filtro por responsável */}
          <Select value={assignedUser} onValueChange={setAssignedUser}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os responsáveis</SelectItem>
              {responsaveis.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
}
