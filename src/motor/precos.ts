/**
 * Preços: cada anotação = produto + preço + embalagem + marca + mercado + quando + quem.
 * Ficam num documento separado (casas/{casaId}/dados/precos = { p: { <id>: anotação } }) para não engordar o da casa.
 * Este arquivo não sabe que existe tela nem internet. Dinheiro SEMPRE em centavos (inteiro).
 */
import { normalizarNome } from './busca.ts';
import { aplicarEm, inverso as inversoDe } from './casa.ts';
import { APAGAR, type Escritas, type ItemComId, type MercadoComId } from './tipos.ts';

export interface Preco {
  item: string;
  centavos: number;
  emb: string;
  marca: string;
  merc: string;
  /** quando foi anotado (milissegundos) */
  quando: number;
  /** quem anotou: o nome da pessoa ou "Claude" */
  fonte: string;
  /** uid de quem gravou */
  por: string;
}
export type Precos = Record<string, Preco>;
export interface DocPrecos { p: Precos }

export const LIMITES_PRECO = {
  emb: 20, marca: 40, nome: 40,
  /** teto do documento (as regras do Firebase conferem) */
  anotacoes: 600,
  /** quantas anotações de um produto em um mercado ficam guardadas */
  porProdutoMercado: 3,
  diasGuardar: 90,
  /** a comparação "mais barato" só usa preços de até 7 dias */
  diasValem: 7,
  /** R$ 100.000 (de fora) */
  maxCentavos: 10_000_000,
  /** o que se lê de uma resposta colada */
  caracteres: 20_000,
  linhas: 200,
} as const;

const DIA = 86_400_000;
const idSeguro = (v: string): boolean => /^[A-Za-z0-9]{1,128}$/.test(v);

/* ---------- valores ---------- */

/** "8,99", "8.99", "R$ 1.234,50", "R$ 6,98/kg" → centavos (899, 899, 123450, 698). Texto sem preço válido (0 ou ≥ R$ 100.000) → null. */
export function lerValor(texto: string): number | null {
  const m = String(texto ?? '').match(/\d[\d.,]*/);
  if (!m) return null;
  const s = m[0].replace(/[.,]+$/, '');
  const virg = s.lastIndexOf(','), ponto = s.lastIndexOf('.');
  const sep = Math.max(virg, ponto);
  let inteiro = s, frac = '';
  if (sep >= 0) {
    const depois = s.slice(sep + 1), c = s[sep]!;
    const repetido = s.split(c).length > 2;
    const outro = virg >= 0 && ponto >= 0;
    if (outro || (!repetido && depois.length <= 2)) {
      if (depois.length > 2) return null;
      inteiro = s.slice(0, sep); frac = depois;
    } else if (depois.length === 3) inteiro = s; // "1.234" = mil duzentos e trinta e quatro
    else return null;
  }
  const reais = Number(inteiro.replace(/[.,]/g, '') || '0');
  const centavos = reais * 100 + Number(frac.padEnd(2, '0') || '0');
  return Number.isSafeInteger(centavos) && centavos > 0 && centavos < LIMITES_PRECO.maxCentavos ? centavos : null;
}

/** "R$ 8,99" (a partir dos centavos). */
export function reais(centavos: number): string {
  const c = Math.round(centavos);
  return `R$ ${Math.floor(c / 100).toLocaleString('pt-BR')},${String(c % 100).padStart(2, '0')}`;
}

/* ---------- embalagem ---------- */

export type Unidade = 'kg' | 'L' | 'un';
export interface Medida { q: number; un: Unidade }

/**
 * Todas as medidas que a embalagem diz: "20 un" · "500 g" → 0,5 kg · "6 x 500 ml" → 3 L ·
 * "5 un ~400 g" → 5 un E 0,4 kg · "1 dúzia" → 12 un · "/kg" → 1 kg. "~" e "a granel" não atrapalham.
 */
