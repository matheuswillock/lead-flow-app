"use client"

import { BoardProvider } from "./features/context/BoardContext";
import { BoardContainer } from "./features/container/BoardContainer";

export default function BoardPage() {
  return (
    <BoardProvider>
      <BoardContainer />
    </BoardProvider>
  );
}
