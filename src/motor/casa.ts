/**
 * TODAS as regras da casa de Acabou! num lugar só. Este arquivo não sabe que existe tela nem internet.
 *
 * Cada ação devolve um conjunto de ESCRITAS (só os campos que mudaram, como caminhos do Firestore).
 *   marcarFalta(casa, 'cafe', …)  →  { 'itens.cafe.falta': true, 'itens.cafe.quem': 'Ana', … }
 * - `aplicar(casa, escritas)` faz a mudança na cópia local (a tela atualiza na hora);
 * - a camada da nuvem manda as MESMAS escritas, de uma vez só, para o Firebase;
 * - `inverso(casa, escritas)` devolve as escritas que desfazem (é o botão "Desfazer").
 */
import { CATEGORIAS_INICIAIS, CORREDORES_INICIAIS, ITENS_INICIAIS } from './catalogo.ts';
import { semAcento } from './busca.ts';
import {
  APAGAR, LIMITES,
  type Alvo, type Casa, type Escritas, type Item, type ItemComId, type Lista, type Mercado, type MercadoComId, type NoMercado,
} from './tipos.ts';

/** O mercado que nasce com o app (e que recebe os corredores de antes da rodada 3). */
export const ID_SHIBATA = 'shibata';
export const SITE_SHIBATA = 'https://www.loja.shibata.com.br';
export const CIDADE_PADRAO = 'São José dos Campos (SP)';

/* ---------- aplicar e desfazer ---------- */

/** Aplica as escritas numa cópia da casa (a original não muda). */
export function aplicar(casa: Casa, escritas: Escritas): Casa {
  return aplicarEm(casa, escritas);
}

/** O mesmo, para qualquer documento (a casa, os preços…). */
export function aplicarEm<T extends object>(doc: T, escritas: Escritas): T {
  const nova = structuredClone(doc) as unknown as Record<string, unknown>;
  for (const [caminho, valor] of Object.entries(escritas)) {
    const partes = caminho.split('.');
    let alvo = nova;
    for (const p of partes.slice(0, -1)) {
      const proximo = alvo[p];
      if (typeof proximo !== 'object' || proximo === null) alvo[p] = {};
      alvo = alvo[p] as Record<string, unknown>;
    }
    const ultimo = partes[partes.length - 1]!;
    if (valor === APAGAR) delete alvo[ultimo];
    else alvo[ultimo] = structuredClone(valor);
  }
  return nova as unknown as T;
}

function ler(doc: object, caminho: string): unknown {
  let atual: unknown = doc;
  for (const p of caminho.split('.')) {
    if (typeof atual !== 'object' || atual === null || !(p in atual)) return APAGAR;
    atual = (atual as Record<string, unknown>)[p];
  }
  return structuredClone(atual);
}

/** As escritas que desfazem `escritas` (valem para a casa ANTES de aplicar). */
export function inverso(doc: object, escritas: Escritas): Escritas {
  const r: Escritas = {};
  for (const caminho of Object.keys(escritas)) r[caminho] = ler(doc, caminho);
  return r;
}

/* ---------- ler a casa ---------- */

export function listarItens(casa: Casa): ItemComId[] {
  return Object.entries(casa.itens)
    .map(([id, i]) => ({ ...i, id }))
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt'));
}

export const itensFaltando = (casa: Casa): ItemComId[] => listarItens(casa).filter(i => i.falta);

/** Os corredores de um mercado, ou as categorias da casa. */
export function listaDe(casa: Casa, alvo: Alvo): Lista[] {
  return alvo.tipo === 'categorias' ? casa.categorias : casa.mercados[alvo.mercado]?.corredores ?? [];
}
/** Caminho da lista no documento da casa. */
export const caminhoDa = (alvo: Alvo): string => (alvo.tipo === 'categorias' ? 'categorias' : `mercados.${alvo.mercado}.corredores`);

export function achar(casa: Casa, alvo: Alvo, id: string | null): Lista | undefined {
  return id ? listaDe(casa, alvo).find(x => x.id === id) : undefined;
}

/* ---------- mercados ---------- */

export function listarMercados(casa: Casa): MercadoComId[] {
  return Object.entries(casa.mercados)
    .map(([id, m]) => ({ ...m, id }))
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt'));
}

