import 'dotenv/config';
import express from 'express';
import path from 'path';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { resolveFiscalRule } from './fiscal-engine';
import fs from 'fs';
import { prisma } from './prisma';

const app = express();
app.use(express.json({ limit: '10mb' }));

const JWT_SECRET = process.env.JWT_SECRET ?? 'snapfisk-secret-dev';

// Carregar tabela NCM oficial
let ncmTable: Array<{ c: string; d: string }> = [];
try {
  const ncmPath = path.join(process.cwd(), 'ncm_table.json');
  ncmTable = JSON.parse(fs.readFileSync(ncmPath, 'utf-8'));
  console.log(`✅ Tabela NCM carregada: ${ncmTable.length} códigos`);
} catch {
  console.warn('⚠️ ncm_table.json não encontrado — busca NCM desabilitada');
}

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
  im: z.string().optional(),
  uf: z.string().length(2),
  cuf: z.string().optional(),
  cMun: z.string().optional(),
  xMun: z.string().optional(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  fone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  taxRegime: z.enum(['simples_nacional', 'lucro_presumido', 'lucro_real', 'mei']),
  serie: z.string().optional(),
  proximaNF: z.number().optional(),
  logo: z.string().optional(),
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
  cpfCnpj: z
    .string()
    .min(1)
    .transform((val) => val.replace(/\D/g, '')),
  nome: z.string().min(1),
  ie: z.string().optional(),
  indIEDest: z.string().default('9'),
  email: z.string().email({ message: 'E-mail inválido.' }),
  fone: z.string().optional(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  xMun: z.string().optional(),
  cMun: z.string().optional(),
  uf: z.string().length(2).optional(),
});

