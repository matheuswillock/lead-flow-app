"use client"

import React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import BoardHeader from "./BoardHeader";
import BoardColumns from "./BoardColumns";
import BoardFooter from "./BoardFooter";
import BoardDialog from "./BoardDialog";
import useBoardContext from "../context/BoardHook";

export function BoardContainer() {
  const { openNewLeadDialog } = useBoardContext();

  return (
    <div className="flex h-[calc(100vh-2rem)] w-full flex-col gap-3 p-4">

      <BoardHeader />

      <BoardColumns />

      <BoardFooter />

      <Button 
        size="lg" 
        className="w-96 h-14 self-center justify-center text-2xl rounded-4xl mt-12 cursor-pointer"
        onClick={openNewLeadDialog}
      >
        <Plus className="mr-1 size-4" /> Adicionar novo lead
      </Button>

      <BoardDialog />
    </div>
  );
}