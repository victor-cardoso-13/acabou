/** Aviso curto embaixo da tela, com "Desfazer" quando faz sentido. Texto sempre simples, em português. */
import { ligarAviso } from './estado.ts';

let tempo: ReturnType<typeof setTimeout> | undefined;

export function montarAviso(el: HTMLElement) {
  const tx = el.querySelector('span')!, bt = el.querySelector('button')!;
  ligarAviso((texto, rotulo, acao) => {
    tx.textContent = texto;
    bt.textContent = rotulo ?? '';
    bt.style.display = rotulo ? '' : 'none';
    bt.onclick = () => { el.classList.remove('on'); acao?.(); };
    el.classList.add('on');
    clearTimeout(tempo);
    tempo = setTimeout(() => el.classList.remove('on'), rotulo ? 5000 : 3200);
  });
}
