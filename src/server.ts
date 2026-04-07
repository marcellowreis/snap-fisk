import 'dotenv/config';
import express from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { resolveFiscalRule } from './fiscal-engine';
import { prisma } from './prisma';

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET ?? 'snapfisk-secret-dev';

// ─── TIPOS ──────────────────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// ─── MIDDLEWARE DE AUTENTICAÇÃO ──────────────────────────────────────────────

const authenticate = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não informado.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
};

// ─── SCHEMAS DE VALIDAÇÃO ────────────────────────────────────────────────────

const registerSchema = z.object({
  cnpj: z.string().min(14).max(18),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  cnpj: z.string().min(14).max(18),
  password: z.string().min(1),
});

const companySchema = z.object({
  razaoSocial: z.string().min(1),
  nomeFantasia: z.string().optional(),
  cnpj: z.string().min(14).max(18),
  ie: z.string().optional(),
  uf: z.string().length(2),
  taxRegime: z.enum(['simples_nacional', 'lucro_presumido', 'lucro_real', 'mei']),
  email: z.string().email().optional(),
});

const fiscalQuerySchema = z.object({
  originUf: z.string().min(2).max(2),
  destinationUf: z.string().min(2).max(2),
  operation: z.string().min(1),
  purpose: z.string().min(1),
  taxRegime: z.string().min(1),
});

// ─── ROTAS PÚBLICAS ──────────────────────────────────────────────────────────

// Health check
app.get('/health', (_req, res) => {
  return res.status(200).json({ status: 'ok', app: 'Snap Fisk' });
});

// Listar planos
app.get('/api/plans', async (_req, res) => {
  const plans = await prisma.plan.findMany({
    orderBy: { price: 'asc' },
  });
  return res.json(plans);
});

// Cadastro
app.post('/api/auth/register', async (req, res) => {
  const payload = registerSchema.safeParse(req.body);
  if (!payload.success) {
    return res.status(400).json({ error: 'Dados inválidos.', details: payload.error.flatten() });
  }

  const { cnpj, email, password } = payload.data;
  const cnpjClean = cnpj.replace(/\D/g, '');

  const existing = await prisma.user.findFirst({
    where: { OR: [{ cnpj: cnpjClean }, { email }] },
  });

  if (existing) {
    return res.status(409).json({ error: 'CNPJ ou e-mail já cadastrado.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { cnpj: cnpjClean, email, passwordHash },
  });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

  return res.status(201).json({
    token,
    user: { id: user.id, cnpj: user.cnpj, email: user.email },
  });
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const payload = loginSchema.safeParse(req.body);
  if (!payload.success) {
    return res.status(400).json({ error: 'Dados inválidos.' });
  }

  const { cnpj, password } = payload.data;
  const cnpjClean = cnpj.replace(/\D/g, '');

  const user = await prisma.user.findUnique({ where: { cnpj: cnpjClean } });

  if (!user) {
    return res.status(401).json({ error: 'CNPJ ou senha incorretos.' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'CNPJ ou senha incorretos.' });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

  return res.json({
    token,
    user: { id: user.id, cnpj: user.cnpj, email: user.email },
  });
});

// ─── ROTAS AUTENTICADAS ──────────────────────────────────────────────────────

// Perfil do usuário
app.get('/api/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { company: true, subscription: { include: { plan: true } } },
  });

  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

  return res.json({
    id: user.id,
    cnpj: user.cnpj,
    email: user.email,
    company: user.company,
    subscription: user.subscription,
  });
});

// Cadastrar/atualizar empresa
app.post('/api/company', authenticate, async (req, res) => {
  const payload = companySchema.safeParse(req.body);
  if (!payload.success) {
    return res.status(400).json({ error: 'Dados inválidos.', details: payload.error.flatten() });
  }

  const company = await prisma.company.upsert({
    where: { userId: req.userId! },
    create: { userId: req.userId!, ...payload.data },
    update: { ...payload.data },
  });

  return res.json(company);
});

// Buscar empresa
app.get('/api/company', authenticate, async (req, res) => {
  const company = await prisma.company.findUnique({
    where: { userId: req.userId },
  });

  if (!company) {
    return res.status(404).json({ error: 'Empresa não cadastrada.' });
  }

  return res.json(company);
});

// ─── MOTOR FISCAL ────────────────────────────────────────────────────────────

app.post('/api/fiscal-engine/query', authenticate, async (req, res) => {
  const payload = fiscalQuerySchema.safeParse(req.body);
  if (!payload.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: payload.error.flatten() });
  }

  const result = await resolveFiscalRule(payload.data, req.userId);
  return res.json(result);
});

