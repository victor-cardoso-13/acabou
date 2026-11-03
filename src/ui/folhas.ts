/** As janelas que sobem de baixo ("folhas"): editar produto, escolher figurinha, nomes, confirmar, resumo, casa. */
import {
  achar, apagarLista, apagarProduto, capitalizar, criarLista, emailValido, mostrarCodigo, normalizarEmail, criarProduto, editarProduto, limparNome,
  listarItens, renomearLista, trocarFigurinhaLista, type DadosProduto,
} from '../motor/casa.ts';
import { EMOJIS, primeiroEmoji, sugerirEmoji } from '../motor/emoji.ts';
import { LIMITES, type TipoLista } from '../motor/tipos.ts';
import type { ResumoCompras } from '../motor/casa.ts';
import { casa, fazer, meuNome, meuUid, mudarMeuNome, S } from './estado.ts';
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

/** Primeira vez sem nome (conta antiga dos jogos): pergunta como quer ser chamado(a). */
export function perguntarNome(): void {
  textoSheet('Como você quer ser chamado(a)?', '', 'Salvar', v => mudarMeuNome(v));
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

/* ---------- a casa: pessoas, convite e sair ---------- */
export function casaSheet(sair: () => void, convite?: { codigo: string; email: string }, nomeSalvo = false): void {
  const c = casa();
  const nomeDe = (email: string) => (email === S.eu?.email ? S.eu.nome : '');
  const pessoas = c.membros.map((m, k) =>
    `<div class="pessoa"><span class="av c${k % 4}">${e((nomeDe(m) || m).charAt(0).toUpperCase())}</span><span>${e(m)}${m === S.eu?.email ? ' (você)' : ''}</span></div>`).join('');
  const cheia = c.membros.length >= LIMITES.membros;
  const blocoConvite = convite
    ? `<div class="rot">Convite para ${e(convite.email)}</div>
       <div class="codigo" id="fCodigo">${e(mostrarCodigo(convite.codigo))}</div>
       <p class="explica">Mande este código para a pessoa. Ela precisa entrar no app com o e-mail <b>${e(convite.email)}</b> e digitar o código. Vale por 2 dias e só funciona uma vez.</p>
       <div class="linha-form"><button class="ok" id="fCopiar">Copiar</button>${'share' in navigator ? '<button class="ok" id="fMandar">Mandar</button>' : ''}</div>
       <button class="cancela" id="fOutro">Gerar outro convite</button>`
    : cheia ? '<p class="explica">A casa já tem 4 pessoas.</p>' : `
       <div class="rot">Convidar quem mora com você</div>
       <form class="linha-form" id="fMembro"><input class="campo" type="email" id="fEmail" placeholder="e-mail da pessoa" autocomplete="off" autocapitalize="none" maxlength="${LIMITES.email}" aria-label="E-mail da pessoa"><button class="ok">Gerar convite</button></form>
       <p class="explica" id="fMembroDica">A pessoa precisa ter conta no app (a dos jogos serve). O convite só funciona para o e-mail que você digitar aqui.</p>`;
  folha(`<h2>Nossa casa</h2>${pessoas}
    <div class="rot">Seu nome</div>
    <form class="linha-form" id="fNomeForm"><input class="campo" type="text" id="fMeuNome" value="${e(meuNome())}" maxlength="${LIMITES.nome}" autocomplete="off" aria-label="Seu nome"><button class="ok ${nomeSalvo ? 'salvo' : ''}">${nomeSalvo ? 'Salvo ✓' : 'Salvar'}</button></form>
    ${nomeSalvo ? '<p class="confirma" role="status">Pronto! Seu nome foi salvo e já aparece no celular da outra pessoa.</p>' : ''}
    ${blocoConvite}
    <button class="link" id="fSair">Sair desta conta</button><button class="cancela" id="fFecha">Fechar</button>`, () => {
    $('fFecha').onclick = fecharFolha;
    $('fSair').onclick = () => { fecharFolha(); sair(); };
    ($('fNomeForm') as HTMLFormElement).onsubmit = ev => {
      ev.preventDefault();
      const n = limparNome(($('fMeuNome') as HTMLInputElement).value);
      if (!n) return;
      mudarMeuNome(n);
      casaSheet(sair, convite, true);
    };
    const form = document.getElementById('fMembro') as HTMLFormElement | null;
    if (form) form.onsubmit = async ev => {
      ev.preventDefault();
      const email = normalizarEmail(($('fEmail') as HTMLInputElement).value);
      const dica = $('fMembroDica');
      if (!emailValido(email)) { dica.textContent = 'Esse e-mail não parece certo. Confira se digitou direitinho.'; return; }
      if (c.membros.includes(email)) { dica.textContent = 'Essa pessoa já está na casa.'; return; }
      if (!S.convidar) { dica.textContent = 'Convite só funciona com internet e conta.'; return; }
      dica.textContent = 'Gerando…';
      try { casaSheet(sair, { codigo: await S.convidar(email), email }); }
      catch (err) { dica.textContent = S.mensagemErro(err); }
    };
    const texto = convite ? `Convite para entrar na nossa casa no Acabou!: ${mostrarCodigo(convite.codigo)}\nEntre com o e-mail ${convite.email}.` : '';
    const copiar = document.getElementById('fCopiar');
    if (copiar) copiar.onclick = async () => {
      try { await navigator.clipboard.writeText(mostrarCodigo(convite!.codigo)); copiar.textContent = 'Copiado ✓'; } catch { copiar.textContent = 'Toque e segure o código para copiar'; }
    };
    const mandar = document.getElementById('fMandar');
    if (mandar) mandar.onclick = () => { void navigator.share({ text: texto }).catch(() => {}); };
    const outro = document.getElementById('fOutro');
    if (outro) outro.onclick = () => casaSheet(sair);
  });
}
