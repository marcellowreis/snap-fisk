import { PrismaClient } from '@prisma/client';
import type { FiscalEngineInput, FiscalEngineOutput } from './types.js';

export class FiscalEngineService {
  constructor(private readonly prisma: PrismaClient) {}

  async evaluate(input: FiscalEngineInput): Promise<FiscalEngineOutput> {
    const matchedRule = await this.prisma.fiscalRule.findFirst({
      where: {
        companyId: input.companyId,
        originUf: input.originUf,
        destinationUf: input.destinationUf,
        operation: input.operation,
        purpose: input.purpose,
        taxRegime: input.taxRegime,
        active: true,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    return {
      ruleId: matchedRule?.id ?? null,
      cfop: matchedRule?.cfop ?? null,
      cstCsosn: matchedRule?.cstCsosn ?? null,
      icmsApplicable: matchedRule?.icmsApplicable ?? false,
      ipiApplicable: matchedRule?.ipiApplicable ?? false,
      observation: matchedRule?.observation ?? null,
      matchedByPriority: matchedRule?.priority ?? null,
    };
  }

  async persistGuidedIssuance(input: FiscalEngineInput, output: FiscalEngineOutput) {
    return this.prisma.guidedIssuance.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        ruleId: output.ruleId,
        inputData: input,
        engineResult: output,
      },
    });
  }
}
