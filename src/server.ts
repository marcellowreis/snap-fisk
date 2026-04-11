import 'dotenv/config';
import express from 'express';
import path from 'path';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { resolveFiscalRule } from './fiscal-engine';
import { prisma } from './prisma';

const app = express();
app.use(express.json({ limit: '10mb' }));

const JWT_SECRET = process.env.JWT_SECRET ?? 'snapfisk-secret-dev';

// Servir frontend
const frontendDist = path.join(process.cwd(), 'frontend', 'dist');
app.use(express.static(frontendDist));

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

// ─── SCHEMAS ────────────────────────────────────────────────────────────────

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
  cuf: z.string().optional(),
  cMun: z.string().optional(),
  xMun: z.string().optional(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  fone: z.string().optional(),
  email: z.string().email().optional(),
  taxRegime: z.enum(['simples_nacional', 'lucro_presumido', 'lucro_real', 'mei']),
  serie: z.string().optional(),
  proximaNF: z.number().optional(),
});

const productSchema = z.object({
  codigo: z.string().optional(),
  descricao: z.string().min(1),
  ncm: z.string().min(8).max(10),
  unidade: z.string().default('PC'),
  valorUnit: z.number().default(0),
  ean: z.string().default('SEM GTIN'),
  origem: z.string().default('0'),
});