export function lerMedidas(texto: string): Medida[] {
  const n = normalizarNome(texto).replace(/~/g, ' ');
  const out: Medida[] = [];
  if (/\/\s*(kg|quilo)\b/.test(n)) out.push({ q: 1, un: 'kg' });
  if (/\/\s*(l|litro)\b/.test(n)) out.push({ q: 1, un: 'L' });
  const dz = n.match(/(\d+)?\s*(duzias?|\bdz\b)/);
  if (dz) out.push({ q: 12 * (dz[1] ? Number(dz[1]) : 1), un: 'un' });
  const re = /(?:(\d+)\s*x\s*)?(\d+(?:[.,]\d+)?)\s*(unid\w*|un|kg|quilos?|gramas?|g|litros?|ml|l)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(n))) {
    const vezes = m[1] ? Number(m[1]) : 1;
    let q = parseFloat(m[2]!.replace(',', '.')) * vezes;
    const u = m[3]!;
    let un: Unidade;
    if (u === 'g' || u.startsWith('gram')) { q /= 1000; un = 'kg'; }
    else if (u === 'ml') { q /= 1000; un = 'L'; }
    else if (u === 'l' || u.startsWith('litro')) un = 'L';
    else if (u === 'kg' || u.startsWith('quilo')) un = 'kg';
    else un = 'un';
    if (q > 0 && !out.some(x => x.un === un)) out.push({ q, un });
  }
  return out;
}
export const lerEmb = (texto: string): Medida | null => lerMedidas(texto)[0] ?? null;

/** Centavos por unidade numa unidade dada (kg, L ou un), se a embalagem disser. */
export function porUnidadeEm(p: Pick<Preco, 'centavos' | 'emb'>, un: Unidade): number | null {
  const m = lerMedidas(p.emb).find(x => x.un === un);
  return m ? p.centavos / m.q : null;
}
/** A 1ª medida da embalagem: "R$ 15,90/kg" (para mostrar). */
export function textoPorUnidade(p: Pick<Preco, 'centavos' | 'emb'>): string {
  const m = lerEmb(p.emb);
  if (!m || (m.q === 1 && m.un !== 'un')) return ''; // "1 kg" já é o preço por kg
  return `${reais(p.centavos / m.q)}/${m.un}`;
}

/* ---------- tempo ---------- */

