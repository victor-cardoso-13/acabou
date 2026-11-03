/** As janelas que sobem de baixo ("folhas"): editar produto, escolher figurinha, nomes, confirmar, resumo, casa. */
import {
  achar, adicionarMembro, apagarLista, apagarProduto, capitalizar, criarLista, criarProduto, editarProduto, limparNome,
  listarItens, renomearLista, trocarFigurinhaLista, type DadosProduto,
} from '../motor/casa.ts';
import { EMOJIS, primeiroEmoji, sugerirEmoji } from '../motor/emoji.ts';
import { LIMITES, type TipoLista } from '../motor/tipos.ts';
import type { ResumoCompras } from '../motor/casa.ts';
import { casa, fazer, meuNome, meuUid, S } from './estado.ts';
import { escapar as e } from './seguranca.ts';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

/* ---------- base ---------- */
let abertaEm = 0;
/** Só fecha ao tocar no fundo se o toque COMEÇOU no fundo (soltar o dedo depois de segurar não fecha). */
let comecouNoFundo = false;

export function folhaAberta(): boolean { return $('folha').childElementCount > 0; }

export function folha(html: string, liga?: () => void): void {
  const jaAberta = folhaAberta();
  if (!jaAberta) abertaEm = Date.now();
  $('folha').innerHTML = `<div class="veu" id="veu"><div class="folha ${jaAberta ? 'sem-anim' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
  const veu = $('veu');
  veu.onpointerdown = ev => { comecouNoFundo = ev.target === veu; };
  veu.onclick = ev => { if (ev.target === veu && comecouNoFundo && Date.now() - abertaEm > 600) fecharFolha(); };
  liga?.();
}

export function fecharFolha(): void { $('folha').innerHTML = ''; }

/* ---------- texto, confirmar ---------- */
export function textoSheet(titulo: string, valor: string, rotulo: string, cb: (v: string) => void): void {
  folha(`<h2>${e(titulo)}</h2><input class="campo" type="text" id="fTexto" value="${e(valor)}" maxlength="${LIMITES.nome}" autocomplete="off" aria-label="${e(titulo)}"><button class="ok" id="fOk">${e(rotulo)}</button><button class="cancela" id="fCancela">Cancelar</button>`, () => {
    const ir = () => { const v = limparNome(($('fTexto') as HTMLInputElement).value); if (!v) return; fecharFolha(); cb(v); };
    $('fOk').onclick = ir;
    $('fTexto').onkeydown = ev => { if ((ev as KeyboardEvent).key === 'Enter') ir(); };
    $('fCancela').onclick = fecharFolha;
    ($('fTexto') as HTMLInputElement).focus();
    ($('fTexto') as HTMLInputElement).select();
  });
}

export function confirmar(titulo: string, texto: string, rotulo: string, cb: () => void): void {
  folha(`<h2>${e(titulo)}</h2><p>${e(texto)}</p><button class="ok perigo" id="fSim">${e(rotulo)}</button><button class="cancela" id="fNao">Cancelar</button>`, () => {
    $('fSim').onclick = () => { fecharFolha(); cb(); };
    $('fNao').onclick = fecharFolha;
  });
}

/* ---------- figurinhas ---------- */
/** `cb` recebe a figurinha escolhida (ou a atual, se a pessoa tocar em Voltar). */
export function escolherEmoji(atual: string, cb: (emoji: string) => void): void {
  const grupos = EMOJIS.map(([t, es]) =>
    `<h3>${e(t)}</h3><div class="g">${es.map(x => `<button data-e="${e(x)}" class="${x === atual ? 'sel' : ''}">${e(x)}</button>`).join('')}</div>`).join('');
  folha(`<h2>Escolha a figurinha</h2>
    <div class="teclado"><input type="text" id="emoTec" enterkeyhint="done" placeholder="${e(atual)}" autocomplete="off" aria-label="Figurinha pelo teclado"><span><b>Qualquer figurinha:</b> toque aqui e use o teclado de emojis do iPhone (botão 😀 ou 🌐).<small id="emoErro"></small></span></div>
    <div class="emojis">${grupos}</div><button class="cancela" id="emoVolta">Voltar</button>`, () => {
    document.querySelectorAll<HTMLElement>('[data-e]').forEach(b => { b.onclick = () => cb(b.dataset.e!); });
    $('emoVolta').onclick = () => cb(atual);
    ($('emoTec') as HTMLInputElement).oninput = ev => {
      const v = (ev.target as HTMLInputElement).value;
      const em = primeiroEmoji(v);
      if (em) cb(em);
      else $('emoErro').textContent = v.trim() ? 'Isso não é uma figurinha. Use o teclado de emojis.' : '';
    };
  });
}

/* ---------- produto ---------- */
export function itemSheet(d: DadosProduto, id: string | null): void {
  const c = casa();
  const novo = id === null;
  const chips = (tipo: TipoLista, atual: string | null) => c[tipo]
    .map(x => `<button class="chip ${x.id === atual ? 'sel' : ''}" data-f${tipo === 'categorias' ? 'cat' : 'cor'}="${e(x.id)}">${e(x.ic)} ${e(x.nome)}</button>`).join('');
  folha(`<h2>${novo ? 'Produto novo' : 'Editar produto'}</h2>
    <div class="campo-item"><button class="emo" id="fEmo" aria-label="Trocar figurinha">${e(d.ic)}</button><input class="campo" type="text" id="fNome" value="${e(d.nome)}" maxlength="${LIMITES.nome}" autocomplete="off" aria-label="Nome"></div>
    <div class="rot">Onde fica em casa?</div><div class="chips">${chips('categorias', d.cat)}</div>
    <div class="rot">Em que corredor do mercado?</div><div class="chips">${chips('corredores', d.cor)}</div>
    <button class="ok" id="fSalvar">${novo ? 'Salvar e pôr na lista' : 'Salvar'}</button>
    ${novo ? '<button class="cancela" id="fCancela">Cancelar</button>' : '<button class="link" id="fApagar">Apagar este produto</button>'}`, () => {
    const pega = () => { d.nome = limparNome(($('fNome') as HTMLInputElement).value) || d.nome; };
    $('fEmo').onclick = () => { pega(); escolherEmoji(d.ic, em => { d.ic = em; itemSheet(d, id); }); };
    document.querySelectorAll<HTMLElement>('[data-fcat]').forEach(b => { b.onclick = () => { pega(); d.cat = b.dataset.fcat!; itemSheet(d, id); }; });
    document.querySelectorAll<HTMLElement>('[data-fcor]').forEach(b => { b.onclick = () => { pega(); d.cor = b.dataset.fcor!; itemSheet(d, id); }; });
    $('fSalvar').onclick = () => {
      pega();
      fecharFolha();
      if (novo) {
        const r = criarProduto(casa(), d, true, meuNome(), meuUid(), Date.now());
        S.filtro = '';
        fazer(r.escritas, `${capitalizar(d.nome)} entrou na lista e virou botão`, true);
        setTimeout(() => document.querySelector(`[data-id="${CSS.escape(r.id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
      } else {
        fazer(editarProduto(casa(), id, d), `${d.nome} salvo`);
      }
    };
    if (novo) $('fCancela').onclick = fecharFolha;
    else $('fApagar').onclick = () => confirmar(`Apagar ${d.nome}?`, 'Ele some dos botões e da lista. Dá para criar de novo depois.', 'Apagar', () => {
      fazer(apagarProduto(casa(), id), `${d.nome} apagado`, true);
    });
  });
}

