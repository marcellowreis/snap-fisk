# Snap Fisk

Motor fiscal v1 em Node.js + TypeScript + Prisma + PostgreSQL.

## Requisitos

- Node.js 20+
- PostgreSQL

## ConfiguraÃ§Ã£o

1. Copie o arquivo de ambiente:
   ```bash
   cp .env.example .env
   ```
2. Ajuste `DATABASE_URL` para seu PostgreSQL.
3. Instale dependÃªncias:
   ```bash
   npm install
   ```
4. Gere o client Prisma:
   ```bash
   npm run prisma:generate
   ```
5. Rode migraÃ§Ãµes:
   ```bash
   npm run prisma:migrate
   ```

## Executar API

```bash
npm run dev
```

## Endpoint do Motor Fiscal

### `POST /api/fiscal-engine/query`

Payload:

```json
{
  "originUf": "SP",
  "destinationUf": "RJ",
  "operation": "sale",
  "purpose": "resale",
  "taxRegime": "simples_nacional"
}
```

Resposta:

```json
{
  "cfop": "6102",
  "cstCsosn": "102",
  "icmsApplicable": true,
  "ipiApplicable": false,
  "observation": "Regra de venda interestadual para SN",
  "ruleId": "uuid-da-regra"
}
```

## Regras de decisÃ£o

- Filtra regras ativas (`active = true`) por:
  - `originUf`
  - `destinationUf`
  - `operation`
  - `purpose`
  - `taxRegime`
- Cada critÃ©rio aceita valor exato ou `null` (coringa).
- CritÃ©rios de desempate:
  1. Maior `priority`
  2. Maior especificidade (quantidade de campos nÃ£o nulos entre os filtros)

Toda consulta salva uma linha em `guided_issuance`.

<!-- deploy 2026-04-27T16:48:51.079Z -->