// Histórico de orientações
app.get('/api/fiscal-engine/history', authenticate, async (req, res) => {
  const issuances = await prisma.guidedIssuance.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return res.json(issuances);
});

// ─── PLANOS E ASSINATURA ─────────────────────────────────────────────────────

// Assinatura atual
app.get('/api/subscription', authenticate, async (req, res) => {
  const subscription = await prisma.subscription.findUnique({
    where: { userId: req.userId },
    include: { plan: true },
  });

  return res.json(subscription ?? null);
});

// Iniciar cobrança PIX
app.post('/api/billing/pix', authenticate, async (req, res) => {
  const { planCode } = req.body;

  if (!['SNAP_ONE', 'SNAP_TEN', 'SNAP_MEI'].includes(planCode)) {
    return res.status(400).json({ error: 'Plano inválido.' });
  }

  const plan = await prisma.plan.findUnique({ where: { code: planCode } });
  if (!plan) return res.status(404).json({ error: 'Plano não encontrado.' });

  // Busca ou cria assinatura
  let subscription = await prisma.subscription.findUnique({
    where: { userId: req.userId },
  });

  if (!subscription) {
    subscription = await prisma.subscription.create({
      data: { userId: req.userId!, planId: plan.id, status: 'PENDING' },
    });
  } else {
    subscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: { planId: plan.id, status: 'PENDING' },
    });
  }

  // Gera cobrança
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos
  const pixCode = `SNAPFISK-${subscription.id.slice(0, 8).toUpperCase()}-${plan.code}`;

  const charge = await prisma.billingCharge.create({
    data: {
      subscriptionId: subscription.id,
      amount: plan.price,
      status: 'PENDING',
      pixCode,
      expiresAt,
    },
  });

  return res.json({
    chargeId: charge.id,
    pixCode: charge.pixCode,
    amount: charge.amount,
    expiresAt: charge.expiresAt,
    plan: { name: plan.name, code: plan.code },
  });
});

// Consultar status da cobrança
app.get('/api/billing/:chargeId/status', authenticate, async (req, res) => {
  const charge = await prisma.billingCharge.findUnique({
    where: { id: req.params.chargeId },
    include: { subscription: true },
  });

  if (!charge) return res.status(404).json({ error: 'Cobrança não encontrada.' });

  // Expirar cobranças vencidas
  if (charge.status === 'PENDING' && charge.expiresAt && charge.expiresAt < new Date()) {
    await prisma.billingCharge.update({
      where: { id: charge.id },
      data: { status: 'EXPIRED' },
    });
    return res.json({ status: 'EXPIRED' });
  }

  return res.json({ status: charge.status, paidAt: charge.paidAt });
});

// Confirmar pagamento (webhook simulado para MVP)
app.post('/api/billing/:chargeId/confirm', authenticate, async (req, res) => {
  const charge = await prisma.billingCharge.findUnique({
    where: { id: req.params.chargeId },
    include: { subscription: { include: { plan: true } } },
  });

  if (!charge) return res.status(404).json({ error: 'Cobrança não encontrada.' });
  if (charge.status !== 'PENDING') {
    return res.status(400).json({ error: 'Cobrança não está pendente.' });
  }

  const now = new Date();
  const plan = charge.subscription.plan;

  // Calcula validade
  const endDate = plan.code === 'SNAP_ONE'
    ? null
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 dias

  await prisma.$transaction([
    prisma.billingCharge.update({
      where: { id: charge.id },
      data: { status: 'PAID', paidAt: now },
    }),
    prisma.subscription.update({
      where: { id: charge.subscriptionId },
      data: { status: 'ACTIVE', nfUsed: 0, startDate: now, endDate },
    }),
  ]);

  return res.json({ success: true, message: 'Pagamento confirmado. Plano ativado.' });
});

// ─── INICIALIZAÇÃO ───────────────────────────────────────────────────────────

const seedPlans = async () => {
  const plans = [
    { code: 'SNAP_ONE' as const, name: 'Snap One', price: 9.90, nfLimit: 1, description: 'Para quem emite pouco' },
    { code: 'SNAP_TEN' as const, name: 'Snap Ten', price: 29.90, nfLimit: 10, description: 'Até 10 NF por mês' },
    { code: 'SNAP_MEI' as const, name: 'Snap MEI', price: 59.90, nfLimit: -1, description: 'NF ilimitadas por mês' },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      create: plan,
      update: { name: plan.name, price: plan.price, description: plan.description },
    });
  }
};

const port = Number(process.env.PORT ?? 3000);

const server = app.listen(port, async () => {
  await seedPlans();
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
