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
  type Casa, type Escritas, type Item, type ItemComId, type Lista, type TipoLista,
} from './tipos.ts';

/* ---------- aplicar e desfazer ---------- */

/** Aplica as escritas numa cópia da casa (a original não muda). */
export function aplicar(casa: Casa, escritas: Escritas): Casa {
  const nova = structuredClone(casa) as unknown as Record<string, unknown>;
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
  return nova as unknown as Casa;
}

function ler(casa: Casa, caminho: string): unknown {
  let atual: unknown = casa;
  for (const p of caminho.split('.')) {
    if (typeof atual !== 'object' || atual === null || !(p in atual)) return APAGAR;
    atual = (atual as Record<string, unknown>)[p];
  }
  return structuredClone(atual);
}

/** As escritas que desfazem `escritas` (valem para a casa ANTES de aplicar). */
export function inverso(casa: Casa, escritas: Escritas): Escritas {
  const r: Escritas = {};
  for (const caminho of Object.keys(escritas)) r[caminho] = ler(casa, caminho);
  return r;
}

/* ---------- ler a casa ---------- */

export function listarItens(casa: Casa): ItemComId[] {
  return Object.entries(casa.itens)
    .map(([id, i]) => ({ ...i, id }))
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt'));
}

export const itensFaltando = (casa: Casa): ItemComId[] => listarItens(casa).filter(i => i.falta);

export function achar(casa: Casa, tipo: TipoLista, id: string | null): Lista | undefined {
  return id ? casa[tipo].find(x => x.id === id) : undefined;
}

const campoDe = (tipo: TipoLista): 'cat' | 'cor' => (tipo === 'corredores' ? 'cor' : 'cat');

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

export interface DadosProduto { nome: string; ic: string; cat: string | null; cor: string | null }

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
    cat: d.cat && achar(casa, 'categorias', d.cat) ? d.cat : null,
    cor: d.cor && achar(casa, 'corredores', d.cor) ? d.cor : null,
    falta: naLista, quem: naLista ? limparNome(quem) : '', por: naLista ? por : '', quando: naLista ? agora : 0,
    carrinho: false, pegouEm: 0, semEstoque: false, ordem: maior + 1,
  };
  return { id, escritas: { [`itens.${id}`]: item } };
}

/** Escreve só o que mudou no produto. */
export function editarProduto(casa: Casa, id: string, d: DadosProduto): Escritas {
  const atual = casa.itens[id];
  if (!atual) return {};
  const novo: DadosProduto = {
    nome: limparNome(d.nome) || atual.nome, ic: limparFigurinha(d.ic) || atual.ic,
    cat: d.cat && achar(casa, 'categorias', d.cat) ? d.cat : null,
    cor: d.cor && achar(casa, 'corredores', d.cor) ? d.cor : null,
  };
  const r: Escritas = {};
  for (const k of ['nome', 'ic', 'cat', 'cor'] as const) if (novo[k] !== atual[k]) r[`itens.${id}.${k}`] = novo[k];
  return r;
}

export function apagarProduto(casa: Casa, id: string): Escritas {
  return casa.itens[id] ? { [`itens.${id}`]: APAGAR } : {};
}

/* ---------- categorias e corredores ---------- */

export function criarLista(casa: Casa, tipo: TipoLista, nome: string, ic: string, id = novoId('x')): { id: string; escritas: Escritas } {
  const lista = [...casa[tipo], { id, nome: limparNome(nome) || 'Novo', ic: limparFigurinha(ic) || '🛒' }];
  return { id, escritas: lista.length > LIMITES.listas ? {} : { [tipo]: lista } };
}

export function renomearLista(casa: Casa, tipo: TipoLista, id: string, nome: string): Escritas {
  const n = limparNome(nome);
  if (!n) return {};
  return { [tipo]: casa[tipo].map(x => (x.id === id ? { ...x, nome: n } : x)) };
}

export function trocarFigurinhaLista(casa: Casa, tipo: TipoLista, id: string, ic: string): Escritas {
  const e = limparFigurinha(ic);
  if (!e) return {};
  return { [tipo]: casa[tipo].map(x => (x.id === id ? { ...x, ic: e } : x)) };
}

/** dir = -1 sobe, +1 desce. Regrava só aquela lista. */
export function moverLista(casa: Casa, tipo: TipoLista, id: string, dir: -1 | 1): Escritas {
  const l = [...casa[tipo]];
  const k = l.findIndex(x => x.id === id), j = k + dir;
  if (k < 0 || j < 0 || j >= l.length) return {};
  [l[k], l[j]] = [l[j]!, l[k]!];
  return { [tipo]: l };
}

/** Apaga a categoria/corredor. Os produtos dali ficam "sem" (nenhum produto some). Tudo numa gravação só. */
export function apagarLista(casa: Casa, tipo: TipoLista, id: string): Escritas {
  const campo = campoDe(tipo);
  const r: Escritas = { [tipo]: casa[tipo].filter(x => x.id !== id) };
  for (const [iid, i] of Object.entries(casa.itens)) if (i[campo] === id) r[`itens.${iid}.${campo}`] = null;
  return r;
}

/* ---------- mercado ---------- */

/** Passou disso, o "Estou no mercado" de um aparelho esquecido não vale mais. */
const HORAS_NO_MERCADO = 8;

export function inicioDasCompras(casa: Casa, uid: string, agora: number): number | null {
  const t = casa.noMercado[uid];
  return t && agora - t < HORAS_NO_MERCADO * 3_600_000 ? t : null;
}

export function alguemNoMercado(casa: Casa, agora: number): boolean {
  return Object.keys(casa.noMercado).some(uid => inicioDasCompras(casa, uid, agora) !== null);
}

