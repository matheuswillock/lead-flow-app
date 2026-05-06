"use client";

export type ManagerTeamTableRow = {
  id: string;
  name: string;
  masterId: string;
  isDefault: boolean;
  role: "manager" | "backoffice" | "operator";
  functions: ("SDR" | "CLOSER")[];
  createdAt: string;
};

