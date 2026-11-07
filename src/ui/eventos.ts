/** Toques e gestos: um único ouvinte de cada tipo para a página toda. */
import { acharDeNovo, definirAprender, marcarSemEstoque, pegar } from '../motor/casa.ts';
import {
  apagarListaSheet, apagarMercadoSheet, casaSheet, editarMercadoSheet, folhaAberta, itemSheet, novaLista, novoMercadoSheet, qualSheet, renomear, trocarFigurinha,
} from './folhas.ts';
import { casa, escolherMercado, fazer, mercadoOrg, render, S } from './estado.ts';
import { abrirColar, abrirPergunta, abrirPrecoSheet, editarCidade } from './folhas-precos.ts';
import { tocarItem, enviarBusca } from './tela-casa.ts';
import { comecar, terminar } from './tela-mercado.ts';
import { mover } from './tela-organizar.ts';
import type { TipoLista } from '../motor/tipos.ts';

let sairDaConta: () => void = () => {};
export const ligarSair = (f: () => void) => { sairDaConta = f; };

const $ = (id: string) => document.getElementById(id)!;
const dividir = (chave: string): [TipoLista, string] => {
  const k = chave.indexOf(':');
  return [chave.slice(0, k) as TipoLista, chave.slice(k + 1)];
};

/* ---------- segurar o dedo num botão de Em casa = editar produto ---------- */
let tSeg: ReturnType<typeof setTimeout> | null = null;
let segurou = false;
let x0 = 0, y0 = 0;
function soltar(): void {
  if (tSeg) clearTimeout(tSeg);
  tSeg = null;
  document.querySelectorAll('.segurando').forEach(el => el.classList.remove('segurando'));
}

function ligarGestos(): void {
  document.addEventListener('pointerdown', ev => {
    segurou = false; // cada toque novo começa limpo (no iPhone o "click" depois de segurar pode nem vir)
    const t = (ev.target as HTMLElement).closest<HTMLElement>('.item[data-id]');
    if (!t || folhaAberta()) return;
    x0 = ev.clientX; y0 = ev.clientY;
    t.classList.add('segurando');
    tSeg = setTimeout(() => {
      tSeg = null; segurou = true;
      t.classList.remove('segurando');
      navigator.vibrate?.(15);
      const i = casa().itens[t.dataset.id!];
      if (i) itemSheet({ nome: i.nome, ic: i.ic, cat: i.cat, cor: { ...i.cor } }, t.dataset.id!);
    }, 500);
  });
  document.addEventListener('pointerup', soltar);
  document.addEventListener('pointercancel', soltar);
  // arrastou mais de 10 px = é rolagem, não é "segurar"
  document.addEventListener('pointermove', ev => { if (tSeg && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10) soltar(); });
  // sem o menu de "copiar / buscar" do iOS em cima dos botões
  document.addEventListener('contextmenu', ev => { if ((ev.target as HTMLElement).closest('.item')) ev.preventDefault(); });
}

/**
 * Pulo de categoria SEM animação: a rolagem suave brigava com a barra fixa no iPhone (a tela piscava, descia e subia).
 * A categoria para logo abaixo da barra de atalhos.
 */
export function pular(id: string): void {
  const g = document.getElementById(`g-${id}`), c = $('conteudo'), barra = $('pulos');
  if (!g) return;
  // 1º: leva a categoria para o topo; 2º: com a barra já grudada, acerta pelo fundo real dela (tudo no mesmo instante, sem animação)
  c.scrollTop += g.getBoundingClientRect().top - c.getBoundingClientRect().top;
  c.scrollTop += g.getBoundingClientRect().top - barra.getBoundingClientRect().bottom - 8;
}

/* ---------- cliques ---------- */
function aoClicar(ev: MouseEvent): void {
  if (!S.casa) return;
  const alvo = ev.target as HTMLElement;
  if (alvo.closest('#folha')) return;
  const t = alvo.closest<HTMLElement>('button,[data-pick]');
  if (!t) return;
  const d = t.dataset;
  const agora = Date.now();

  if (d.tab) { S.aba = d.tab as typeof S.aba; S.aberta = null; render(); $('conteudo').scrollTop = 0; return; }
  if (d.casa) { casaSheet(sairDaConta); return; }
  if (d.id) { if (segurou) { segurou = false; return; } tocarItem(d.id); return; }
  if (d.pula) { pular(d.pula); return; }
  if (d.criar) { enviarBusca(); return; }
  if (d.nt) { fazer(marcarSemEstoque(casa(), d.nt)); return; }
  if (d.pick) { fazer(pegar(casa(), d.pick, agora)); return; }
  if (d.volta) { fazer(acharDeNovo(casa(), d.volta)); return; }
  if (d.merc) { escolherMercado(d.merc); return; }
  if (d.orgmerc) { S.orgMercado = d.orgmerc; S.aberta = null; render(); return; }
  if (d.qual) { qualSheet(d.qual); return; }
  if (d.anotar) { abrirPrecoSheet(d.anotar); return; }
  if (d.orgaba) { S.org = d.orgaba as TipoLista; S.aberta = null; render(); return; }
  if (d.up) { const [tp, id] = dividir(d.up); mover(tp, id, -1); return; }
  if (d.down) { const [tp, id] = dividir(d.down); mover(tp, id, 1); return; }
  if (d.abre) { S.aberta = S.aberta === d.abre ? null : d.abre; render(); return; }
  if (d.edit) {
    const i = casa().itens[d.edit];
    if (i) itemSheet({ nome: i.nome, ic: i.ic, cat: i.cat, cor: { ...i.cor } }, d.edit, mercadoOrg()?.id ?? null);
    return;
  }
  if (d.emo) { const [tp, id] = dividir(d.emo); trocarFigurinha(tp, id); return; }
  if (d.ren) { const [tp, id] = dividir(d.ren); renomear(tp, id); return; }
  if (d.del) { const [tp, id] = dividir(d.del); apagarListaSheet(tp, id); return; }
  if (d.novo) { novaLista(d.novo as TipoLista); return; }
  if (t.id === 'novoMerc') { novoMercadoSheet(); return; }
  if (t.id === 'editMerc') { editarMercadoSheet(); return; }
  if (t.id === 'delMerc') { apagarMercadoSheet(); return; }
  if (t.id === 'perguntar') { abrirPergunta(); return; }
  if (t.id === 'colar') { abrirColar(); return; }
  if (t.id === 'anotarNovo') { abrirPrecoSheet(null); return; }
  if (t.id === 'cidade') { editarCidade(); return; }
  if (t.id === 'comecar') { comecar(); return; }
  if (t.id === 'terminar') { terminar(); return; }
}

export function ligarEventos(): void {
  ligarGestos();
  document.addEventListener('click', aoClicar);
  document.addEventListener('change', ev => {
    const el = ev.target as HTMLInputElement;
    const m = mercadoOrg();
    if (el.id === 'aprender' && S.casa && m) fazer(definirAprender(m.id, el.checked), el.checked ? `Vou aprender a ordem dos corredores do ${m.nome}` : 'Aprender a ordem desligado');
  });
  // teclado: o item do mercado é um "botão" feito de div
  document.addEventListener('keydown', ev => {
    const t = (ev.target as HTMLElement).closest?.<HTMLElement>('[data-pick]');
    if (t && (ev.key === 'Enter' || ev.key === ' ') && !(ev.target as HTMLElement).closest('button') && S.casa) {
      ev.preventDefault();
      fazer(pegar(casa(), t.dataset.pick!, Date.now()));
    }
  });
}