/** O mercado lembrado neste aparelho, se ainda existir; senão o primeiro. */
export function mercadoEscolhido(casa: Casa, lembrado: string | null | undefined): MercadoComId | undefined {
  const todos = listarMercados(casa);
  return todos.find(m => m.id === lembrado) ?? todos[0];
}

/** Id do corredor que o produto tem no mercado (só se esse corredor ainda existe). */
export function corredorDe(casa: Casa, item: Pick<Item, 'cor'>, mercado: string): string | null {
  const id = item.cor[mercado];
  return id && casa.mercados[mercado]?.corredores.some(c => c.id === id) ? id : null;
}

/** "Qual corredor?": grava só aquele produto naquele mercado. `corredor` null = tirar. */
export function definirCorredor(casa: Casa, id: string, mercado: string, corredor: string | null): Escritas {
  if (!casa.itens[id] || !casa.mercados[mercado]) return {};
  if (corredor === null) return { [`itens.${id}.cor.${mercado}`]: APAGAR };
  return casa.mercados[mercado]!.corredores.some(c => c.id === corredor) ? { [`itens.${id}.cor.${mercado}`]: corredor } : {};
}

/** Texto do site: vazio ou https://… (até 100, sem espaço, sem aspas ou sinais de HTML). Senão null. */
export function limparSite(t: string): string | null {
  const v = String(t ?? '').trim();
  if (v === '') return '';
  if (v.length > LIMITES.site || !/^https:\/\/[^\s<>"'`]+$/i.test(v)) return null;
  return v;
}

/** Nome de mercado: sem "|" nem ":" (a resposta do Claude usa esses sinais para separar). */
const nomeMercado = (t: string): string => limparNome(String(t ?? '').replace(/[|:]/g, ' '));

export function criarMercado(
  casa: Casa, nome: string, site: string, copiarDe: string | null, id = novoId('m'),
): { id: string; escritas: Escritas } {
  const n = nomeMercado(nome), st = limparSite(site);
  if (!n || st === null || Object.keys(casa.mercados).length >= LIMITES.mercados) return { id, escritas: {} };
  const base = copiarDe ? casa.mercados[copiarDe] : undefined;
  const mapa: Record<string, string> = {};
  const corredores: Lista[] = base ? base.corredores.map(c => { const novo = novoId('c'); mapa[c.id] = novo; return { id: novo, nome: c.nome, ic: c.ic }; }) : [];
  const ordem = Object.values(casa.mercados).reduce((m, x) => Math.max(m, x.ordem), -1) + 1;
  const escritas: Escritas = { [`mercados.${id}`]: { nome: n, ic: '🏬', site: st, aprender: false, ordem, corredores } satisfies Mercado };
  if (copiarDe && base) {
    for (const [iid, i] of Object.entries(casa.itens)) {
      const cor = corredorDe(casa, i, copiarDe);
      if (cor && mapa[cor]) escritas[`itens.${iid}.cor.${id}`] = mapa[cor];
    }
  }
  return { id, escritas };
}

export function editarMercado(casa: Casa, id: string, nome: string, site: string): Escritas {
  const m = casa.mercados[id], n = nomeMercado(nome), st = limparSite(site);
  if (!m || !n || st === null) return {};
  const r: Escritas = {};
  if (n !== m.nome) r[`mercados.${id}.nome`] = n;
  if (st !== m.site) r[`mercados.${id}.site`] = st;
  return r;
}

/** Só se houver mais de um. A lista e os produtos não mudam (só o corredor daquele mercado some). */
export function apagarMercado(casa: Casa, id: string): Escritas {
  if (!casa.mercados[id] || Object.keys(casa.mercados).length < 2) return {};
  const r: Escritas = { [`mercados.${id}`]: APAGAR };
  for (const [iid, i] of Object.entries(casa.itens)) if (id in i.cor) r[`itens.${iid}.cor.${id}`] = APAGAR;
  return r;
}

export const definirAprender = (mercado: string, ligado: boolean): Escritas => ({ [`mercados.${mercado}.aprender`]: ligado });
export const definirCidade = (t: string): Escritas => ({ cidade: String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, LIMITES.cidade) });

/* ---------- textos com limite ---------- */

export const limparNome = (t: string): string => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, LIMITES.nome);
export const limparFigurinha = (t: string): string => String(t ?? '').trim().slice(0, LIMITES.figurinha);

/** Letra maiúscula no começo: "maizena" → "Maizena". */
export function capitalizar(t: string): string {
  const n = limparNome(t);
  return n.charAt(0).toUpperCase() + n.slice(1);
}

