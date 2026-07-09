import { describe, expect, it } from "bun:test";
import {
  isMultiskillOriginAccountMasterId,
  isMultiskillOriginMaster,
} from "./is-multiskill-origin-master";
import {
  filterMultiskillExternalLeadTransfers,
  isMultiskillExternalLeadTransfer,
} from "./multiskill-lead-transfer-filter";

const BRUNO_MASTER_ID = "bruno-master-id";
const OTHER_MASTER_ID = "other-master-id";

describe("isMultiskillOriginMaster", () => {
  it("identifica conta Bruno pelo managerId", () => {
    expect(
      isMultiskillOriginMaster({ managerId: BRUNO_MASTER_ID } as never, BRUNO_MASTER_ID)
    ).toBe(true);
  });

  it("nega outra conta mesmo com originMasterId resolvido", () => {
    expect(
      isMultiskillOriginMaster({ managerId: OTHER_MASTER_ID } as never, BRUNO_MASTER_ID)
    ).toBe(false);
  });

  it("nega quando originMasterId não foi resolvido", () => {
    expect(isMultiskillOriginMaster({ managerId: BRUNO_MASTER_ID } as never, null)).toBe(false);
  });
});

describe("isMultiskillOriginAccountMasterId", () => {
  it("compara master da conta com origin master", () => {
    expect(isMultiskillOriginAccountMasterId(BRUNO_MASTER_ID, BRUNO_MASTER_ID)).toBe(true);
    expect(isMultiskillOriginAccountMasterId(OTHER_MASTER_ID, BRUNO_MASTER_ID)).toBe(false);
  });
});

describe("multiskill lead transfer filter", () => {
  const internalTransfer = {
    fromManagerId: BRUNO_MASTER_ID,
    toManagerId: BRUNO_MASTER_ID,
    toTeam: { master: { multiskillEnabled: true } },
  };

  const externalTransfer = {
    fromManagerId: BRUNO_MASTER_ID,
    toManagerId: OTHER_MASTER_ID,
    toTeam: { master: { multiskillEnabled: true } },
  };

  const crossManagerWithoutMultiskill = {
    fromManagerId: BRUNO_MASTER_ID,
    toManagerId: OTHER_MASTER_ID,
    toTeam: { master: { multiskillEnabled: false } },
  };

  it("inclui transferências cross-account com destino multiskillEnabled", () => {
    expect(isMultiskillExternalLeadTransfer(externalTransfer)).toBe(true);
  });

  it("exclui transferências internas (mesmo master)", () => {
    expect(isMultiskillExternalLeadTransfer(internalTransfer)).toBe(false);
  });

  it("exclui cross-manager sem multiskillEnabled no destino", () => {
    expect(isMultiskillExternalLeadTransfer(crossManagerWithoutMultiskill)).toBe(false);
  });

  it("filterMultiskillExternalLeadTransfers retorna todos sem flag", () => {
    const rows = [internalTransfer, externalTransfer];
    expect(filterMultiskillExternalLeadTransfers(rows, false)).toEqual(rows);
    expect(filterMultiskillExternalLeadTransfers(rows, undefined)).toEqual(rows);
  });

  it("filterMultiskillExternalLeadTransfers retorna só externas com flag", () => {
    const rows = [internalTransfer, externalTransfer, crossManagerWithoutMultiskill];
    expect(filterMultiskillExternalLeadTransfers(rows, true)).toEqual([externalTransfer]);
  });
});
