import { TaxRegime } from '@prisma/client';

export type FiscalEngineInput = {
  companyId: string;
  userId?: string;
  originUf: string;
  destinationUf: string;
  operation: string;
  purpose: string;
  taxRegime: TaxRegime;
};

export type FiscalEngineOutput = {
  ruleId: string | null;
  cfop: string | null;
  cstCsosn: string | null;
  icmsApplicable: boolean;
  ipiApplicable: boolean;
  observation: string | null;
  matchedByPriority: number | null;
};
