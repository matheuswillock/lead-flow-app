"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const;

type Props = {
  page: number;
  pageSize: number;
  total: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function WebhooksTablePagination({
  page,
  pageSize,
  total,
  disabled,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const canPrevious = page > 1;
  const canNext = page < pageCount;

  return (
    <div className="flex flex-wrap items-center justify-end gap-4 px-2 py-3">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">Linhas por página</p>
        <select
          aria-label="Linhas por página"
          title="Linhas por página"
          value={pageSize}
          disabled={disabled}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-8 w-[70px] rounded-md border border-input bg-background"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
      <div className="flex w-[100px] items-center justify-center text-sm font-medium">
        Página {page} de {pageCount}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="size-8 p-0"
          disabled={disabled || !canPrevious}
          onClick={() => onPageChange(1)}
        >
          <span className="sr-only">Ir para primeira página</span>
          <ChevronsLeft />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="size-8 p-0"
          disabled={disabled || !canPrevious}
          onClick={() => onPageChange(page - 1)}
        >
          <span className="sr-only">Página anterior</span>
          <ChevronLeft />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="size-8 p-0"
          disabled={disabled || !canNext}
          onClick={() => onPageChange(page + 1)}
        >
          <span className="sr-only">Próxima página</span>
          <ChevronRight />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="size-8 p-0"
          disabled={disabled || !canNext}
          onClick={() => onPageChange(pageCount)}
        >
          <span className="sr-only">Ir para última página</span>
          <ChevronsRight />
        </Button>
      </div>
    </div>
  );
}
