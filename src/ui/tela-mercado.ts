/** Aba "Mercado": o que falta, na ordem dos corredores do mercado escolhido. Os preços só põem uma etiqueta: nunca mudam a ordem nem os grupos. */
import {
  acabouDeEntrar, agruparMercado, comecarCompras, corredorDe, inicioDasCompras, itensFaltando, listarMercados, mercadoDasCompras, mercadoEscolhido, terminarCompras,
} from '../motor/casa.ts';
import { comparar, etiqueta, reais } from '../motor/precos.ts';
import type { ItemComId, MercadoComId } from '../motor/tipos.ts';
import { casa, fazer, mercadoAtual, meuUid, render, S } from './estado.ts';
import { resumoSheet } from './folhas.ts';
import { escapar as e } from './seguranca.ts';

const $ = (id: string) => document.getElementById(id)!;

export const comprando = (): boolean => inicioDasCompras(casa(), meuUid(), Date.now()) !== null;

type Modo = 'prev' | 'pick' | 'carrinho' | 'sem';

const txtPreco = (p: { centavos: number; emb: string }): string => `${reais(p.centavos)}${p.emb ? ` (${e(p.emb)})` : ''}`;

/** A etiqueta de preço embaixo do nome: "R$ x (emb) aqui · mais barato" (verde) ou "mais barato no <outro>: R$ y" (âmbar). */
function etiquetaPreco(i: ItemComId, m: MercadoComId, agora: number): string {
  const c = casa();
  const t = etiqueta(comparar(S.precos, i.id, Object.keys(c.mercados), agora), m.id, agora);
  if (!t) return '';
  if (t.tipo === 'melhor') return `<small class="preco">${txtPreco(t.aqui)} aqui · mais barato</small>`;
  if (t.tipo === 'aqui') return `<small class="preco">${txtPreco(t.aqui)} aqui</small>`;
  return `<small class="preco outro">mais barato no ${e(c.mercados[t.outroMerc]?.nome ?? '')}: ${txtPreco(t.outro)}</small>`;
}

function linha(i: ItemComId, modo: Modo, inicio: number | null, m: MercadoComId, agora: number): string {
  const id = e(i.id), ic = e(i.ic), nome = e(i.nome);
  const preco = etiquetaPreco(i, m, agora);
  if (modo === 'prev') return `<div class="linha prev"><span class="ck"></span><span class="e">${ic}</span><span class="tx"><b>${nome}</b>${preco}</span></div>`;
  // no carrinho NÃO pode ser <button>: tem um botão R$ dentro (botão dentro de botão não existe)
  if (modo === 'carrinho') return `<div class="linha no-carrinho" data-pick="${id}" role="button" tabindex="0"><span class="ck">✓</span><span class="e">${ic}</span><span class="tx"><b>${nome}</b><small>toque para desfazer</small></span><button class="qual" data-anotar="${id}" aria-label="Anotar o preço de ${nome}">R$</button></div>`;
  if (modo === 'sem') return `<button class="linha sem" data-volta="${id}"><span class="ck"></span><span class="e">${ic}</span><span class="tx"><b>${nome}</b><small>fica para a próxima · toque se achou</small></span></button>`;
  const novo = acabouDeEntrar(i, meuUid(), inicio);
  const chegou = S.recem.has(i.id);
  const qual = corredorDe(casa(), i, m.id) ? '' : `<button class="qual" data-qual="${id}">qual corredor?</button>`;
  return `<div class="linha pick ${chegou ? 'chegou' : ''}" data-pick="${id}" role="button" tabindex="0"><span class="ck"></span><span class="e">${ic}</span><span class="tx"><b>${nome}</b>${novo ? `<small class="recado">acabou de entrar · ${e(i.quem)}</small>` : preco}</span>${qual}<button class="nt" data-nt="${id}">não tinha</button></div>`;
}

/** Quem mais está no mercado agora e onde ("Ana está no Sam's Club"). */
function quemEstaNoMercado(agora: number): string {
  const c = casa();
  for (const uid of Object.keys(c.noMercado)) {
    if (uid === meuUid() || inicioDasCompras(c, uid, agora) === null) continue;
    const m = mercadoDasCompras(c, uid, agora);
    return `${c.nomes[uid] || 'Alguém'} está ${m ? `no ${m.nome}` : 'no mercado'} agora`;
  }
  return '';
}

/** "A Ana" / "A outra pessoa" (quem vê que estou no mercado). */
function oOutro(): string {
  const nomes = Object.entries(casa().nomes).filter(([uid]) => uid !== meuUid()).map(([, n]) => n).filter(Boolean);
  return nomes.length === 1 ? `A ${nomes[0]}` : nomes.length > 1 ? 'As outras pessoas' : 'A outra pessoa';
}

