# snap-fisk

Sistema SaaS para orientar a emissão de NF-e para MEI e pequenas empresas.

## Backend base (Prisma + PostgreSQL)

Este repositório agora contém a base de backend para o motor fiscal com:

- Schema PostgreSQL via Prisma.
- Models iniciais: `users`, `companies`, `fiscal_rules`, `guided_issuances`.
- Migration inicial SQL em `prisma/migrations`.
- Estrutura inicial de motor fiscal em `src/fiscal-engine`.

## Como usar

1. Copie `.env.example` para `.env` e ajuste a `DATABASE_URL`.
2. Instale as dependências:

```bash
npm install
```

3. Rode as migrations:

```bash
npm run prisma:deploy
```

4. Gere o client Prisma:

```bash
npm run prisma:generate
```
