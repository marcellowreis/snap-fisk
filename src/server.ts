import 'dotenv/config';
import express from 'express';
import { z } from 'zod';
import { resolveFiscalRule } from './fiscal-engine';
import { prisma } from './prisma';

const app = express();
app.use(express.json());

const fiscalQuerySchema = z.object({
  originUf: z.string().min(2),
  destinationUf: z.string().min(2),
  operation: z.string().min(1),
  purpose: z.string().min(1),
  taxRegime: z.string().min(1),
});

app.post('/api/fiscal-engine/query', async (req, res) => {
  const payload = fiscalQuerySchema.safeParse(req.body);

  if (!payload.success) {
    return res.status(400).json({
      error: 'Payload inválido.',
      details: payload.error.flatten(),
    });
  }

  const result = await resolveFiscalRule(payload.data);
  return res.status(200).json(result);
});

app.get('/health', (_req, res) => {
  return res.status(200).json({ status: 'ok' });
});

const port = Number(process.env.PORT ?? 3000);

const server = app.listen(port, () => {
  console.log(`Snap Fisk API listening on port ${port}`);
});

const shutdown = async () => {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