export const comecarCompras = (uid: string, agora: number): Escritas => ({ [`noMercado.${uid}`]: agora });

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

/** Itens ainda por pegar, agrupados pelos corredores na ordem definida; "Sem corredor" no fim. */
export interface GrupoMercado { corredor: Lista | null; numero: number | null; itens: ItemComId[] }
export function agruparMercado(casa: Casa, itens: ItemComId[]): GrupoMercado[] {
  const grupos: GrupoMercado[] = casa.corredores.map((c, k) => ({ corredor: c, numero: k + 1, itens: itens.filter(i => i.cor === c.id) }));
  grupos.push({ corredor: null, numero: null, itens: itens.filter(i => !i.cor || !achar(casa, 'corredores', i.cor)) });
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

/** Terminar as compras: o que está no carrinho volta a "tem em casa". */
export function terminarCompras(casa: Casa, uid: string): { escritas: Escritas; resumo: ResumoCompras } {
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
  if (casa.aprender) {
    const picks: string[] = [];
    for (const i of pegos) if (i.cor && !picks.includes(i.cor)) picks.push(i.cor);
    const nova = aprenderOrdem(casa.corredores, picks);
    if (nova.map(c => c.id).join() !== casa.corredores.map(c => c.id).join()) {
      escritas.corredores = nova;
      ordemAprendida = picks.filter(id => achar(casa, 'corredores', id)).map(id => achar(casa, 'corredores', id)!.nome);
    }
  }
  return { escritas, resumo: { pegos, semEstoque, restaram, ordemAprendida } };
}

export const definirAprender = (ligado: boolean): Escritas => ({ aprender: ligado });

/* ---------- pessoas ---------- */

export const normalizarEmail = (e: string): string => String(e ?? '').trim().toLowerCase();
export const emailValido = (e: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= LIMITES.email;

export type ErroMembro = 'invalido' | 'repetido' | 'cheia';
export function adicionarMembro(casa: Casa, email: string): { escritas: Escritas } | { erro: ErroMembro } {
  const e = normalizarEmail(email);
  if (!emailValido(e)) return { erro: 'invalido' };
  if (casa.membros.includes(e)) return { erro: 'repetido' };
  if (casa.membros.length >= LIMITES.membros) return { erro: 'cheia' };
  return { escritas: { membros: [...casa.membros, e] } };
}

export const registrarNome = (casa: Casa, uid: string, nome: string): Escritas => {
  const n = limparNome(nome);
  return n && casa.nomes[uid] !== n ? { [`nomes.${uid}`]: n } : {};
};

/* ---------- casa nova e leitura segura da nuvem ---------- */

/** A casa de partida: o catálogo real, com tudo "tem em casa". */
export function casaInicial(email: string, uid: string, nome: string): Casa {
  const itens: Record<string, Item> = {};
  ITENS_INICIAIS.forEach(([id, n, ic, cat, cor], ordem) => {
    itens[id] = { nome: n, ic, cat, cor, falta: false, quem: '', por: '', quando: 0, carrinho: false, pegouEm: 0, semEstoque: false, ordem };
  });
  return {
    membros: [normalizarEmail(email)],
    corredores: CORREDORES_INICIAIS.map(([id, n, ic]) => ({ id, nome: n, ic })),
    categorias: CATEGORIAS_INICIAIS.map(([id, n, ic]) => ({ id, nome: n, ic })),
    itens, noMercado: {}, nomes: nome ? { [uid]: limparNome(nome) } : {}, aprender: false,
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

/**
 * Tudo que chega da nuvem passa por aqui: formato conferido, tamanhos cortados, produtos "pela metade"
 * (sem nome) descartados. Assim a tela nunca recebe lixo.
 */
export function lerCasa(dados: unknown): Casa {
  const d = objeto(dados);
  const itens: Record<string, Item> = {};
  for (const [id, bruto] of Object.entries(objeto(d.itens))) {
    const i = objeto(bruto);
    if (!idSeguro(id) || typeof i.nome !== 'string' || !i.nome) continue;
    itens[id] = {
      nome: txt(i.nome, LIMITES.nome), ic: txt(i.ic, LIMITES.figurinha, '🛒'), cat: idOuNulo(i.cat), cor: idOuNulo(i.cor),
      falta: i.falta === true, quem: txt(i.quem, LIMITES.nome), por: txt(i.por, 128), quando: num(i.quando),
      carrinho: i.carrinho === true, pegouEm: num(i.pegouEm), semEstoque: i.semEstoque === true, ordem: num(i.ordem),
    };
  }
  const noMercado: Record<string, number> = {};
  for (const [uid, t] of Object.entries(objeto(d.noMercado))) if (idSeguro(uid) && num(t)) noMercado[uid] = num(t);
  const nomes: Record<string, string> = {};
  for (const [uid, n] of Object.entries(objeto(d.nomes))) if (idSeguro(uid) && typeof n === 'string') nomes[uid] = n.slice(0, LIMITES.nome);
  return {
    membros: Array.isArray(d.membros) ? d.membros.filter((m): m is string => typeof m === 'string').map(m => m.slice(0, LIMITES.email)).slice(0, LIMITES.membros) : [],
    corredores: lerListas(d.corredores), categorias: lerListas(d.categorias),
    itens, noMercado, nomes, aprender: d.aprender === true,
  };
}

/** Primeiro nome para mostrar quando a conta não tem nome: "ana.silva@x.com" → "Ana.silva". */
export function nomeDoEmail(email: string): string {
  const antes = String(email ?? '').split('@')[0] ?? '';
  return antes ? antes.charAt(0).toUpperCase() + antes.slice(1, LIMITES.nome) : 'Eu';
}

export { semAcento };
