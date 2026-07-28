"use client";

import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TeamWebhookStatus } from "../services/ITeamWebhooksService";

type Props = {
  status: TeamWebhookStatus;
  disabled?: boolean;
  onToggle: () => void;
};

function resolveTooltip(status: TeamWebhookStatus): string {
  if (status === "active") return "Desativar webhook";
  if (status === "paused") return "Reativar webhook";
  return "Ativar webhook";
}

export function WebhookListPlayPauseButton({ status, disabled, onToggle }: Props) {
  const isActive = status === "active";
  const Icon = isActive ? Pause : Play;
  const label = resolveTooltip(status);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label={label}
            onClick={onToggle}
          >
            <Icon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