let contador = 0;
/** Id seguro para caminho do Firestore (só a-z e 0-9, sem ponto). */
export function novoId(prefixo: string, agora: number = Date.now(), aleatorio: () => number = Math.random): string {
  contador = (contador + 1) % 1296;
  return prefixo + agora.toString(36) + contador.toString(36) + Math.floor(aleatorio() * 1296).toString(36);
}

/* ---------- produtos ---------- */

export interface DadosProduto { nome: string; ic: string; cat: string | null; cor: Record<string, string> }

/** Só os corredores que existem naquele mercado. */
function corValida(casa: Casa, cor: Record<string, string>): Record<string, string> {
  const r: Record<string, string> = {};
  for (const [m, c] of Object.entries(cor ?? {})) if (casa.mercados[m]?.corredores.some(x => x.id === c)) r[m] = c;
  return r;
}

export function marcarFalta(casa: Casa, id: string, quem: string, por: string, agora: number): Escritas {
  if (!casa.itens[id]) return {};
  const p = `itens.${id}.`;
  return {
    [p + 'falta']: true, [p + 'quem']: limparNome(quem), [p + 'por']: por, [p + 'quando']: agora,
    [p + 'carrinho']: false, [p + 'pegouEm']: 0, [p + 'semEstoque']: false,
  };
}

export function tirarFalta(casa: Casa, id: string): Escritas {
  if (!casa.itens[id]) return {};
  const p = `itens.${id}.`;
  return { [p + 'falta']: false, [p + 'carrinho']: false, [p + 'pegouEm']: 0, [p + 'semEstoque']: false };
}

/** Um toque no botão de Em casa: falta ↔ tem em casa. */
export function alternarFalta(casa: Casa, id: string, quem: string, por: string, agora: number): Escritas {
  return casa.itens[id]?.falta ? tirarFalta(casa, id) : marcarFalta(casa, id, quem, por, agora);
}

/** Cria o produto (já "falta" se `naLista`). Devolve o id novo junto das escritas. */
export function criarProduto(
  casa: Casa, d: DadosProduto, naLista: boolean, quem: string, por: string, agora: number, id = novoId('n', agora),
): { id: string; escritas: Escritas } {
  const maior = Object.values(casa.itens).reduce((m, i) => Math.max(m, i.ordem), -1);
  const item: Item = {
    nome: capitalizar(d.nome) || 'Produto', ic: limparFigurinha(d.ic) || '🛒',
    cat: d.cat && achar(casa, { tipo: 'categorias' }, d.cat) ? d.cat : null,
    cor: corValida(casa, d.cor),
    falta: naLista, quem: naLista ? limparNome(quem) : '', por: naLista ? por : '', quando: naLista ? agora : 0,
    carrinho: false, pegouEm: 0, semEstoque: false, ordem: maior + 1,
  };
  return { id, escritas: { [`itens.${id}`]: item } };
}

/** Escreve só o que mudou no produto (o corredor, um mercado de cada vez). */
export function editarProduto(casa: Casa, id: string, d: DadosProduto): Escritas {
  const atual = casa.itens[id];
  if (!atual) return {};
  const nome = limparNome(d.nome) || atual.nome, ic = limparFigurinha(d.ic) || atual.ic;
  const cat = d.cat && achar(casa, { tipo: 'categorias' }, d.cat) ? d.cat : null;
  const r: Escritas = {};
  if (nome !== atual.nome) r[`itens.${id}.nome`] = nome;
  if (ic !== atual.ic) r[`itens.${id}.ic`] = ic;
  if (cat !== atual.cat) r[`itens.${id}.cat`] = cat;
  const cor = corValida(casa, d.cor);
  for (const m of new Set([...Object.keys(atual.cor), ...Object.keys(cor)])) {
    if (!casa.mercados[m]) continue;
    if (cor[m] !== atual.cor[m]) r[`itens.${id}.cor.${m}`] = cor[m] ?? APAGAR;
  }
  return r;
}

export function apagarProduto(casa: Casa, id: string): Escritas {
  return casa.itens[id] ? { [`itens.${id}`]: APAGAR } : {};
}

/* ---------- categorias e corredores ---------- */

