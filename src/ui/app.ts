/** A casca do app (título, abas, avisos) e o desenho de cada aba. */
import { inicioDasCompras } from '../motor/casa.ts';
import { posicionarAviso } from './aviso.ts';
import { ligarEventos } from './eventos.ts';
import { ligarRender, NOMES_DAS_ABAS, S, type Aba } from './estado.ts';
import { escapar as e } from './seguranca.ts';
import { telaCasa } from './tela-casa.ts';
import { telaMercado } from './tela-mercado.ts';
import { telaOrganizar } from './tela-organizar.ts';

const $ = (id: string) => document.getElementById(id)!;
let montada = false;

export function montarCasca(): void {
  document.getElementById('app')!.innerHTML = `<div class="tela">
    <header class="topo"><div class="tit"><h1 id="titulo"></h1><div class="s" id="subtitulo"></div></div><button class="avs" id="avs" data-casa="1" aria-label="Nossa casa"></button></header>
    <section class="conteudo" id="conteudo"></section>
    <div id="fixo"></div>
    <nav class="abas" aria-label="Telas">
      <button data-tab="casa"><span class="ic">🏠</span>Em casa</button>
      <button data-tab="mercado"><span class="ic">🛒</span>Mercado<span class="badge" id="badge"></span></button>
      <button data-tab="organizar"><span class="ic">🧭</span>Organizar</button>
    </nav></div>`;
  montada = true;
  // a barra de abas muda de altura (deitado é mais baixa): o aviso acompanha
  const ro = new ResizeObserver(() => posicionarAviso());
  ro.observe(document.querySelector('.abas')!);
  ro.observe($('fixo'));
}

export function casaSumiu(): void { montada = false; }

function avatares(): string {
  const c = S.casa!, agora = Date.now();
  const outros = Object.keys(c.nomes).filter(u => u !== S.eu?.uid).sort();
  const uids = S.eu ? [S.eu.uid, ...outros] : outros;
  return uids.map((uid, k) => {
    const nome = (uid === S.eu?.uid ? S.eu.nome : c.nomes[uid]) || c.nomes[uid] || '?';
    const indo = inicioDasCompras(c, uid, agora) !== null;
    return `<span class="av c${k % 4} ${indo ? 'mercado' : ''}" title="${e(nome)}">${e(nome.charAt(0).toUpperCase())}</span>`;
  }).join('');
}

export function desenhar(): void {
  if (!S.casa) return;
  if (!montada) montarCasca();
  const aba: Aba = S.aba;
  $('titulo').textContent = NOMES_DAS_ABAS[aba];
  document.querySelectorAll<HTMLElement>('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === aba));
  const n = Object.values(S.casa.itens).filter(i => i.falta).length;
  $('badge').textContent = String(n);
  $('badge').style.display = n ? '' : 'none';
  $('avs').innerHTML = avatares();
  if (aba === 'casa') telaCasa();
  else if (aba === 'mercado') telaMercado();
  else telaOrganizar();
  posicionarAviso(); // o botão "Terminar compras" entra e sai: o aviso sobe junto
}

export function iniciarUI(): void {
  ligarRender(desenhar);
  ligarEventos();
}
