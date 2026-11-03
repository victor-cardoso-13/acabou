/** Aba "Em casa": campo de busca, atalhos das categorias e a grade de botões. */
import { achar, alternarFalta, listarItens, tirarFalta } from '../motor/casa.ts';
import { combina, mesmoNome } from '../motor/busca.ts';
import { sugerirEmoji } from '../motor/emoji.ts';
import { formatarQuando } from '../motor/tempo.ts';
import type { ItemComId } from '../motor/tipos.ts';
import { avisar, casa, fazer, meuNome, meuUid, render, S } from './estado.ts';
import { produtoNovo } from './folhas.ts';
import { escapar as e } from './seguranca.ts';

const $ = (id: string) => document.getElementById(id)!;

function botao(i: ItemComId): string {
  const tag = i.falta ? `${e(i.quem)} · ${e(formatarQuando(i.quando))}` : '';
  return `<button class="item ${i.falta ? 'falta' : ''}" data-id="${e(i.id)}" aria-pressed="${i.falta}"><span class="e">${e(i.ic)}</span><span class="nm">${e(i.nome)}</span><span class="tag">${tag}</span></button>`;
}

export function telaCasa(): void {
  const c = casa();
  const conteudo = $('conteudo');
  const n = Object.values(c.itens).filter(i => i.falta).length;
  $('subtitulo').textContent = S.semInternet ? 'sem internet · tudo fica guardado' : n ? `${n} ${n === 1 ? 'coisa' : 'coisas'} na lista dos dois` : 'Nada faltando';
  $('fixo').innerHTML = '';

  // O campo de busca só é desenhado uma vez: se fosse refeito a cada mudança vinda do outro celular, o teclado fechava.
  if (conteudo.dataset.aba !== 'casa' || !document.getElementById('gradeCasa')) {
    conteudo.dataset.aba = 'casa';
    conteudo.innerHTML = `<form class="busca" id="formBusca"><input id="busca" class="campo-busca" autocomplete="off" autocapitalize="sentences" maxlength="40" placeholder="Acabou o quê?" aria-label="Acabou o quê?"><button>Pôr na lista</button></form>
      <div class="pulos" id="pulos"></div><div id="gradeCasa"></div>`;
    const busca = $('busca') as HTMLInputElement;
    busca.value = S.filtro;
    busca.oninput = () => { S.filtro = busca.value; desenharGrade(); };
    ($('formBusca') as HTMLFormElement).onsubmit = ev => { ev.preventDefault(); enviarBusca(); };
  }
  const busca = $('busca') as HTMLInputElement;
  if (busca.value !== S.filtro) busca.value = S.filtro;
  desenharGrade();
}

function desenharGrade(): void {
  const c = casa();
  const f = S.filtro.trim();
  const itens = listarItens(c);
  $('pulos').style.display = f ? 'none' : '';
  $('pulos').innerHTML = c.categorias.map(k => `<button class="pulo" data-pula="${e(k.id)}">${e(k.ic)} ${e(k.nome)}</button>`).join('');
  let h = '';
  if (f) {
    const achados = itens.filter(i => combina(i.nome, f));
    const exato = achados.some(i => mesmoNome(i.nome, f));
    h = `<div class="grade">${achados.map(botao).join('')}${exato ? '' : `<button class="item criar" data-criar="1"><span class="e">${e(sugerirEmoji(f, itens))}</span><span class="nm">Criar “${e(f)}”</span><span class="tag">produto novo</span></button>`}</div>`;
  } else {
    const grupos = c.categorias.map(k => ({ id: k.id, nome: `${e(k.ic)} ${e(k.nome)}`, its: itens.filter(i => i.cat === k.id) }));
    grupos.push({ id: 'semcat', nome: 'Sem categoria', its: itens.filter(i => !i.cat || !achar(c, 'categorias', i.cat)) });
    for (const g of grupos) if (g.its.length) h += `<div class="grupo" id="g-${e(g.id)}"><h3>${g.nome}</h3><div class="grade">${g.its.map(botao).join('')}</div></div>`;
    if (!h) h = '<p class="vazio">Ainda não tem nenhum produto. Escreva o nome do que acabou no campo de cima.</p>';
  }
  $('gradeCasa').innerHTML = h;
}

/** Um toque no botão: falta ↔ tem em casa. */
export function tocarItem(id: string): void {
  const i = casa().itens[id];
  if (!i) return;
  if (i.falta) fazer(tirarFalta(casa(), id), `${i.nome} saiu da lista`, true);
  else fazer(alternarFalta(casa(), id, meuNome(), meuUid(), Date.now()), `${i.nome} entrou na lista`, true);
}

export function enviarBusca(): void {
  const txt = S.filtro.trim();
  if (!txt) { avisar('Escreva o que acabou. Ex.: maizena'); return; }
  const achou = listarItens(casa()).find(i => mesmoNome(i.nome, txt));
  if (achou) {
    S.filtro = '';
    if (!achou.falta) tocarItem(achou.id);
    else { avisar(`${achou.nome} já está na lista`); render(); }
    return;
  }
  produtoNovo(txt);
}
