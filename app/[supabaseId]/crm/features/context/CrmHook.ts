import { useContext } from "react";
import { CrmContext } from "./CrmContext";

export default function useCrmContext() {
  const context = useContext(CrmContext);
  if (!context) {
    throw new Error("useCrmContext must be used within a CrmProvider");
  }
  return context;
}