export function criarLista(casa: Casa, alvo: Alvo, nome: string, ic: string, id = novoId('x')): { id: string; escritas: Escritas } {
  const lista = [...listaDe(casa, alvo), { id, nome: limparNome(nome) || 'Novo', ic: limparFigurinha(ic) || '🛒' }];
  const existe = alvo.tipo === 'categorias' || casa.mercados[alvo.mercado];
  return { id, escritas: lista.length > LIMITES.listas || !existe ? {} : { [caminhoDa(alvo)]: lista } };
}

export function renomearLista(casa: Casa, alvo: Alvo, id: string, nome: string): Escritas {
  const n = limparNome(nome);
  if (!n) return {};
  return { [caminhoDa(alvo)]: listaDe(casa, alvo).map(x => (x.id === id ? { ...x, nome: n } : x)) };
}

export function trocarFigurinhaLista(casa: Casa, alvo: Alvo, id: string, ic: string): Escritas {
  const e = limparFigurinha(ic);
  if (!e) return {};
  return { [caminhoDa(alvo)]: listaDe(casa, alvo).map(x => (x.id === id ? { ...x, ic: e } : x)) };
}

/** dir = -1 sobe, +1 desce. Regrava só aquela lista. */
export function moverLista(casa: Casa, alvo: Alvo, id: string, dir: -1 | 1): Escritas {
  const l = [...listaDe(casa, alvo)];
  const k = l.findIndex(x => x.id === id), j = k + dir;
  if (k < 0 || j < 0 || j >= l.length) return {};
  [l[k], l[j]] = [l[j]!, l[k]!];
  return { [caminhoDa(alvo)]: l };
}

/** Apaga a categoria/corredor. Os produtos dali ficam "sem" (nenhum produto some); no caso do corredor, só naquele mercado. Tudo numa gravação só. */
export function apagarLista(casa: Casa, alvo: Alvo, id: string): Escritas {
  const r: Escritas = { [caminhoDa(alvo)]: listaDe(casa, alvo).filter(x => x.id !== id) };
  for (const [iid, i] of Object.entries(casa.itens)) {
    if (alvo.tipo === 'categorias') { if (i.cat === id) r[`itens.${iid}.cat`] = null; }
    else if (i.cor[alvo.mercado] === id) r[`itens.${iid}.cor.${alvo.mercado}`] = APAGAR;
  }
  return r;
}

/* ---------- mercado ---------- */

/** Passou disso, o "Estou no mercado" de um aparelho esquecido não vale mais. */
const HORAS_NO_MERCADO = 8;

export function inicioDasCompras(casa: Casa, uid: string, agora: number): number | null {
  const t = casa.noMercado[uid]?.quando;
  return t && agora - t < HORAS_NO_MERCADO * 3_600_000 ? t : null;
}

/** Em que mercado a pessoa está comprando (só se ela está comprando). Compra de antes dos mercados: o primeiro. */
export function mercadoDasCompras(casa: Casa, uid: string, agora: number): MercadoComId | undefined {
  if (inicioDasCompras(casa, uid, agora) === null) return undefined;
  return mercadoEscolhido(casa, casa.noMercado[uid]?.mercado);
}

export function alguemNoMercado(casa: Casa, agora: number): boolean {
  return Object.keys(casa.noMercado).some(uid => inicioDasCompras(casa, uid, agora) !== null);
}

export const comecarCompras = (uid: string, agora: number, mercado: string): Escritas => ({ [`noMercado.${uid}`]: { quando: agora, mercado } satisfies NoMercado });

/** Um toque = no carrinho; outro toque desfaz. */
export function pegar(casa: Casa, id: string, agora: number): Escritas {
  const i = casa.itens[id];
  if (!i) return {};
  const p = `itens.${id}.`;
  return i.carrinho
    ? { [p + 'carrinho']: false, [p + 'pegouEm']: 0, [p + 'semEstoque']: false }
    : { [p + 'carrinho']: true, [p + 'pegouEm']: agora, [p + 'semEstoque']: false };
}

/** "Não tinha": o item continua na lista para a próxima compra. */
export function marcarSemEstoque(casa: Casa, id: string): Escritas {
  if (!casa.itens[id]) return {};
  const p = `itens.${id}.`;
  return { [p + 'semEstoque']: true, [p + 'carrinho']: false, [p + 'pegouEm']: 0 };
}

export function acharDeNovo(casa: Casa, id: string): Escritas {
  return casa.itens[id] ? { [`itens.${id}.semEstoque`]: false } : {};
}

