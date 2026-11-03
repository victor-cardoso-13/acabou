/** Aba "Mercado": o que falta, na ordem dos corredores. */
import {
  acabouDeEntrar, agruparMercado, alguemNoMercado, comecarCompras, inicioDasCompras, itensFaltando, terminarCompras,
} from '../motor/casa.ts';
import type { ItemComId } from '../motor/tipos.ts';
import { casa, fazer, meuUid, render, S } from './estado.ts';
import { resumoSheet } from './folhas.ts';
import { escapar as e } from './seguranca.ts';

const $ = (id: string) => document.getElementById(id)!;

export const comprando = (): boolean => inicioDasCompras(casa(), meuUid(), Date.now()) !== null;

type Modo = 'prev' | 'pick' | 'carrinho' | 'sem';
function linha(i: ItemComId, modo: Modo, inicio: number | null): string {
  const id = e(i.id), ic = e(i.ic), nome = e(i.nome);
  if (modo === 'prev') return `<div class="linha prev"><span class="ck"></span><span class="e">${ic}</span><span class="tx"><b>${nome}</b></span></div>`;
  if (modo === 'carrinho') return `<button class="linha no-carrinho" data-pick="${id}"><span class="ck">✓</span><span class="e">${ic}</span><span class="tx"><b>${nome}</b><small>toque para desfazer</small></span></button>`;
  if (modo === 'sem') return `<button class="linha sem" data-volta="${id}"><span class="ck"></span><span class="e">${ic}</span><span class="tx"><b>${nome}</b><small>fica para a próxima · toque se achou</small></span></button>`;
  const novo = acabouDeEntrar(i, meuUid(), inicio);
  const chegou = S.recem.has(i.id);
  return `<div class="linha pick ${chegou ? 'chegou' : ''}" data-pick="${id}" role="button" tabindex="0"><span class="ck"></span><span class="e">${ic}</span><span class="tx"><b>${nome}</b>${novo ? `<small class="recado">acabou de entrar · ${e(i.quem)}</small>` : ''}</span><button class="nt" data-nt="${id}">não tinha</button></div>`;
}

export function telaMercado(): void {
  const c = casa(), agora = Date.now();
  const conteudo = $('conteudo');
  conteudo.dataset.aba = 'mercado';
  const lista = itensFaltando(c);
  const inicio = inicioDasCompras(c, meuUid(), agora);
  const indo = inicio !== null;
  const pend = lista.filter(i => !i.carrinho && !i.semEstoque);
  const grupos = agruparMercado(c, pend);
  const outro = !indo && alguemNoMercado(c, agora);
  let h = '';
  if (!indo) {
    $('subtitulo').textContent = 'Na ordem dos corredores';
    if (!lista.length) {
      h += '<div class="resumo"><div class="grande">Nada na lista</div><span>Quando algo acabar, toque no produto em “Em casa”.</span></div>';
    } else {
      h += `<div class="resumo"><div class="grande">${lista.length} ${lista.length === 1 ? 'item' : 'itens'} em ${grupos.length} ${grupos.length === 1 ? 'corredor' : 'corredores'}</div>${outro ? '<div class="aovivo"><i></i>Tem alguém no mercado agora</div>' : ''}<button id="comecar">Estou no mercado</button></div>`;
    }
  } else {
    const feitos = lista.filter(i => i.carrinho).length;
    $('subtitulo').textContent = `${feitos} de ${lista.length} no carrinho`;
    h += `<div class="aovivo"><i></i>A outra pessoa vê na hora o que você pega</div><div class="barra"><i style="width:${lista.length ? (feitos / lista.length) * 100 : 0}%"></i></div>`;
  }
  for (const g of grupos) {
    const titulo = g.corredor
      ? `<span class="num">${g.numero}</span><span><small>Corredor ${g.numero}</small>${e(g.corredor.ic)} ${e(g.corredor.nome)}</span>`
      : '<span class="num">?</span><span>Sem corredor</span>';
    h += `<div class="secao"><h3>${titulo}</h3><div class="linhas">${g.itens.map(i => linha(i, indo ? 'pick' : 'prev', inicio)).join('')}</div></div>`;
  }
  if (indo) {
    const car = lista.filter(i => i.carrinho), sem = lista.filter(i => i.semEstoque);
    if (!pend.length) h += '<p class="explica" style="text-align:center">Tudo pego! Toque em Terminar compras.</p>';
    if (car.length) h += `<div><div class="rotulo-grupo">No carrinho (${car.length})</div><div class="linhas">${car.map(i => linha(i, 'carrinho', inicio)).join('')}</div></div>`;
    if (sem.length) h += `<div><div class="rotulo-grupo">Não tinha (${sem.length})</div><div class="linhas">${sem.map(i => linha(i, 'sem', inicio)).join('')}</div></div>`;
    $('fixo').innerHTML = '<button id="terminar">Terminar compras</button>';
  } else $('fixo').innerHTML = '';
  conteudo.innerHTML = h;
}

export function comecar(): void {
  fazer(comecarCompras(meuUid(), Date.now()), "A outra pessoa vê que você está no mercado");
}

export function terminar(): void {
  const { escritas, resumo } = terminarCompras(casa(), meuUid());
  fazer(escritas);
  resumoSheet(resumo, () => { S.aba = 'casa'; render(); });
}