const customerSchema = z.object({
  tipoPessoa: z.enum(['PF', 'PJ']).default('PF'),
  cpfCnpj: z.string().min(11).max(18).transform(v => v.replace(/\D/g, '')),
  nome: z.string().min(1),
  ie: z.string().optional(),
  indIEDest: z.string().default('9'),
  email: z.string().email().optional(),
  fone: z.string().optional(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  xMun: z.string().optional(),
  cMun: z.string().optional(),
  uf: z.string().length(2).optional(),
});

const invoiceItemSchema = z.object({
  productId: z.string().optional(),
  xProd: z.string().min(1),
  ncm: z.string().min(8),
  cfop: z.string().min(4),
  uCom: z.string().default('PC'),
  qCom: z.number().positive(),
  vUnCom: z.number().positive(),
  ean: z.string().default('SEM GTIN'),
  origem: z.string().default('0'),
  csosn: z.string().default('102'),
  saveProduct: z.boolean().default(false),
});

const invoiceSchema = z.object({
  customerId: z.string().optional(),
  tpNF: z.enum(['0', '1']).default('1'),
  operation: z.string().min(1),
  purpose: z.string().min(1),
  natOp: z.string().min(1),
  cfop: z.string().min(4),
  cstCsosn: z.string().min(1),
  infCpl: z.string().optional(),
  ambiente: z.enum(['1', '2']).default('2'),
  vFrete: z.number().default(0),
  vDesc: z.number().default(0),
  modFrete: z.string().default('9'),
  tPag: z.string().default('90'),
  vPag: z.number().default(0),
  items: z.array(invoiceItemSchema).min(1),
});

const fiscalQuerySchema = z.object({
  originUf: z.string().min(2).max(2),
  destinationUf: z.string().min(2).max(2),
  operation: z.string().min(1),
  purpose: z.string().min(1),
  taxRegime: z.string().min(1),
});

// ─── HELPERS ────────────────────────────────────────────────────────────────

const cleanDoc = (doc: string) => doc.replace(/\D/g, '');

// Sugestão de NCM baseada na descrição do produto
const suggestNcm = (descricao: string): { ncm: string; descricao: string } | null => {
  const d = descricao.toLowerCase();
  const suggestions: Array<{ keywords: string[]; ncm: string; descricao: string }> = [
    { keywords: ['farol', 'lanterna', 'luz', 'iluminacao', 'pisca'], ncm: '85122011', descricao: 'Faróis e projetores' },
    { keywords: ['retrovisor', 'espelho'], ncm: '70091000', descricao: 'Espelhos retrovisores' },
    { keywords: ['para-choque', 'parachoque', 'parachoques'], ncm: '87087010', descricao: 'Para-choques' },
    { keywords: ['pneu', 'borracha', 'camara de ar'], ncm: '40112000', descricao: 'Pneus de borracha' },
    { keywords: ['motor', 'motorizacao'], ncm: '84089000', descricao: 'Motores' },
    { keywords: ['freio', 'pastilha', 'disco de freio'], ncm: '87083000', descricao: 'Freios e partes' },
    { keywords: ['bateria', 'acumulador'], ncm: '85072000', descricao: 'Baterias' },
    { keywords: ['filtro de oleo', 'filtro ar', 'filtro'], ncm: '84212300', descricao: 'Filtros' },
    { keywords: ['camiseta', 'camisa', 'blusa', 'camiseta'], ncm: '61091000', descricao: 'Camisetas de malha' },
    { keywords: ['calca', 'bermuda', 'short'], ncm: '62034200', descricao: 'Calças de algodão' },
    { keywords: ['sapato', 'tenis', 'calcado', 'chinelo'], ncm: '64041100', descricao: 'Calçados' },
    { keywords: ['notebook', 'computador', 'laptop'], ncm: '84713012', descricao: 'Computadores portáteis' },
    { keywords: ['celular', 'smartphone', 'telefone'], ncm: '85171231', descricao: 'Aparelhos telefônicos' },
    { keywords: ['tablet'], ncm: '84713019', descricao: 'Tablets' },
    { keywords: ['televisao', 'tv', 'monitor'], ncm: '85287210', descricao: 'Aparelhos receptores de televisão' },
    { keywords: ['geladeira', 'refrigerador', 'freezer'], ncm: '84181021', descricao: 'Refrigeradores' },
    { keywords: ['maquina de lavar', 'lavadora'], ncm: '84501110', descricao: 'Máquinas de lavar roupa' },
    { keywords: ['ar condicionado', 'split', 'climatizador'], ncm: '84151012', descricao: 'Ar condicionado' },
    { keywords: ['mesa', 'cadeira', 'movel', 'sofa'], ncm: '94036000', descricao: 'Móveis de madeira' },
    { keywords: ['medicamento', 'remedio', 'comprimido', 'capsula'], ncm: '30049099', descricao: 'Medicamentos' },
    { keywords: ['shampoo', 'cosmetico', 'perfume', 'creme'], ncm: '33051000', descricao: 'Xampus' },
    { keywords: ['alimento', 'comida', 'biscoito', 'bolacha'], ncm: '19053100', descricao: 'Biscoitos' },
    { keywords: ['ferramenta', 'chave', 'martelo', 'alicate'], ncm: '82055900', descricao: 'Ferramentas manuais' },
  ];

  for (const s of suggestions) {
    if (s.keywords.some(k => d.includes(k))) {
      return { ncm: s.ncm, descricao: s.descricao };
    }
  }
  return null;
};

// Gerar chave de acesso da NF-e
const gerarChaveAcesso = (
  cuf: string,
  dhEmi: Date,
  cnpj: string,
  mod: string,
  serie: string,
  nNF: number,
  tpEmis: string,
  cNF: string,
): string => {
  const aamm = `${dhEmi.getFullYear().toString().slice(2)}${String(dhEmi.getMonth() + 1).padStart(2, '0')}`;
  const cnpjClean = cleanDoc(cnpj).padStart(14, '0');
  const serieStr = serie.padStart(3, '0');
  const nNFStr = String(nNF).padStart(9, '0');
  const cNFStr = cNF.padStart(8, '0');

  const chave = `${cuf}${aamm}${cnpjClean}${mod}${serieStr}${nNFStr}${tpEmis}${cNFStr}`;

  // Calcular dígito verificador (módulo 11)
  let soma = 0;
  let peso = 2;
  for (let i = chave.length - 1; i >= 0; i--) {
    soma += parseInt(chave[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;

  return chave + dv;
};

// Gerar XML da NF-e
const gerarXmlNFe = (invoice: any, company: any, customer: any, items: any[]): string => {
  const dhEmi = new Date(invoice.dhEmi);
  const dhEmiStr = dhEmi.toISOString().replace('Z', '-03:00').slice(0, 19) + '-03:00';
  const cNF = Math.floor(Math.random() * 99999999).toString().padStart(8, '0');
  const chave = gerarChaveAcesso(
    company.cuf || '35',
    dhEmi,
    company.cnpj,
    '55',
    invoice.serie || '0',
    invoice.numero,
    '1',
    cNF,
  );

  const cnpjEmit = cleanDoc(company.cnpj);
  const docDest = cleanDoc(customer?.cpfCnpj || '');
  const isDestPJ = docDest.length === 14;

  const totalProd = items.reduce((s, i) => s + i.vProd, 0);
  const vNF = totalProd + (invoice.vFrete || 0) - (invoice.vDesc || 0);

  const itenXml = items.map((item, idx) => `
    <det nItem="${idx + 1}">
      <prod>
        <cProd>${item.cProd || String(idx + 1).padStart(13, '0')}</cProd>
        <cEAN>${item.ean || 'SEM GTIN'}</cEAN>
        <xProd>${item.xProd}</xProd>
        <NCM>${cleanDoc(item.ncm)}</NCM>
        <CFOP>${item.cfop}</CFOP>
        <uCom>${item.uCom || 'PC'}</uCom>
        <qCom>${item.qCom.toFixed(4)}</qCom>
        <vUnCom>${item.vUnCom.toFixed(4)}</vUnCom>
        <vProd>${item.vProd.toFixed(2)}</vProd>
        <cEANTrib>${item.ean || 'SEM GTIN'}</cEANTrib>
        <uTrib>${item.uCom || 'PC'}</uTrib>
        <qTrib>${item.qCom.toFixed(4)}</qTrib>
        <vUnTrib>${item.vUnCom.toFixed(4)}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>
          <ICMSSN${item.csosn === '500' ? '500' : item.csosn === '102' ? '102' : '400'}>
            <orig>${item.origem || '0'}</orig>
            <CSOSN>${item.csosn || '102'}</CSOSN>
          </ICMSSN${item.csosn === '500' ? '500' : item.csosn === '102' ? '102' : '400'}>
        </ICMS>
        <PIS>
          <PISOutr>
            <CST>49</CST>
            <vBC>0.00</vBC>
            <pPIS>0.00</pPIS>
            <vPIS>0.00</vPIS>
          </PISOutr>
        </PIS>
        <COFINS>
          <COFINSOutr>
            <CST>49</CST>
            <vBC>0.00</vBC>
            <pCOFINS>0.0000</pCOFINS>
            <vCOFINS>0.00</vCOFINS>
          </COFINSOutr>
        </COFINS>
      </imposto>
    </det>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${chave}" versao="4.00">
    <ide>
      <cUF>${company.cuf || '35'}</cUF>
      <cNF>${cNF}</cNF>
      <natOp>${invoice.natOp}</natOp>
      <mod>55</mod>
      <serie>${invoice.serie || '0'}</serie>
      <nNF>${invoice.numero}</nNF>
      <dhEmi>${dhEmiStr}</dhEmi>
      <tpNF>${invoice.tpNF || '1'}</tpNF>
      <idDest>1</idDest>
      <cMunFG>${company.cMun || '3550308'}</cMunFG>
      <tpImp>1</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${chave.slice(-1)}</cDV>
      <tpAmb>${invoice.ambiente || '2'}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>${isDestPJ ? '0' : '1'}</indFinal>
      <indPres>2</indPres>
      <indIntermed>0</indIntermed>
      <procEmi>0</procEmi>
      <verProc>SnapFisk1.00</verProc>
    </ide>
    <emit>
      <CNPJ>${cnpjEmit}</CNPJ>
      <xNome>${invoice.ambiente === '2' ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL' : company.razaoSocial}</xNome>
      <enderEmit>
        <xLgr>${company.logradouro || 'Rua'}</xLgr>
        <nro>${company.numero || 'SN'}</nro>
        <xBairro>${company.bairro || 'Centro'}</xBairro>
        <cMun>${company.cMun || '3550308'}</cMun>
        <xMun>${company.xMun || 'Sao Paulo'}</xMun>
        <UF>${company.uf}</UF>
        <CEP>${cleanDoc(company.cep || '01000000')}</CEP>
        <cPais>1058</cPais>
        ${company.fone ? `<fone>${cleanDoc(company.fone)}</fone>` : ''}
      </enderEmit>
      <IE>${company.ie || 'ISENTO'}</IE>
      <CRT>4</CRT>
    </emit>
    ${customer ? `
    <dest>
      ${isDestPJ ? `<CNPJ>${docDest}</CNPJ>` : `<CPF>${docDest}</CPF>`}
      <xNome>${invoice.ambiente === '2' ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL' : customer.nome}</xNome>
      <enderDest>
        <xLgr>${customer.logradouro || 'Rua'}</xLgr>
        <nro>${customer.numero || 'SN'}</nro>
        <xBairro>${customer.bairro || 'Centro'}</xBairro>
        <cMun>${customer.cMun || '3550308'}</cMun>
        <xMun>${customer.xMun || 'Sao Paulo'}</xMun>
        <UF>${customer.uf || 'SP'}</UF>
        <CEP>${cleanDoc(customer.cep || '01000000')}</CEP>
        <cPais>1058</cPais>
        ${customer.fone ? `<fone>${cleanDoc(customer.fone)}</fone>` : ''}
      </enderDest>
      <indIEDest>${customer.indIEDest || '9'}</indIEDest>
      ${customer.ie ? `<IE>${customer.ie}</IE>` : ''}
      ${customer.email ? `<email>${customer.email}</email>` : ''}
    </dest>` : ''}
    ${itenXml}
    <total>
      <ICMSTot>
        <vBC>0.00</vBC>
        <vICMS>0.00</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCPUFDest>0.00</vFCPUFDest>
        <vICMSUFDest>0.00</vICMSUFDest>
        <vICMSUFRemet>0.00</vICMSUFRemet>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${totalProd.toFixed(2)}</vProd>
        <vFrete>${(invoice.vFrete || 0).toFixed(2)}</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>${(invoice.vDesc || 0).toFixed(2)}</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>0.00</vPIS>
        <vCOFINS>0.00</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${vNF.toFixed(2)}</vNF>
      </ICMSTot>
    </total>
    <transp>
      <modFrete>${invoice.modFrete || '9'}</modFrete>
    </transp>
    <pag>
      <detPag>
        <tPag>${invoice.tPag || '90'}</tPag>
        <vPag>${(invoice.vPag || 0).toFixed(2)}</vPag>
      </detPag>
    </pag>
    ${invoice.infCpl ? `
    <infAdic>
      <infCpl>${invoice.infCpl}</infCpl>
    </infAdic>` : ''}
  </infNFe>
</NFe>`;
};

// ─── ROTAS PÚBLICAS ──────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok', app: 'Snap Fisk' }));

app.get('/api/plans', async (_req, res) => {
  const plans = await prisma.plan.findMany({ orderBy: { price: 'asc' } });
  return res.json(plans);
});

// Sugerir NCM por descrição
app.get('/api/ncm/suggest', (req, res) => {
  const { descricao } = req.query;
  if (!descricao || typeof descricao !== 'string') {
    return res.json(null);
  }
  const suggestion = suggestNcm(descricao);
  return res.json(suggestion);
});

// ─── AUTH ────────────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  const p = registerSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Dados inválidos.', details: p.error.flatten() });
  const { cnpj, email, password } = p.data;
  const cnpjClean = cleanDoc(cnpj);
  const existing = await prisma.user.findFirst({ where: { cnpj: cnpjClean } });
  if (existing) return res.status(409).json({ error: 'CNPJ já cadastrado.' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { cnpj: cnpjClean, email, passwordHash } });
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  return res.status(201).json({ token, user: { id: user.id, cnpj: user.cnpj, email: user.email } });
});

app.post('/api/auth/login', async (req, res) => {
  const p = loginSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Dados inválidos.' });
  const { cnpj, password } = p.data;
  const user = await prisma.user.findUnique({ where: { cnpj: cleanDoc(cnpj) } });
  if (!user) return res.status(401).json({ error: 'CNPJ ou senha incorretos.' });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'CNPJ ou senha incorretos.' });
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  return res.json({ token, user: { id: user.id, cnpj: user.cnpj, email: user.email } });
});

// ─── ROTAS AUTENTICADAS ──────────────────────────────────────────────────────

app.get('/api/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { company: true, subscription: { include: { plan: true } } },
  });
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  return res.json({ id: user.id, cnpj: user.cnpj, email: user.email, company: user.company, subscription: user.subscription });
});

