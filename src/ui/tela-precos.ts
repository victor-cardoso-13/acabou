/** Aba "Preços": perguntar ao Claude, anotar à mão e ver, produto por produto, onde está mais barato. */
import { combina } from '../motor/busca.ts';
import { itensFaltando, listarItens, listarMercados } from '../motor/casa.ts';
import { comparar, diasEntre, LIMITES_PRECO, quandoTexto, reais, textoPorUnidade } from '../motor/precos.ts';
import type { ItemComId } from '../motor/tipos.ts';
import { casa, S } from './estado.ts';
import { escapar as e } from './seguranca.ts';

const $ = (id: string) => document.getElementById(id)!;

function cartao(i: ItemComId, agora: number): string {
  const c = casa();
  const comp = comparar(S.precos, i.id, Object.keys(c.mercados), agora);
  const linhas = listarMercados(c).map(m => {
    const p = comp.por[m.id];
    if (!p) return `<div class="pl"><span class="pm">${e(m.ic)} ${e(m.nome)}</span><span class="pv vazio-p">sem preço</span></div>`;
    const velho = diasEntre(p.quando, agora) > LIMITES_PRECO.diasValem;
    const un = textoPorUnidade(p);
    return `<div class="pl ${comp.melhor === m.id ? 'melhor' : ''} ${velho ? 'velho' : ''}"><span class="pm">${e(m.ic)} ${e(m.nome)}</span>
      <span class="pv"><span><b>${reais(p.centavos)}</b>${p.emb ? ` · ${e(p.emb)}` : ''}${un ? ` · ${e(un)}` : ''}</span>
      <small>${p.marca ? `${e(p.marca)} · ` : ''}${quandoTexto(diasEntre(p.quando, agora))} · ${e(p.fonte || 'Alguém')}${velho ? ' · antigo, não entra na comparação' : ''}</small></span>
      ${comp.melhor === m.id ? '<span class="selo">mais barato</span>' : ''}</div>`;
  }).join('');
  return `<div class="cor cartao-preco"><div class="l1"><span class="e" style="font-size:26px">${e(i.ic)}</span><span class="nm"><b style="font-size:17px">${e(i.nome)}</b></span><button class="qual" data-anotar="${e(i.id)}">+ preço</button></div>${linhas}</div>`;
}

export function telaPrecos(): void {
  const c = casa();
  const conteudo = $('conteudo');
  $('subtitulo').textContent = 'Onde cada coisa está mais barata';
  $('fixo').innerHTML = '';
  // O campo de busca só é desenhado uma vez (se fosse refeito a cada mudança, o teclado fechava).
  if (conteudo.dataset.aba !== 'precos' || !document.getElementById('listaPrecos')) {
    conteudo.dataset.aba = 'precos';
    conteudo.innerHTML = `<div class="ia"><div class="tx"><b>Perguntar ao Claude</b><br>1. Monte a pergunta com a lista. 2. Mande para o Claude. 3. Cole a resposta: os preços entram aqui sozinhos.</div>
      <div class="botoes"><button id="perguntar">Montar pergunta</button><button id="colar" class="claro">Colar resposta</button></div>
      <button class="cidade" id="cidade">Cidade: <span id="cidadeTx"></span> ✎</button></div>
      <button class="novo" id="anotarNovo">+ Anotar um preço</button>
      <div class="busca"><input id="buscaPreco" class="campo-busca" autocomplete="off" maxlength="40" placeholder="Procurar produto" aria-label="Procurar produto"></div>
      <div id="listaPrecos" class="lista-precos"></div>`;
    const busca = $('buscaPreco') as HTMLInputElement;
    busca.value = S.filtroPreco;
    busca.oninput = () => { S.filtroPreco = busca.value; desenharLista(); };
  }
  $('cidadeTx').textContent = c.cidade || 'toque para escrever';
  desenharLista();
}

function desenharLista(): void {
  const c = casa(), agora = Date.now();
  const f = S.filtroPreco.trim();
  const ids = new Set(Object.keys(c.mercados));
  const comPreco = new Set(Object.values(S.precos).filter(p => ids.has(p.merc)).map(p => p.item));
  const filtra = (arr: ItemComId[]) => (f ? arr.filter(i => combina(i.nome, f)) : arr);
  const naLista = filtra(itensFaltando(c));
  const fora = listarItens(c).filter(i => !i.falta && (f || comPreco.has(i.id)));
  const outros = filtra(fora);
  let h = '';
  if (naLista.length) h += `<div class="rotulo-grupo">Na lista agora (${naLista.length})</div><div class="linhas">${naLista.map(i => cartao(i, agora)).join('')}</div>`;
  if (outros.length) h += `<div class="rotulo-grupo">${f ? 'Outros produtos' : 'Outros com preço anotado'} (${outros.length})</div><div class="linhas">${outros.slice(0, 30).map(i => cartao(i, agora)).join('')}</div>`;
  if (!naLista.length && !outros.length) h += `<p class="vazio">${f ? 'Nenhum produto com esse nome.' : 'Nada na lista e nenhum preço anotado ainda.'}</p>`;
  $('listaPrecos').innerHTML = h;
}
