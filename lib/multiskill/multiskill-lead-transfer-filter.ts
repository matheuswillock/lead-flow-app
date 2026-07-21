export type MultiskillLeadTransferRow = {
  fromManagerId: string;
  toManagerId: string;
  toTeam: {
    master: {
      multiskillEnabled: boolean;
    };
  };
};

export function isMultiskillExternalLeadTransfer(transfer: MultiskillLeadTransferRow): boolean {
  return (
    transfer.fromManagerId !== transfer.toManagerId &&
    transfer.toTeam.master.multiskillEnabled === true
  );
}

export function filterMultiskillExternalLeadTransfers<T extends MultiskillLeadTransferRow>(
  transfers: T[],
  multiskillOnly: boolean | undefined
): T[] {
  if (!multiskillOnly) return transfers;
  return transfers.filter(isMultiskillExternalLeadTransfer);
}