/** Itens ainda por pegar, agrupados pelos corredores do mercado, na ordem dele; "Sem corredor" no fim. */
export interface GrupoMercado { corredor: Lista | null; numero: number | null; itens: ItemComId[] }
export function agruparMercado(casa: Casa, itens: ItemComId[], mercado: string): GrupoMercado[] {
  const corredores = casa.mercados[mercado]?.corredores ?? [];
  const grupos: GrupoMercado[] = corredores.map((c, k) => ({ corredor: c, numero: k + 1, itens: itens.filter(i => corredorDe(casa, i, mercado) === c.id) }));
  grupos.push({ corredor: null, numero: null, itens: itens.filter(i => !corredorDe(casa, i, mercado)) });
  return grupos.filter(g => g.itens.length > 0);
}

/** Item que o OUTRO marcou durante as minhas compras ("acabou de entrar · Ana"). */
export function acabouDeEntrar(i: Item, meuUid: string, inicio: number | null): boolean {
  return inicio !== null && i.falta && !i.carrinho && i.por !== meuUid && i.quando > inicio;
}

/**
 * "Aprender a ordem": os corredores de onde se pegou algo passam a seguir a ordem dos toques;
 * os outros ficam no lugar. Ex.: [A B C D E] e toques C, A → [C B A D E].
 */
export function aprenderOrdem(corredores: Lista[], picks: string[]): Lista[] {
  const validos = picks.filter(id => corredores.some(c => c.id === id));
  if (validos.length < 2) return corredores;
  const posicoes = corredores.map((c, k) => (validos.includes(c.id) ? k : -1)).filter(k => k >= 0);
  const nova = [...corredores];
  posicoes.forEach((pos, n) => { nova[pos] = corredores.find(c => c.id === validos[n])!; });
  return nova;
}

export interface ResumoCompras { pegos: ItemComId[]; semEstoque: ItemComId[]; restaram: ItemComId[]; ordemAprendida: string[] | null }

/** Terminar as compras: o que está no carrinho volta a "tem em casa". `mercado` = onde se comprou (a ordem aprendida é a dele). */
export function terminarCompras(casa: Casa, uid: string, mercado: string): { escritas: Escritas; resumo: ResumoCompras } {
  const lista = itensFaltando(casa);
  const pegos = lista.filter(i => i.carrinho).sort((a, b) => a.pegouEm - b.pegouEm);
  const semEstoque = lista.filter(i => i.semEstoque);
  const restaram = lista.filter(i => !i.carrinho && !i.semEstoque);
  const escritas: Escritas = { [`noMercado.${uid}`]: APAGAR };
  for (const i of pegos) {
    const p = `itens.${i.id}.`;
    Object.assign(escritas, { [p + 'falta']: false, [p + 'carrinho']: false, [p + 'pegouEm']: 0 });
  }
  for (const i of semEstoque) escritas[`itens.${i.id}.semEstoque`] = false;

  let ordemAprendida: string[] | null = null;
  const m = casa.mercados[mercado];
  if (m?.aprender) {
    const picks: string[] = [];
    for (const i of pegos) { const c = corredorDe(casa, i, mercado); if (c && !picks.includes(c)) picks.push(c); }
    const nova = aprenderOrdem(m.corredores, picks);
    if (nova.map(c => c.id).join() !== m.corredores.map(c => c.id).join()) {
      escritas[`mercados.${mercado}.corredores`] = nova;
      ordemAprendida = picks.map(id => m.corredores.find(c => c.id === id)!.nome);
    }
  }
  return { escritas, resumo: { pegos, semEstoque, restaram, ordemAprendida } };
}

/* ---------- pessoas ---------- */