/** Dias de calendário entre duas datas: hoje = 0, ontem = 1. */
export function diasEntre(quando: number, agora: number): number {
  const a = new Date(quando), b = new Date(agora);
  const dia = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.max(0, Math.round((dia(b) - dia(a)) / DIA));
}
export const quandoTexto = (dias: number): string => (dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`);

/* ---------- comparar ---------- */

export interface Comparacao {
  /** o preço mais novo de cada mercado (de qualquer idade) */
  por: Record<string, Preco & { id: string }>;
  /** mercado mais barato (só com preços de até 7 dias em pelo menos 2 mercados; empate exato = ninguém) */
  melhor: string | null;
}

/** Mais novo vence; no mesmo instante vence a última gravada (os ids crescem com o tempo, ver novoIdPreco). */
const maisNovo = (a: { quando: number; id: string }, b: { quando: number; id: string }): boolean =>
  a.quando > b.quando || (a.quando === b.quando && a.id > b.id);

export function comparar(precos: Precos, itemId: string, mercados: string[], agora: number): Comparacao {
  const por: Comparacao['por'] = {};
  for (const [id, p] of Object.entries(precos)) {
    if (p.item !== itemId || !mercados.includes(p.merc)) continue;
    const atual = por[p.merc];
    if (!atual || maisNovo({ quando: p.quando, id }, atual)) por[p.merc] = { ...p, id };
  }
  const valem = Object.values(por).filter(p => diasEntre(p.quando, agora) <= LIMITES_PRECO.diasValem);
  if (valem.length < 2) return { por, melhor: null };
  // compara pela 1ª unidade que TODOS têm (peso e volume antes de unidade); sem unidade em comum, pelo preço cheio
  const un = (['kg', 'L', 'un'] as const).find(u => valem.every(p => porUnidadeEm(p, u) !== null));
  const custo = (p: Preco): number => Math.round((un ? porUnidadeEm(p, un)! : p.centavos) * 1e6);
  const menor = Math.min(...valem.map(custo));
  const empatados = valem.filter(p => custo(p) === menor);
  return { por, melhor: empatados.length === 1 ? empatados[0]!.merc : null };
}

export type Etiqueta =
  | { tipo: 'melhor'; aqui: Preco }
  | { tipo: 'aqui'; aqui: Preco }
  | { tipo: 'outro'; outroMerc: string; outro: Preco };

/** O que a tela Mercado mostra embaixo do produto (a ordem e os grupos NUNCA mudam por causa de preço). */
export function etiqueta(c: Comparacao, mercado: string, agora: number): Etiqueta | null {
  const aqui = c.por[mercado];
  if (c.melhor === null) return aqui && diasEntre(aqui.quando, agora) <= LIMITES_PRECO.diasValem ? { tipo: 'aqui', aqui } : null;
  if (c.melhor === mercado) return { tipo: 'melhor', aqui: aqui! };
  return { tipo: 'outro', outroMerc: c.melhor, outro: c.por[c.melhor]! };
}

/* ---------- gravar ---------- */

let seq = 0;
/** Id de anotação: o tempo vem primeiro (e completo), então os ids crescem com o tempo. Só letras e números. */
export function novoIdPreco(agora: number = Date.now(), aleatorio: () => number = Math.random): string {
  seq = (seq + 1) % 46656;
  return 'p' + agora.toString(36).padStart(9, '0') + seq.toString(36).padStart(3, '0') + Math.floor(aleatorio() * 1296).toString(36).padStart(2, '0');
}

const cortar = (t: string, max: number): string => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function novaAnotacao(d: { item: string; centavos: number; emb?: string; marca?: string; merc: string; fonte: string; por: string }, agora: number): Preco {
  return {
    item: d.item, centavos: d.centavos, emb: cortar(d.emb ?? '', LIMITES_PRECO.emb), marca: cortar(d.marca ?? '', LIMITES_PRECO.marca),
    merc: d.merc, quando: agora, fonte: cortar(d.fonte, LIMITES_PRECO.nome) || 'Alguém', por: d.por,
  };
}

/** O que sobra depois da limpeza: some o de mais de 90 dias, ficam só as 3 mais novas por produto e mercado, e no máximo 600 no total. */
export function limpar(precos: Precos, agora: number): Set<string> {
  const guardar: [string, Preco][] = Object.entries(precos).filter(([, p]) => agora - p.quando <= LIMITES_PRECO.diasGuardar * DIA);
  guardar.sort((a, b) => (maisNovo({ quando: a[1].quando, id: a[0] }, { quando: b[1].quando, id: b[0] }) ? -1 : 1));
  const contagem: Record<string, number> = {};
  const ficam: string[] = [];
  for (const [id, p] of guardar) {
    const chave = `${p.item}|${p.merc}`;
    contagem[chave] = (contagem[chave] ?? 0) + 1;
    if (contagem[chave]! <= LIMITES_PRECO.porProdutoMercado) ficam.push(id);
  }
  return new Set(ficam.slice(0, LIMITES_PRECO.anotacoes));
}

/**
 * Anotar (uma ou várias) numa gravação só: as novas entram e, na MESMA gravação, as que a limpeza tira saem.
 * `novas` = [id, anotação]. Chaves das escritas: "p.<id>".
 */
export function anotar(atual: Precos, novas: [string, Preco][], agora: number): Escritas {
  const juntas: Precos = { ...atual };
  for (const [id, p] of novas) juntas[id] = p;
  const ficam = limpar(juntas, agora);
  const r: Escritas = {};
  for (const [id, p] of novas) if (ficam.has(id)) r[`p.${id}`] = p;
  for (const id of Object.keys(atual)) if (!ficam.has(id) && !(`p.${id}` in r)) r[`p.${id}`] = APAGAR;
  return r;
}

/** Aplica escritas "p.<id>" no documento de preços. */
export const aplicarPrecos = (precos: Precos, escritas: Escritas): Precos => aplicarEm<DocPrecos>({ p: precos }, escritas).p;
/** As escritas que desfazem (também devolvem o que a limpeza apagou). */
export const inversoPrecos = (precos: Precos, escritas: Escritas): Escritas => inversoDe({ p: precos }, escritas);

/** Tudo que chega da nuvem passa por aqui. */
export function lerPrecos(dados: unknown): Precos {
  const bruto = (dados as { p?: unknown } | null | undefined)?.p;
  const r: Precos = {};
  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) return r;
  for (const [id, v] of Object.entries(bruto as Record<string, unknown>)) {
    const p = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
    const centavos = p.centavos;
    if (!idSeguro(id) || typeof p.item !== 'string' || !idSeguro(p.item) || typeof p.merc !== 'string' || !idSeguro(p.merc)) continue;
    if (typeof centavos !== 'number' || !Number.isInteger(centavos) || centavos <= 0 || centavos >= LIMITES_PRECO.maxCentavos) continue;
    if (typeof p.quando !== 'number' || !Number.isFinite(p.quando)) continue;
    r[id] = {
      item: p.item, centavos, emb: typeof p.emb === 'string' ? p.emb.slice(0, LIMITES_PRECO.emb) : '',
      marca: typeof p.marca === 'string' ? p.marca.slice(0, LIMITES_PRECO.marca) : '', merc: p.merc, quando: p.quando,
      fonte: typeof p.fonte === 'string' ? p.fonte.slice(0, LIMITES_PRECO.nome) : '', por: typeof p.por === 'string' ? p.por.slice(0, 128) : '',
    };
  }
  return r;
}

/* ---------- perguntar ao Claude e ler a resposta ---------- */

/** A pergunta já montada: cidade, lista do que falta, mercados (com os sites) e o pedido do bloco ACABOU. */
export function textoPergunta(cidade: string, itens: { nome: string }[], mercados: { nome: string; site: string }[]): string {
  const nomes = mercados.map(m => m.nome);
  const juntos = nomes.length > 1 ? `${nomes.slice(0, -1).join(', no ')} e no ${nomes[nomes.length - 1]}` : (nomes[0] ?? '');
  const mais = nomes.length > 1;
  const cid = cortar(cidade, 60);
  return `${cid ? `Moro em ${cid}. ` : ''}Preciso comprar:\n`
    + (itens.length ? itens.map(i => `- ${i.nome}`).join('\n') : '- (a lista está vazia)')
    + `\n\n${mais ? `Compare os preços desses itens no ${juntos}.` : `Veja os preços desses itens no ${juntos}.`} O preço do site é o mesmo da loja:\n`
    + mercados.map(m => `- ${m.nome}: ${m.site || '(sem site)'}`).join('\n')
    + '\nUse os preços de hoje, com as promoções.'
    + '\nPara cada item, diga o preço, a embalagem e a marca' + (mais ? ' em cada mercado' : '') + ', e compare pelo preço por unidade de medida (dúzia, kg, litro ou unidade), porque as embalagens mudam de tamanho.'
    + '\nDiga onde encontrou cada preço. Se não achar, escreva "não achei" em vez de chutar.'
    + (mais ? '\nDepois, diga se vale ir num mercado só ou dividir a compra.' : '')
    + '\n\nFaça a análise completa e explique o resultado. Depois, no FIM da resposta, coloque o bloco abaixo DENTRO DE UMA CAIXA DE CÓDIGO (três crases, para eu tocar em "copiar" e colar direto no meu app). A 1ª linha da caixa é só a palavra ACABOU e, embaixo, uma linha por item, exatamente neste formato:'
    + '\n```\nACABOU'
    + `\nitem | ${nomes.map(n => `${n}: R$ preço (embalagem, marca)`).join(' | ')}`
    + `\nExemplo: Ovos | ${nomes.map((n, k) => `${n}: ${k ? 'R$ 9,49 (20 un, Cami)' : 'R$ 8,99 (20 un, Mantiqueira)'}`).join(' | ')}`
    + '\n```'
    + '\nNa caixa, use só o nome do item, sem negrito. Se não achar um preço, escreva "não achei" no lugar dele. Não ponha nada além do bloco dentro da caixa.';
}

