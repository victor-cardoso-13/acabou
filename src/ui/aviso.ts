/** Aviso curto logo acima das abas, com "Desfazer" quando faz sentido. Texto sempre simples, em português. */
import { ligarAviso } from './estado.ts';

let tempo: ReturnType<typeof setTimeout> | undefined;
let elAviso: HTMLElement | null = null;

/**
 * O aviso nunca tampa as abas: fica 8 px acima do botão fixo ("Terminar compras"), se ele estiver na tela,
 * senão acima da barra de abas. Mede a tela de verdade (deitado a barra é mais baixa; a área segura de baixo
 * é recuo do #app e já fica fora destas medidas). Sem abas (tela de entrar), volta para o rodapé.
 */
export function posicionarAviso(): void {
  if (!elAviso) return;
  const ref = document.querySelector<HTMLElement>('#fixo > *') ?? document.querySelector<HTMLElement>('.abas');
  const topo = ref?.getBoundingClientRect().top;
  elAviso.style.bottom = topo ? `${Math.max(8, Math.round(window.innerHeight - topo + 8))}px` : '';
}

export function montarAviso(el: HTMLElement) {
  elAviso = el;
  const tx = el.querySelector('span')!, bt = el.querySelector('button')!;
  ligarAviso((texto, rotulo, acao) => {
    tx.textContent = texto;
    bt.textContent = rotulo ?? '';
    bt.style.display = rotulo ? '' : 'none';
    bt.onclick = () => { el.classList.remove('on'); acao?.(); };
    posicionarAviso();
    el.classList.add('on');
    clearTimeout(tempo);
    tempo = setTimeout(() => el.classList.remove('on'), rotulo ? 5000 : 3200);
  });
  window.addEventListener('resize', posicionarAviso);
}
