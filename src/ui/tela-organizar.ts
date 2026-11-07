/** Aba "Organizar": corredores de cada mercado e categorias da casa (funcionam igual). */
import { corredorDe, listarItens, listarMercados, moverLista } from '../motor/casa.ts';
import type { TipoLista } from '../motor/tipos.ts';
import { alvoOrg, casa, fazer, mercadoOrg, S } from './estado.ts';
import { escapar as e } from './seguranca.ts';

const $ = (id: string) => document.getElementById(id)!;

export function telaOrganizar(): void {
  const c = casa();
  const tipo = S.org;
  const ehCor = tipo === 'corredores';
  const m = mercadoOrg();
  const lista = ehCor ? m?.corredores ?? [] : c.categorias;
  const itens = listarItens(c);
  const noCorredor = (id: string) => itens.filter(i => (ehCor ? m && corredorDe(c, i, m.id) === id : i.cat === id));
  const conteudo = $('conteudo');
  conteudo.dataset.aba = 'organizar';
  $('subtitulo').textContent = ehCor ? `Do jeito do ${m?.nome ?? 'mercado'}` : 'Do jeito da sua casa';
  $('fixo').innerHTML = '';

  let h = `<div class="segmento"><button data-orgaba="corredores" class="${ehCor ? 'on' : ''}">Corredores do mercado</button><button data-orgaba="categorias" class="${!ehCor ? 'on' : ''}">Categorias da casa</button></div>`;
  if (ehCor) {
    h += `<div class="mercs" role="group" aria-label="Corredores de qual mercado">${listarMercados(c).map(x => `<button class="merc ${x.id === m?.id ? 'on' : ''}" data-orgmerc="${e(x.id)}">${e(x.ic)} ${e(x.nome)}</button>`).join('')}<button class="merc mais" id="novoMerc">+ Mercado</button></div>`;
    h += `<p class="explica">Corredores do <b>${e(m?.nome ?? '')}</b>, na ordem em que vocês andam lá. Toque no nome para renomear e na figurinha para trocar.</p>`;
  } else {
    h += '<p class="explica">Como os botões aparecem na tela Em casa. Toque no nome para renomear e na figurinha para trocar.</p>';
  }
  h += '<div class="linhas">';
  lista.forEach((x, k) => {
    const its = noCorredor(x.id);
    const chave = `${tipo}:${x.id}`, aberto = S.aberta === chave, k_ = e(chave);
    h += `<div class="cor ${S.mexeu === chave ? 'mexeu' : ''}"><div class="l1">
      ${ehCor ? `<span class="num">${k + 1}</span>` : ''}
      <button class="emo" data-emo="${k_}" aria-label="Trocar figurinha">${e(x.ic)}</button>
      <span class="nm"><button class="ren" data-ren="${k_}">${e(x.nome)} <i>✎</i></button><button class="ver" data-abre="${k_}">${its.length} ${its.length === 1 ? 'item' : 'itens'} · ${aberto ? 'fechar' : 'ver'}</button></span>
      <button class="seta" data-up="${k_}" ${k === 0 ? 'disabled' : ''} aria-label="Subir">▲</button>
      <button class="seta" data-down="${k_}" ${k === lista.length - 1 ? 'disabled' : ''} aria-label="Descer">▼</button></div>`;
    if (aberto) {
      h += `<div class="chips">${its.map(i => `<button class="chip" data-edit="${e(i.id)}">${e(i.ic)} ${e(i.nome)}</button>`).join('') || '<span class="explica">Nenhum item aqui.</span>'}</div>
        <span class="explica" style="font-size:13px">Toque num produto para mudar figurinha, nome, categoria ou corredor.</span>
        <button class="link" data-del="${k_}">Apagar ${ehCor ? 'este corredor' : 'esta categoria'}</button>`;
    }
    h += '</div>';
  });
  h += `</div><button class="novo" data-novo="${tipo}">+ ${ehCor ? `Novo corredor no ${e(m?.nome ?? '')}` : 'Nova categoria'}</button>`;
  if (ehCor && m) {
    const sem = itens.filter(i => !corredorDe(c, i, m.id)).length;
    if (sem) h += `<p class="explica" style="font-size:14px">${sem} ${sem === 1 ? 'produto ainda não tem' : 'produtos ainda não têm'} corredor no ${e(m.nome)}. Sem problema: ${sem === 1 ? 'ele aparece' : 'eles aparecem'} em "Sem corredor" e você escolhe na hora da compra.</p>`;
    h += `<div class="opcao"><input type="checkbox" id="aprender" ${m.aprender ? 'checked' : ''}><label for="aprender"><b>Aprender a ordem sozinho no ${e(m.nome)}</b> (${m.aprender ? 'ligado' : 'desligado'})<br>Se ligar, a ordem em que você pega as coisas lá vira a ordem dos corredores de lá. Deixe desligado quando vocês se dividem no mercado.</label></div>`;
    h += `<div class="links"><button class="link" id="editMerc">Editar o ${e(m.nome)}</button>${listarMercados(c).length > 1 ? `<button class="link perigo" id="delMerc">Apagar o ${e(m.nome)}</button>` : ''}</div>`;
  }
  const topo = conteudo.scrollTop;
  conteudo.innerHTML = h;
  conteudo.scrollTop = topo;
}

export function mover(tipo: TipoLista, id: string, dir: -1 | 1): void {
  const chave = `${tipo}:${id}`;
  fazer(moverLista(casa(), alvoOrg(tipo), id, dir));
  S.mexeu = chave;
  setTimeout(() => { if (S.mexeu === chave) { S.mexeu = null; document.querySelectorAll('.cor.mexeu').forEach(el => el.classList.remove('mexeu')); } }, 700);
}