export const normalizarEmail = (e: string): string => String(e ?? '').trim().toLowerCase();
export const emailValido = (e: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= LIMITES.email;

/** Letras e números do código de convite, sem os que se confundem (0/O, 1/I/L). 31 símbolos. */
export const ALFABETO_CONVITE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const TAMANHO_CONVITE = 10;

/** Código de convite aleatório (10 símbolos ≈ 8 × 10^14 possibilidades). `bytes` vem do crypto do navegador. */
export function gerarCodigoConvite(bytes: (n: number) => Uint8Array = n => crypto.getRandomValues(new Uint8Array(n))): string {
  let c = '';
  while (c.length < TAMANHO_CONVITE) {
    for (const b of bytes(16)) {
      if (b < 248 && c.length < TAMANHO_CONVITE) c += ALFABETO_CONVITE[b % 31]; // 248 = 31×8: sem favorecer nenhuma letra
    }
  }
  return c;
}

/** O que a pessoa digitou ("k7m2-9qxp 4a") vira o código; texto que não é um código → null. */
export function normalizarCodigo(texto: string): string | null {
  const c = String(texto ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === TAMANHO_CONVITE && [...c].every(ch => ALFABETO_CONVITE.includes(ch)) ? c : null;
}

/** "K7M2P-9QXRT" (mais fácil de ler e de ditar). */
export const mostrarCodigo = (c: string): string => `${c.slice(0, 5)}-${c.slice(5)}`;

export const registrarNome = (casa: Casa, uid: string, nome: string): Escritas => {
  const n = limparNome(nome);
  return n && casa.nomes[uid] !== n ? { [`nomes.${uid}`]: n } : {};
};

/* ---------- casa nova e leitura segura da nuvem ---------- */

/** A casa de partida: o catálogo real, com tudo "tem em casa" e o mercado Shibata. */
export function casaInicial(email: string, uid: string, nome: string): Casa {
  const itens: Record<string, Item> = {};
  ITENS_INICIAIS.forEach(([id, n, ic, cat, cor], ordem) => {
    itens[id] = { nome: n, ic, cat, cor: { [ID_SHIBATA]: cor }, falta: false, quem: '', por: '', quando: 0, carrinho: false, pegouEm: 0, semEstoque: false, ordem };
  });
  return {
    membros: [normalizarEmail(email)],
    mercados: { [ID_SHIBATA]: { nome: 'Shibata', ic: '🏪', site: SITE_SHIBATA, aprender: false, ordem: 0, corredores: CORREDORES_INICIAIS.map(([id, n, ic]) => ({ id, nome: n, ic })) } },
    categorias: CATEGORIAS_INICIAIS.map(([id, n, ic]) => ({ id, nome: n, ic })),
    itens, noMercado: {}, nomes: nome ? { [uid]: limparNome(nome) } : {}, cidade: '',
  };
}

const txt = (v: unknown, max: number, padrao = ''): string => (typeof v === 'string' ? v.slice(0, max) : padrao);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const idOuNulo = (v: unknown): string | null => (typeof v === 'string' && v ? v.slice(0, 40) : null);
/** Só letras e números: serve de chave de mapa e de caminho do Firestore (sem ponto, sem "__proto__"). */
const idSeguro = (v: string): boolean => /^[A-Za-z0-9]{1,128}$/.test(v);
const objeto = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function lerListas(v: unknown): Lista[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(x => typeof x === 'object' && x !== null && typeof (x as Lista).id === 'string' && idSeguro((x as Lista).id) && typeof (x as Lista).nome === 'string')
    .slice(0, LIMITES.listas)
    .map(x => ({ id: txt((x as Lista).id, 40), nome: txt((x as Lista).nome, LIMITES.nome), ic: txt((x as Lista).ic, LIMITES.figurinha, '🛒') }));
}

function lerMercado(m: Record<string, unknown>, ordemPadrao: number): Mercado {
  return {
    nome: txt(m.nome, LIMITES.nome, 'Mercado'), ic: txt(m.ic, LIMITES.figurinha, '🏬'),
    site: limparSite(txt(m.site, LIMITES.site)) ?? '', aprender: m.aprender === true,
    ordem: typeof m.ordem === 'number' && Number.isFinite(m.ordem) ? m.ordem : ordemPadrao, corredores: lerListas(m.corredores),
  };
}

/** Já passou pela rodada 3 (tem o campo `mercados`)? Senão o documento ainda está no formato de antes. */
export const jaTemMercados = (dados: unknown): boolean => 'mercados' in objeto(dados);

/**
 * A "migração": o documento de antes (corredores + aprender no topo, `cor` de cada produto em texto) vira o 1º mercado,
 * "Shibata". SÓ escritas determinísticas (todo aparelho que migrar grava o mesmo), numa gravação só.
 * Devolve null se o documento já está no formato novo. Quem chama só deve migrar a partir de uma leitura confirmada
 * pelo servidor (nunca de cache): uma cópia velha não pode apagar o que o outro celular já fez.
 */
export function migracao(dados: unknown): Escritas | null {
  if (jaTemMercados(dados)) return null;
  const d = objeto(dados);
  const r: Escritas = {
    [`mercados.${ID_SHIBATA}`]: { nome: 'Shibata', ic: '🏪', site: SITE_SHIBATA, aprender: d.aprender === true, ordem: 0, corredores: lerListas(d.corredores) } satisfies Mercado,
    corredores: APAGAR, aprender: APAGAR,
  };
  if (typeof d.cidade !== 'string') r.cidade = CIDADE_PADRAO;
  for (const [id, bruto] of Object.entries(objeto(d.itens))) {
    const cor = objeto(bruto).cor;
    if (idSeguro(id) && typeof cor === 'string' && cor) r[`itens.${id}.cor`] = { [ID_SHIBATA]: cor.slice(0, 40) };
  }
  return r;
}

/**
 * Tudo que chega da nuvem passa por aqui: formato conferido, tamanhos cortados, produtos "pela metade"
 * (sem nome) descartados. Assim a tela nunca recebe lixo. Aceita os DOIS formatos (o de antes e o dos mercados):
 * no de antes, os corredores viram o mercado Shibata só na memória, até a migração gravar.
 */
export function lerCasa(dados: unknown): Casa {
  const d = objeto(dados);
  const antigo = !jaTemMercados(d);
  const mercados: Record<string, Mercado> = {};
  if (antigo) {
    mercados[ID_SHIBATA] = lerMercado({ nome: 'Shibata', ic: '🏪', site: SITE_SHIBATA, aprender: d.aprender === true, corredores: d.corredores }, 0);
  } else {
    let k = 0;
    for (const [id, m] of Object.entries(objeto(d.mercados))) {
      if (idSeguro(id) && Object.keys(mercados).length < LIMITES.mercados) mercados[id] = lerMercado(objeto(m), k++);
    }
  }
  const itens: Record<string, Item> = {};
  for (const [id, bruto] of Object.entries(objeto(d.itens))) {
    const i = objeto(bruto);
    if (!idSeguro(id) || typeof i.nome !== 'string' || !i.nome) continue;
    const cor: Record<string, string> = {};
    if (typeof i.cor === 'string') { if (i.cor && mercados[ID_SHIBATA]) cor[ID_SHIBATA] = i.cor.slice(0, 40); } // formato de antes (ou de um aparelho velho)
    else for (const [m, c] of Object.entries(objeto(i.cor))) if (idSeguro(m) && mercados[m] && typeof c === 'string' && c) cor[m] = c.slice(0, 40);
    itens[id] = {
      nome: txt(i.nome, LIMITES.nome), ic: txt(i.ic, LIMITES.figurinha, '🛒'), cat: idOuNulo(i.cat), cor,
      falta: i.falta === true, quem: txt(i.quem, LIMITES.nome), por: txt(i.por, 128), quando: num(i.quando),
      carrinho: i.carrinho === true, pegouEm: num(i.pegouEm), semEstoque: i.semEstoque === true, ordem: num(i.ordem),
    };
  }
  const noMercado: Record<string, NoMercado> = {};
  for (const [uid, t] of Object.entries(objeto(d.noMercado))) {
    if (!idSeguro(uid)) continue;
    // formato de antes: só a hora. Agora: { quando, mercado }
    const quando = typeof t === 'number' ? num(t) : num(objeto(t).quando);
    if (quando) noMercado[uid] = { quando, mercado: typeof t === 'number' ? '' : txt(objeto(t).mercado, 40) };
  }
  const nomes: Record<string, string> = {};
  for (const [uid, n] of Object.entries(objeto(d.nomes))) if (idSeguro(uid) && typeof n === 'string') nomes[uid] = n.slice(0, LIMITES.nome);
  return {
    membros: Array.isArray(d.membros) ? d.membros.filter((m): m is string => typeof m === 'string').map(m => m.slice(0, LIMITES.email)).slice(0, LIMITES.membros) : [],
    mercados, categorias: lerListas(d.categorias),
    itens, noMercado, nomes, cidade: txt(d.cidade, LIMITES.cidade),
  };
}

/** Primeiro nome para mostrar quando a conta não tem nome: "ana.silva@x.com" → "Ana.silva". */
export function nomeDoEmail(email: string): string {
  const antes = String(email ?? '').split('@')[0] ?? '';
  return antes ? antes.charAt(0).toUpperCase() + antes.slice(1, LIMITES.nome) : 'Eu';
}

export { semAcento };