/** Produto novo a partir do que foi digitado na busca. */
export function produtoNovo(nome: string): void {
  const n = capitalizar(nome);
  const itens = listarItens(casa());
  itemSheet({ nome: n, ic: sugerirEmoji(n, itens), cat: null, cor: null }, null);
}

/* ---------- categorias e corredores ---------- */
export function novaLista(tipo: TipoLista): void {
  textoSheet(tipo === 'corredores' ? 'Novo corredor' : 'Nova categoria', '', 'Criar', v => {
    const r = criarLista(casa(), tipo, v, sugerirEmoji(v, listarItens(casa())));
    fazer(r.escritas, `${v} criado. Toque na figurinha para trocar.`);
    setTimeout(() => { const c = $('conteudo'); c.scrollTop = c.scrollHeight; }, 30);
  });
}

export function renomear(tipo: TipoLista, id: string): void {
  const x = achar(casa(), tipo, id);
  if (!x) return;
  textoSheet(tipo === 'corredores' ? 'Nome do corredor' : 'Nome da categoria', x.nome, 'Salvar', v => {
    fazer(renomearLista(casa(), tipo, id, v), 'Nome trocado');
  });
}

export function trocarFigurinha(tipo: TipoLista, id: string): void {
  const x = achar(casa(), tipo, id);
  if (!x) return;
  escolherEmoji(x.ic, em => { fecharFolha(); fazer(trocarFigurinhaLista(casa(), tipo, id, em)); });
}