// ─── EMPRESA ────────────────────────────────────────────────────────────────

app.post('/api/company', authenticate, async (req, res) => {
  const p = companySchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Dados inválidos.', details: p.error.flatten() });
  const company = await prisma.company.upsert({
    where: { userId: req.userId! },
    create: { userId: req.userId!, ...p.data },
    update: { ...p.data },
  });
  return res.json(company);
});

app.get('/api/company', authenticate, async (req, res) => {
  const company = await prisma.company.findUnique({ where: { userId: req.userId } });
  if (!company) return res.status(404).json({ error: 'Empresa não cadastrada.' });
  return res.json(company);
});

// ─── PRODUTOS ────────────────────────────────────────────────────────────────

app.get('/api/products', authenticate, async (req, res) => {
  const { q } = req.query;
  const products = await prisma.product.findMany({
    where: {
      userId: req.userId,
      ...(q ? { descricao: { contains: String(q), mode: 'insensitive' } } : {}),
    },
    orderBy: { descricao: 'asc' },
    take: 50,
  });
  return res.json(products);
});

app.post('/api/products', authenticate, async (req, res) => {
  const p = productSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Dados inválidos.', details: p.error.flatten() });
  const product = await prisma.product.create({ data: { userId: req.userId!, ...p.data } });
  return res.status(201).json(product);
});

