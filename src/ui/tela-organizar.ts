/** Aba "Organizar": corredores do mercado e categorias da casa (funcionam igual). */
import { listarItens, moverLista } from '../motor/casa.ts';
import type { TipoLista } from '../motor/tipos.ts';
import { casa, fazer, S } from './estado.ts';
import { escapar as e } from './seguranca.ts';

const $ = (id: string) => document.getElementById(id)!;

export function telaOrganizar(): void {
  const c = casa();
  const tipo = S.org;
  const ehCor = tipo === 'corredores';
  const lista = c[tipo];
  const campo = ehCor ? 'cor' : 'cat';
  const itens = listarItens(c);
  const conteudo = $('conteudo');
  conteudo.dataset.aba = 'organizar';
  $('subtitulo').textContent = ehCor ? 'Do jeito do seu mercado' : 'Do jeito da sua casa';
  $('fixo').innerHTML = '';

  let h = `<div class="segmento"><button data-orgaba="corredores" class="${ehCor ? 'on' : ''}">Corredores do mercado</button><button data-orgaba="categorias" class="${!ehCor ? 'on' : ''}">Categorias da casa</button></div>`;
  h += `<p class="explica">${ehCor
    ? 'Na ordem em que vocês andam no mercado. Toque no nome para renomear e na figurinha para trocar.'
    : 'Como os botões aparecem na tela Em casa. Toque no nome para renomear e na figurinha para trocar.'}</p><div class="linhas">`;
  lista.forEach((x, k) => {
    const its = itens.filter(i => i[campo] === x.id);
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
  h += `</div><button class="novo" data-novo="${tipo}">+ ${ehCor ? 'Novo corredor' : 'Nova categoria'}</button>`;
  if (ehCor) h += `<div class="opcao"><input type="checkbox" id="aprender" ${c.aprender ? 'checked' : ''}><label for="aprender"><b>Aprender a ordem sozinho</b> (${c.aprender ? 'ligado' : 'desligado'})<br>Se ligar, a ordem em que você pega as coisas vira a ordem dos corredores. Deixe desligado quando vocês se dividem no mercado.</label></div>`;
  const topo = conteudo.scrollTop;
  conteudo.innerHTML = h;
  conteudo.scrollTop = topo;
}

export function mover(tipo: TipoLista, id: string, dir: -1 | 1): void {
  const chave = `${tipo}:${id}`;
  fazer(moverLista(casa(), tipo, id, dir));
  S.mexeu = chave;
  setTimeout(() => { if (S.mexeu === chave) { S.mexeu = null; document.querySelectorAll('.cor.mexeu').forEach(el => el.classList.remove('mexeu')); } }, 700);
}