const invoiceItemSchema = z.object({
  productId: z.string().optional(),
  cProd: z.string().optional(),
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
  const d = descricao.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // remove acentos
  const suggestions: Array<{ keywords: string[]; ncm: string; descricao: string }> = [
    // Veículos e autopeças
    { keywords: ['farol', 'lanterna', 'luz dianteira', 'pisca'], ncm: '85122011', descricao: 'Faróis e projetores' },
    { keywords: ['retrovisor', 'espelho retrovisor'], ncm: '70091000', descricao: 'Espelhos retrovisores' },
    { keywords: ['para-choque', 'parachoque'], ncm: '87087010', descricao: 'Para-choques' },
    { keywords: ['pneu', 'camara de ar'], ncm: '40112000', descricao: 'Pneus de borracha' },
    { keywords: ['motor', 'motorizacao', 'motor de arranque'], ncm: '84089000', descricao: 'Motores' },
    { keywords: ['freio', 'pastilha', 'disco de freio', 'lona de freio'], ncm: '87083000', descricao: 'Freios e partes' },
    { keywords: ['bateria', 'acumulador', 'bateria automotiva'], ncm: '85072000', descricao: 'Baterias' },
    { keywords: ['filtro de oleo', 'filtro de ar', 'filtro de combustivel', 'filtro'], ncm: '84212300', descricao: 'Filtros' },
    { keywords: ['amortecedor', 'mola', 'suspensao'], ncm: '87088000', descricao: 'Amortecedores' },
    { keywords: ['correia', 'correia dentada', 'correia alternador'], ncm: '40103990', descricao: 'Correias' },
    { keywords: ['vela', 'vela de ignicao', 'vela de ignição'], ncm: '85111000', descricao: 'Velas de ignição' },
    { keywords: ['radiador', 'resfriamento'], ncm: '87089100', descricao: 'Radiadores' },
    { keywords: ['rolamento', 'cubo de roda'], ncm: '84821010', descricao: 'Rolamentos' },
    { keywords: ['escapamento', 'silencioso', 'cano de escapamento'], ncm: '87089200', descricao: 'Silenciosos e tubos de escape' },
    { keywords: ['embreagem', 'disco de embreagem'], ncm: '87083100', descricao: 'Embreagens' },
    // Roupas e calçados
    { keywords: ['camiseta', 'camisa', 'blusa', 'regata'], ncm: '61091000', descricao: 'Camisetas de malha' },
    { keywords: ['calca', 'bermuda', 'short', 'jeans'], ncm: '62034200', descricao: 'Calças de algodão' },
    { keywords: ['vestido', 'saia'], ncm: '61044200', descricao: 'Vestidos de malha' },
    { keywords: ['casaco', 'jaqueta', 'sobretudo', 'moletom'], ncm: '61011000', descricao: 'Casacos e jaquetas' },
    { keywords: ['meia', 'meias'], ncm: '61152200', descricao: 'Meias' },
    { keywords: ['roupa intima', 'calcinha', 'cueca', 'sutica'], ncm: '61082200', descricao: 'Roupas íntimas' },
    { keywords: ['sapato', 'tenis', 'calcado', 'chinelo', 'sandalia', 'bota'], ncm: '64041100', descricao: 'Calçados' },
    // Eletrônicos
    { keywords: ['notebook', 'computador', 'laptop'], ncm: '84713012', descricao: 'Computadores portáteis' },
    { keywords: ['celular', 'smartphone', 'iphone', 'android'], ncm: '85171231', descricao: 'Aparelhos telefônicos' },
    { keywords: ['tablet', 'ipad'], ncm: '84713019', descricao: 'Tablets' },
    { keywords: ['televisao', 'tv', 'televisor'], ncm: '85287210', descricao: 'Aparelhos receptores de televisão' },
    { keywords: ['monitor', 'tela'], ncm: '85285200', descricao: 'Monitores' },
    { keywords: ['impressora'], ncm: '84433200', descricao: 'Impressoras' },
    { keywords: ['teclado', 'mouse', 'periferico'], ncm: '84716000', descricao: 'Teclados e mouses' },
    { keywords: ['fone', 'headphone', 'headset', 'auricular'], ncm: '85183000', descricao: 'Fones de ouvido' },
    { keywords: ['camera', 'webcam', 'fotografica'], ncm: '85258090', descricao: 'Câmeras' },
    { keywords: ['pendrive', 'usb', 'memoria flash'], ncm: '84717012', descricao: 'Memórias flash' },
    { keywords: ['hd', 'ssd', 'disco rigido'], ncm: '84717090', descricao: 'Unidades de disco' },
    // Eletrodomésticos
    { keywords: ['geladeira', 'refrigerador', 'freezer'], ncm: '84181021', descricao: 'Refrigeradores' },
    { keywords: ['maquina de lavar', 'lavadora', 'lava e seca'], ncm: '84501110', descricao: 'Máquinas de lavar roupa' },
    { keywords: ['ar condicionado', 'split', 'climatizador'], ncm: '84151012', descricao: 'Ar condicionado' },
    { keywords: ['microondas'], ncm: '85165000', descricao: 'Fornos de micro-ondas' },
    { keywords: ['liquidificador', 'batedeira', 'processador'], ncm: '85094000', descricao: 'Liquidificadores' },
    { keywords: ['ferro de passar', 'ferro eletrico'], ncm: '85160000', descricao: 'Ferros elétricos' },
    { keywords: ['aspirador', 'aspirador de po'], ncm: '85081100', descricao: 'Aspiradores de pó' },
    { keywords: ['ventilador'], ncm: '84145920', descricao: 'Ventiladores' },
    { keywords: ['fogao', 'cooktop', 'forno'], ncm: '73211100', descricao: 'Fogões' },
    // Móveis
    { keywords: ['mesa', 'escrivaninha'], ncm: '94033000', descricao: 'Mesas' },
    { keywords: ['cadeira', 'poltrona', 'banco'], ncm: '94013000', descricao: 'Cadeiras' },
    { keywords: ['sofa', 'diva'], ncm: '94016100', descricao: 'Sofás' },
    { keywords: ['cama', 'beliche'], ncm: '94017900', descricao: 'Camas' },
    { keywords: ['armario', 'guarda-roupa', 'estante'], ncm: '94036000', descricao: 'Móveis de madeira' },
    // Saúde
    { keywords: ['medicamento', 'remedio', 'comprimido', 'capsula', 'farmaco'], ncm: '30049099', descricao: 'Medicamentos' },
    { keywords: ['mascaras', 'mascara cirurgica', 'epi'], ncm: '63079020', descricao: 'Máscaras' },
    { keywords: ['luva', 'luvas'], ncm: '39262000', descricao: 'Luvas' },
    // Beleza e higiene
    { keywords: ['shampoo', 'condicionador'], ncm: '33051000', descricao: 'Xampus' },
    { keywords: ['perfume', 'desodorante', 'colonia'], ncm: '33030000', descricao: 'Perfumes' },
    { keywords: ['creme', 'hidratante', 'cosmetico', 'maquiagem'], ncm: '33049900', descricao: 'Cosméticos' },
    { keywords: ['sabonete', 'sabao'], ncm: '34011190', descricao: 'Sabonetes' },
    // Alimentos
    { keywords: ['biscoito', 'bolacha', 'cookie'], ncm: '19053100', descricao: 'Biscoitos' },
    { keywords: ['chocolate', 'bombom'], ncm: '18069000', descricao: 'Chocolates' },
    { keywords: ['cafe', 'cafe torrado'], ncm: '09012100', descricao: 'Café' },
    { keywords: ['arroz'], ncm: '10063021', descricao: 'Arroz' },
    { keywords: ['feijao'], ncm: '07133390', descricao: 'Feijão' },
    { keywords: ['oleo', 'oleo de soja', 'azeite'], ncm: '15079011', descricao: 'Óleos vegetais' },
    { keywords: ['agua mineral', 'agua'], ncm: '22011000', descricao: 'Água mineral' },
    { keywords: ['refrigerante', 'suco'], ncm: '22021000', descricao: 'Refrigerantes' },
    // Ferramentas e construção
    { keywords: ['ferramenta', 'chave de fenda', 'chave inglesa', 'alicate', 'martelo'], ncm: '82055900', descricao: 'Ferramentas manuais' },
    { keywords: ['parafuso', 'porca', 'bucha', 'rebite'], ncm: '73181500', descricao: 'Parafusos e porcas' },
    { keywords: ['tinta', 'verniz', 'esmalte'], ncm: '32091000', descricao: 'Tintas' },
    { keywords: ['cimento', 'argamassa'], ncm: '25232900', descricao: 'Cimentos' },
    { keywords: ['cabo', 'fio eletrico', 'fio'], ncm: '85444900', descricao: 'Fios e cabos elétricos' },
    { keywords: ['tomada', 'interruptor', 'disjuntor'], ncm: '85366990', descricao: 'Tomadas e interruptores' },
    // Papelaria e escritório
    { keywords: ['papel', 'resma', 'folha'], ncm: '48025610', descricao: 'Papel' },
    { keywords: ['caneta', 'lapis', 'marcador'], ncm: '96081000', descricao: 'Canetas esferográficas' },
    { keywords: ['caderno', 'agenda', 'bloco'], ncm: '48201000', descricao: 'Cadernos' },
    // Brinquedos e esporte
    { keywords: ['brinquedo', 'boneca', 'carrinho de crianca'], ncm: '95030000', descricao: 'Brinquedos' },
    { keywords: ['bola', 'bola de futebol', 'bola de basquete'], ncm: '95066200', descricao: 'Bolas' },
    { keywords: ['bicicleta', 'bike'], ncm: '87120010', descricao: 'Bicicletas' },
    // Serviços (sem NCM específico — usar genérico)
    { keywords: ['servico', 'manutencao', 'reparo', 'conserto', 'instalacao', 'montagem'], ncm: '00000000', descricao: 'Serviços em geral' },
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
        <cProd>${item.cProd || String(idx + 1).padStart(13, '0').padStart(13, '2')}</cProd>
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

// Sugerir NCM por descrição (mapeamento rápido)
app.get('/api/ncm/suggest', (req, res) => {
  const { descricao } = req.query;
  if (!descricao || typeof descricao !== 'string') {
    return res.json(null);
  }
  const suggestion = suggestNcm(descricao);
  return res.json(suggestion);
});

// Busca NCM na tabela oficial
app.get('/api/ncm/search', (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string' || q.length < 2) {
    return res.json([]);
  }

  const normalize = (s: string) =>
    s.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ');

  const termos = normalize(q).split(' ').filter(t => t.length > 1);

  // Se for número, busca pelo código
  if (/^\d+$/.test(q.replace(/\./g, ''))) {
    const codigo = q.replace(/\./g, '');
    const results = ncmTable
      .filter(n => n.c.startsWith(codigo))
      .slice(0, 10)
      .map(n => ({ codigo: n.c, descricao: n.d }));
    return res.json(results);
  }

  // Busca por texto — todos os termos devem aparecer
  const results = ncmTable
    .filter(n => {
      const desc = normalize(n.d);
      return termos.every(t => desc.includes(t));
    })
    .slice(0, 10)
    .map(n => ({ codigo: n.c, descricao: n.d }));

  return res.json(results);
});

// Sugestão NCM via IA
app.get('/api/ncm/ai-suggest', async (req, res) => {
  const { descricao } = req.query;
  if (!descricao || typeof descricao !== 'string' || descricao.length < 2) {
    return res.json(null);
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Você é um especialista em NCM (Nomenclatura Comum do Mercosul) brasileiro.
Para o produto "${descricao}", retorne APENAS um JSON com este formato exato, sem explicações:
{"ncm":"00000000","descricao":"descrição oficial resumida"}

Regras:
- NCM deve ter exatamente 8 dígitos sem pontos
- Use a tabela NCM vigente no Brasil
- Se for serviço, use ncm "00000000"
- Retorne apenas o JSON, nada mais`
        }],
      }),
    });

    const data = await response.json() as any;
    const text = data?.content?.[0]?.text?.trim() || '';

    // Extrair JSON da resposta
    const match = text.match(/\{[^}]+\}/);
    if (!match) return res.json(null);

    const result = JSON.parse(match[0]);
    if (!result.ncm || result.ncm.length !== 8) return res.json(null);

    return res.json(result);
  } catch (e) {
    console.error('Erro na sugestão NCM via IA:', e);
    return res.json(null);
  }
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
  if (!p.success) {
    return res.status(400).json({ error: 'Dados inválidos.', details: p.error.flatten() });
  }
  try {
    // cpfCnpj já chega limpo pelo .transform() do schema
    const customer = await prisma.customer.create({
      data: { userId: req.userId!, ...p.data },
    });
    return res.status(201).json(customer);
  } catch (err: any) {
    console.error('Erro ao criar cliente:', err);
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'CPF/CNPJ já cadastrado.' });
    }
    return res.status(500).json({ error: 'Erro ao salvar cliente.', detail: err.message });
  }
});

app.put('/api/customers/:id', authenticate, async (req, res) => {
  const p = customerSchema.safeParse(req.body);
  if (!p.success) {
    return res.status(400).json({ error: 'Dados inválidos.', details: p.error.flatten() });
  }
  try {
    // cpfCnpj já chega limpo pelo .transform() do schema
    await prisma.customer.updateMany({
      where: { id: req.params.id, userId: req.userId },
      data: { ...p.data },
    });
    return res.json({ success: true });
  } catch (err: any) {
    console.error('Erro ao atualizar cliente:', err);
    return res.status(500).json({ error: 'Erro ao atualizar cliente.', detail: err.message });
  }
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