app.put('/api/products/:id', authenticate, async (req, res) => {
  const p = productSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Dados inválidos.' });
  const product = await prisma.product.updateMany({
    where: { id: req.params.id, userId: req.userId },
    data: p.data,
  });
  return res.json(product);
});

app.delete('/api/products/:id', authenticate, async (req, res) => {
  await prisma.product.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  return res.json({ success: true });
});

// ─── CLIENTES ────────────────────────────────────────────────────────────────

app.get('/api/customers', authenticate, async (req, res) => {
  const { q } = req.query;
  const customers = await prisma.customer.findMany({
    where: {
      userId: req.userId,
      ...(q ? {
        OR: [
          { nome: { contains: String(q), mode: 'insensitive' } },
          { cpfCnpj: { contains: cleanDoc(String(q)) } },
        ],
      } : {}),
    },
    orderBy: { nome: 'asc' },
    take: 50,
  });
  return res.json(customers);
});

app.post('/api/customers', authenticate, async (req, res) => {
  const p = customerSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Dados inválidos.', details: p.error.flatten() });
  const cpfCnpjClean = cleanDoc(p.data.cpfCnpj);
  const customer = await prisma.customer.create({
    data: { userId: req.userId!, ...p.data, cpfCnpj: cpfCnpjClean },
  });
  return res.status(201).json(customer);
});