export type ErroResposta = 'sem-bloco' | 'nada-bate';
export interface RespostaLida { erro: ErroResposta | null; anotacoes: Omit<Preco, 'quando' | 'fonte' | 'por'>[] }

/**
 * Lê a resposta colada: acha a linha ACABOU (aceita **ACABOU**, # ACABOU, ACABOU:), lê as linhas com "|",
 * acha o produto (nome igual primeiro; depois "contém", só entre os itens da lista) e o mercado pelo nome, e vira
 * uma anotação por preço. Ignora "não achei", produto ou mercado desconhecido e linhas a mais. Lê no máximo 20 mil
 * caracteres e 200 linhas. Duas linhas do mesmo produto e mercado: vale a última.
 */
export function lerResposta(texto: string, itens: ItemComId[], mercados: MercadoComId[]): RespostaLida {
  const linhas = String(texto ?? '').slice(0, LIMITES_PRECO.caracteres).split(/\r?\n/);
  let k = -1;
  linhas.forEach((l, n) => { if (/^[\s*#>_`-]*ACABOU[\s*:_`]*$/i.test(l)) k = n; });
  if (k < 0) return { erro: 'sem-bloco', anotacoes: [] };

  const achaMercado = (rotulo: string): MercadoComId | undefined => {
    const t = normalizarNome(rotulo);
    if (!t) return undefined;
    const exato = mercados.find(m => normalizarNome(m.nome) === t);
    if (exato) return exato;
    return mercados
      .filter(m => { const n = normalizarNome(m.nome); return n && (t.includes(n) || n.includes(t)); })
      .sort((a, b) => b.nome.length - a.nome.length)[0];
  };
  const achaItem = (nome: string): ItemComId | undefined => {
    if (!nome) return undefined;
    const exato = itens.find(i => normalizarNome(i.nome) === nome);
    if (exato) return exato;
    return itens
      .filter(i => i.falta && normalizarNome(i.nome).length >= 3 && (normalizarNome(i.nome).includes(nome) || nome.includes(normalizarNome(i.nome))))
      .sort((a, b) => b.nome.length - a.nome.length)[0];
  };

  const lidas = new Map<string, RespostaLida['anotacoes'][number]>();
  for (const l of linhas.slice(k + 1, k + 1 + LIMITES_PRECO.linhas)) {
    if (!l.includes('|')) continue;
    const partes = l.split('|').map(x => x.replace(/[*_`]/g, '').trim());
    const item = achaItem(normalizarNome((partes[0] ?? '').replace(/^[-•\d.)\s]+/, '')));
    if (!item) continue;
    for (const parte of partes.slice(1)) {
      const dp = parte.indexOf(':');
      if (dp < 0) continue;
      const m = achaMercado(parte.slice(0, dp)), val = parte.slice(dp + 1).trim();
      if (!m || /nao achei/.test(normalizarNome(val))) continue;
      const antes = val.split('(')[0]!;
      const centavos = lerValor(antes);
      if (!centavos) continue;
      const dentro = (val.match(/\(([^)]*)\)/) ?? [])[1] ?? '';
      const pedacos = dentro.split(/,(?!\d)/).map(x => x.trim()).filter(Boolean); // a vírgula de "1,3 kg" não separa
      const porKg = antes.match(/\/\s*(kg|l)\b/i);
      let emb = porKg ? `1 ${porKg[1]!.toLowerCase() === 'l' ? 'L' : 'kg'}` : '';
      const marca: string[] = [];
      for (const x of pedacos) {
        if (!emb && lerEmb(x)) emb = x;
        else if (!/^sem marca$/i.test(normalizarNome(x))) marca.push(x);
      }
      lidas.set(`${item.id}|${m.id}`, { item: item.id, centavos, emb: cortar(emb, LIMITES_PRECO.emb), marca: cortar(marca.join(', '), LIMITES_PRECO.marca), merc: m.id });
    }
  }
  const anotacoes = [...lidas.values()];
  return { erro: anotacoes.length ? null : 'nada-bate', anotacoes };
}
