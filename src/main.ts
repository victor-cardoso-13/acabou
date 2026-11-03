/**
 * Acabou! — lista de mercado do casal.
 * Liga as telas (src/ui) às regras (src/motor) e à nuvem (src/nuvem, carregada depois que a página abre).
 */
import './estilo.css';
import { iniciarUI } from './ui/app.ts';
import { mostrarCarregando } from './ui/entrada.ts';

const folha = document.createElement('div');
folha.id = 'folha';
document.body.appendChild(folha);

iniciarUI();

if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) {
  const { iniciarDemo } = await import('./ui/demo.ts');
  iniciarDemo();
} else {
  mostrarCarregando();
  const { iniciarNuvem, vigiarInternet } = await import('./ui/nuvem.ts');
  vigiarInternet();
  await iniciarNuvem();
}