app.put('/api/customers/:id', authenticate, async (req, res) => {
  const p = customerSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Dados inválidos.' });
  const cpfCnpjClean = cleanDoc(p.data.cpfCnpj);
  await prisma.customer.updateMany({
    where: { id: req.params.id, userId: req.userId },
    data: { ...p.data, cpfCnpj: cpfCnpjClean },
  });
  return res.json({ success: true });
});

app.delete('/api/customers/:id', authenticate, async (req, res) => {
  await prisma.customer.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  return res.json({ success: true });
});

// ─── MOTOR FISCAL ────────────────────────────────────────────────────────────

app.post('/api/fiscal-engine/query', authenticate, async (req, res) => {
  const p = fiscalQuerySchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Payload inválido.', details: p.error.flatten() });
  const result = await resolveFiscalRule(p.data, req.userId);
  return res.json(result);
});

app.get('/api/fiscal-engine/history', authenticate, async (req, res) => {
  const issuances = await prisma.guidedIssuance.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return res.json(issuances);
});

// ─── EMISSÃO DE NF-E ─────────────────────────────────────────────────────────

// Criar NF-e (rascunho)
app.post('/api/invoices', authenticate, async (req, res) => {
  const p = invoiceSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Dados inválidos.', details: p.error.flatten() });

  const company = await prisma.company.findUnique({ where: { userId: req.userId } });
  if (!company) return res.status(400).json({ error: 'Cadastre os dados da empresa antes de emitir NF-e.' });

  const numero = company.proximaNF;

  // Calcular totais
  const items = p.data.items.map(item => ({
    ...item,
    vProd: parseFloat((item.qCom * item.vUnCom).toFixed(2)),
    cfop: item.cfop || p.data.cfop,
  }));
  const vTotal = items.reduce((s, i) => s + i.vProd, 0) + p.data.vFrete - p.data.vDesc;

  // Buscar cliente
  const customer = p.data.customerId
    ? await prisma.customer.findUnique({ where: { id: p.data.customerId } })
    : null;

  // Gerar XML
  const invoiceData = {
    ...p.data,
    numero,
    serie: company.serie,
    dhEmi: new Date(),
    vTotal,
  };
  const xmlGerado = gerarXmlNFe(invoiceData, company, customer, items);

  // Salvar no banco
  const invoice = await prisma.invoice.create({
    data: {
      userId: req.userId!,
      customerId: p.data.customerId || null,
      numero,
      serie: company.serie,
      tpNF: p.data.tpNF,
      natOp: p.data.natOp,
      cfop: p.data.cfop,
      cstCsosn: p.data.cstCsosn,
      infCpl: p.data.infCpl,
      status: 'GERADO',
      xmlGerado,
      ambiente: p.data.ambiente,
      vTotal,
      vFrete: p.data.vFrete,
      vDesc: p.data.vDesc,
      modFrete: p.data.modFrete,
      tPag: p.data.tPag,
      vPag: p.data.vPag,
      operation: p.data.operation,
      purpose: p.data.purpose,
      items: {
        create: items.map((item, idx) => ({
          nItem: idx + 1,
          productId: item.productId || null,
          xProd: item.xProd,
          ncm: item.ncm,
          cfop: item.cfop,
          uCom: item.uCom,
          qCom: item.qCom,
          vUnCom: item.vUnCom,
          vProd: item.vProd,
          ean: item.ean,
          origem: item.origem,
          csosn: item.csosn,
        })),
      },
    },
    include: { items: true, customer: true },
  });

  // Salvar produtos novos no cadastro
  for (const item of p.data.items) {
    if (item.saveProduct && !item.productId) {
      await prisma.product.create({
        data: {
          userId: req.userId!,
          descricao: item.xProd,
          ncm: item.ncm,
          unidade: item.uCom,
          valorUnit: item.vUnCom,
          ean: item.ean,
          origem: item.origem,
        },
      });
    }
  }

  // Avançar numeração
  await prisma.company.update({
    where: { userId: req.userId },
    data: { proximaNF: { increment: 1 } },
  });

  return res.status(201).json({ ...invoice, xmlGerado });
});