export function apagarListaSheet(tipo: TipoLista, id: string): void {
  const x = achar(casa(), tipo, id);
  if (!x) return;
  const campo = tipo === 'corredores' ? 'cor' : 'cat';
  const n = listarItens(casa()).filter(i => i[campo] === id).length;
  const sem = tipo === 'corredores' ? 'Sem corredor' : 'Sem categoria';
  confirmar(`Apagar ${x.nome}?`, n ? `Os ${n} produtos daqui vão para "${sem}". Nenhum produto some.` : 'Não tem nenhum produto aqui.', 'Apagar', () => {
    S.aberta = null;
    fazer(apagarLista(casa(), tipo, id), `${x.nome} apagado`, true);
  });
}

/* ---------- fim das compras ---------- */
export function resumoSheet(r: ResumoCompras, depois: () => void): void {
  const p = r.pegos.length, s = r.semEstoque.length, f = r.restaram.length;
  folha(`<h2>Compras feitas</h2>
    <p>✓ <b>${p} ${p === 1 ? 'item voltou' : 'itens voltaram'}</b> para "tem em casa".</p>
    ${s ? `<p>↻ <b>${r.semEstoque.map(i => e(i.nome)).join(', ')}</b> não tinha: continua na lista.</p>` : ''}
    ${f ? `<p>• ${f} ${f === 1 ? 'item ficou' : 'itens ficaram'} sem pegar e continuam na lista.</p>` : ''}
    ${r.ordemAprendida ? `<p><b>Aprendi a ordem:</b> ${r.ordemAprendida.map(n => e(n)).join(' → ')}.</p>` : ''}
    <button class="ok" id="okFim">Ok</button>`, () => {
    $('okFim').onclick = () => { fecharFolha(); depois(); };
  });
}

/* ---------- a casa: pessoas e sair ---------- */
export function casaSheet(sair: () => void): void {
  const c = casa();
  const nomeDe = (email: string) => Object.entries(c.nomes).find(([uid]) => uid === S.eu?.uid && email === S.eu?.email)?.[1] ?? '';
  const pessoas = c.membros.map((m, k) =>
    `<div class="pessoa"><span class="av c${k % 4}">${e((nomeDe(m) || m).charAt(0).toUpperCase())}</span><span>${e(m)}${m === S.eu?.email ? ' (você)' : ''}</span></div>`).join('');
  const cheia = c.membros.length >= LIMITES.membros;
  folha(`<h2>Nossa casa</h2>${pessoas}
    ${cheia ? '<p class="explica">A casa já tem 4 pessoas.</p>' : `
    <div class="rot">Adicionar quem mora com você</div>
    <form class="linha-form" id="fMembro"><input class="campo" type="email" id="fEmail" placeholder="e-mail da pessoa" autocomplete="off" autocapitalize="none" maxlength="${LIMITES.email}" aria-label="E-mail da pessoa"><button class="ok">Adicionar</button></form>
    <p class="explica" id="fMembroDica">A pessoa precisa <b>criar a conta no Acabou! antes</b>, com esse mesmo e-mail. Depois que você adicionar, a casa aparece no celular dela sozinha.</p>`}
    <button class="link" id="fSair">Sair desta conta</button><button class="cancela" id="fFecha">Fechar</button>`, () => {
    $('fFecha').onclick = fecharFolha;
    $('fSair').onclick = () => { fecharFolha(); sair(); };
    const form = document.getElementById('fMembro') as HTMLFormElement | null;
    if (form) form.onsubmit = ev => {
      ev.preventDefault();
      const r = adicionarMembro(casa(), ($('fEmail') as HTMLInputElement).value);
      if ('erro' in r) {
        $('fMembroDica').textContent = { invalido: 'Esse e-mail não parece certo. Confira se digitou direitinho.', repetido: 'Essa pessoa já está na casa.', cheia: 'A casa já tem 4 pessoas.' }[r.erro];
        return;
      }
      fazer(r.escritas, 'Pessoa adicionada');
      casaSheet(sair);
    };
  });
}