export function telaMercado(): void {
  const c = casa(), agora = Date.now();
  const conteudo = $('conteudo');
  conteudo.dataset.aba = 'mercado';
  const m = mercadoAtual();
  if (!m) {
    conteudo.innerHTML = '<p class="vazio">Ainda não tem nenhum mercado. Crie um em Organizar.</p>';
    $('fixo').innerHTML = '';
    return;
  }
  const lista = itensFaltando(c);
  const inicio = inicioDasCompras(c, meuUid(), agora);
  const indo = inicio !== null;
  const pend = lista.filter(i => !i.carrinho && !i.semEstoque);
  const grupos = agruparMercado(c, pend, m.id);
  const baratosFora = pend.filter(i => etiqueta(comparar(S.precos, i.id, Object.keys(c.mercados), agora), m.id, agora)?.tipo === 'outro').length;
  const outro = quemEstaNoMercado(agora);
  let h = '';
  if (!indo) {
    $('subtitulo').textContent = `Na ordem do ${m.nome}`;
    const todos = listarMercados(c);
    const chips = todos.length > 1
      ? `<div class="mercs" role="group" aria-label="Qual mercado">${todos.map(x => `<button class="merc ${x.id === m.id ? 'on' : ''}" data-merc="${e(x.id)}">${e(x.ic)} ${e(x.nome)}</button>`).join('')}</div>` : '';
    if (!lista.length) {
      h += `<div class="resumo">${chips}<div class="grande">Nada na lista</div><span>Quando algo acabar, toque no produto em “Em casa”.</span></div>`;
    } else {
      const corredores = grupos.filter(g => g.corredor).length;
      h += `<div class="resumo">${chips}<div class="grande">${lista.length} ${lista.length === 1 ? 'item' : 'itens'} em ${corredores} ${corredores === 1 ? 'corredor' : 'corredores'}</div>`
        + (baratosFora ? `<div class="onde">🏷️ ${baratosFora} ${baratosFora === 1 ? 'item está mais barato' : 'itens estão mais baratos'} em outro mercado</div>` : '')
        + (outro ? `<div class="aovivo"><i></i>${e(outro)}</div>` : '')
        + `<button id="comecar">Estou no ${e(m.nome)}</button></div>`;
    }
  } else {
    const feitos = lista.filter(i => i.carrinho).length;
    $('subtitulo').textContent = `${m.ic} ${m.nome} · ${feitos} de ${lista.length} no carrinho`;
    h += `<div class="aovivo"><i></i>${e(oOutro())} vê que você está no ${e(m.nome)}</div><div class="barra"><i style="width:${lista.length ? (feitos / lista.length) * 100 : 0}%"></i></div>`;
  }
  for (const g of grupos) {
    const titulo = g.corredor
      ? `<span class="num">${g.numero}</span><span><small>Corredor ${g.numero}</small>${e(g.corredor.ic)} ${e(g.corredor.nome)}</span>`
      : `<span class="num">?</span><span>Sem corredor no ${e(m.nome)}</span>`;
    h += `<div class="secao"><h3>${titulo}</h3><div class="linhas">${g.itens.map(i => linha(i, indo ? 'pick' : 'prev', inicio, m, agora)).join('')}</div></div>`;
  }
  if (indo) {
    const car = lista.filter(i => i.carrinho), sem = lista.filter(i => i.semEstoque);
    if (!pend.length) h += '<p class="explica" style="text-align:center">Tudo pego! Toque em Terminar compras.</p>';
    if (car.length) h += `<div><div class="rotulo-grupo">No carrinho (${car.length}) · toque em R$ para anotar o preço</div><div class="linhas">${car.map(i => linha(i, 'carrinho', inicio, m, agora)).join('')}</div></div>`;
    if (sem.length) h += `<div><div class="rotulo-grupo">Não tinha (${sem.length})</div><div class="linhas">${sem.map(i => linha(i, 'sem', inicio, m, agora)).join('')}</div></div>`;
    $('fixo').innerHTML = '<button id="terminar">Terminar compras</button>';
  } else {
    if (lista.length) h += '<button class="novo" data-tab="precos">🏷️ Comparar os preços da lista</button>';
    $('fixo').innerHTML = '';
  }
  conteudo.innerHTML = h;
}

export function comecar(): void {
  const m = mercadoAtual();
  if (!m) return;
  fazer(comecarCompras(meuUid(), Date.now(), m.id), `${oOutro()} vê que você está no ${m.nome}`);
}

export function terminar(): void {
  const m = mercadoDasCompras(casa(), meuUid(), Date.now()) ?? mercadoEscolhido(casa(), S.mercadoSel);
  if (!m) return;
  const { escritas, resumo } = terminarCompras(casa(), meuUid(), m.id);
  fazer(escritas);
  resumoSheet(resumo, m.nome, () => { S.aba = 'casa'; render(); });
}