// Listar NF-e
app.get('/api/invoices', authenticate, async (req, res) => {
  const invoices = await prisma.invoice.findMany({
    where: { userId: req.userId },
    include: { customer: true, items: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return res.json(invoices);
});

// Buscar NF-e por ID
app.get('/api/invoices/:id', authenticate, async (req, res) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, userId: req.userId },
    include: { customer: true, items: { include: { product: true } } },
  });
  if (!invoice) return res.status(404).json({ error: 'NF-e não encontrada.' });
  return res.json(invoice);
});

// Download XML
app.get('/api/invoices/:id/xml', authenticate, async (req, res) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!invoice || !invoice.xmlGerado) return res.status(404).json({ error: 'XML não disponível.' });
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="NFe_${invoice.numero}.xml"`);
  return res.send(invoice.xmlGerado);
});

// ─── PLANOS E ASSINATURA ─────────────────────────────────────────────────────

app.get('/api/subscription', authenticate, async (req, res) => {
  const subscription = await prisma.subscription.findUnique({
    where: { userId: req.userId },
    include: { plan: true },
  });
  return res.json(subscription ?? null);
});

app.post('/api/billing/pix', authenticate, async (req, res) => {
  const { planCode } = req.body;
  if (!['SNAP_ONE', 'SNAP_TEN', 'SNAP_MEI'].includes(planCode)) {
    return res.status(400).json({ error: 'Plano inválido.' });
  }
  const plan = await prisma.plan.findUnique({ where: { code: planCode } });
  if (!plan) return res.status(404).json({ error: 'Plano não encontrado.' });

  let subscription = await prisma.subscription.findUnique({ where: { userId: req.userId } });
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

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const pixCode = `SNAPFISK-${subscription.id.slice(0, 8).toUpperCase()}-${plan.code}`;
  const charge = await prisma.billingCharge.create({
    data: { subscriptionId: subscription.id, amount: plan.price, status: 'PENDING', pixCode, expiresAt },
  });

  return res.json({ chargeId: charge.id, pixCode: charge.pixCode, amount: charge.amount, expiresAt: charge.expiresAt, plan: { name: plan.name, code: plan.code } });
});

app.get('/api/billing/:chargeId/status', authenticate, async (req, res) => {
  const chargeId = String(req.params.chargeId);
  const charge = await prisma.billingCharge.findUnique({ where: { id: chargeId } });
  if (!charge) return res.status(404).json({ error: 'Cobrança não encontrada.' });
  if (charge.status === 'PENDING' && charge.expiresAt && charge.expiresAt < new Date()) {
    await prisma.billingCharge.update({ where: { id: charge.id }, data: { status: 'EXPIRED' } });
    return res.json({ status: 'EXPIRED' });
  }
  return res.json({ status: charge.status, paidAt: charge.paidAt });
});

app.post('/api/billing/:chargeId/confirm', authenticate, async (req, res) => {
  const chargeId = String(req.params.chargeId);
  const charge = await prisma.billingCharge.findUnique({ where: { id: chargeId } });
  if (!charge) return res.status(404).json({ error: 'Cobrança não encontrada.' });
  if (charge.status !== 'PENDING') return res.status(400).json({ error: 'Cobrança não está pendente.' });

  const subscription = await prisma.subscription.findUnique({
    where: { id: charge.subscriptionId },
    include: { plan: true },
  });
  if (!subscription) return res.status(404).json({ error: 'Assinatura não encontrada.' });

  const now = new Date();
  const endDate = subscription.plan.code === 'SNAP_ONE'
    ? null
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.billingCharge.update({ where: { id: charge.id }, data: { status: 'PAID', paidAt: now } }),
    prisma.subscription.update({ where: { id: charge.subscriptionId }, data: { status: 'ACTIVE', nfUsed: 0, startDate: now, endDate } }),
  ]);

  return res.json({ success: true, message: 'Pagamento confirmado. Plano ativado.' });
});

// ─── CATCH-ALL (SPA) ─────────────────────────────────────────────────────────

app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
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
