-- CreateEnum
CREATE TYPE "TaxRegime" AS ENUM ('MEI', 'SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL');

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "document" TEXT NOT NULL,
    "taxRegime" "TaxRegime" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "companyId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_rules" (
    "id" UUID NOT NULL,
    "companyId" UUID,
    "originUf" CHAR(2) NOT NULL,
    "destinationUf" CHAR(2) NOT NULL,
    "operation" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "taxRegime" "TaxRegime" NOT NULL,
    "cfop" TEXT NOT NULL,
    "cstCsosn" TEXT NOT NULL,
    "icmsApplicable" BOOLEAN NOT NULL,
    "ipiApplicable" BOOLEAN NOT NULL,
    "observation" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guided_issuances" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID,
    "ruleId" UUID,
    "inputData" JSONB NOT NULL,
    "engineResult" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guided_issuances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_document_key" ON "companies"("document");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "fiscal_rules_companyId_active_idx" ON "fiscal_rules"("companyId", "active");

-- CreateIndex
CREATE INDEX "fiscal_rule_lookup_idx" ON "fiscal_rules"("originUf", "destinationUf", "operation", "purpose", "taxRegime", "active", "priority");

-- CreateIndex
CREATE INDEX "guided_issuances_companyId_createdAt_idx" ON "guided_issuances"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "guided_issuances_ruleId_idx" ON "guided_issuances"("ruleId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_rules" ADD CONSTRAINT "fiscal_rules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guided_issuances" ADD CONSTRAINT "guided_issuances_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guided_issuances" ADD CONSTRAINT "guided_issuances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guided_issuances" ADD CONSTRAINT "guided_issuances_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "fiscal_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
