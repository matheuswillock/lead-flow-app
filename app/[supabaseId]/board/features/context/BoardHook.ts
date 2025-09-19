import { useContext } from "react";
import { BoardContext } from "./BoardContext";

export default function useBoardContext() {
  const context = useContext(BoardContext);
  if (context === undefined) {
    throw new Error('useBoardContext must be used within a BoardProvider');
  }
  return context;
}