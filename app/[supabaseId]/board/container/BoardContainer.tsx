"use client"

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, Filter, Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import BoardHeader from "./BoardHeader";
import BoardColumns from "./BoardColumns";
import BoardFooter from "./BoardFooter";
import BoardDialog from "./BoardDialog";

export function BoardContainer() {
  return (
    <div className="flex h-[calc(100vh-2rem)] w-full flex-col gap-3 p-4">

      <BoardHeader />

      <BoardColumns />

      {/* Rodapé simples */}
      <BoardFooter />

      <Button size="lg" className="w-96 h-14 self-center justify-center text-2xl rounded-4xl mt-12">
        <Plus className="mr-1 size-4" /> Adicionar novo lead
      </Button>

      {/* Dialog de edição/criação */}
      <BoardDialog />
    </div>
  );
}