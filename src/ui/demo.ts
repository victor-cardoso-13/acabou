/**
 * Modo de teste no computador (só no "npm run dev", com ?demo): a casa fica na memória, sem login nem nuvem.
 * Serve para os prints e para conferir as telas. NÃO existe no site publicado.
 */
import { aplicar, casaInicial, marcarFalta } from '../motor/casa.ts';
import { S, render } from './estado.ts';
import { avisar } from './estado.ts';

export function iniciarDemo(): void {
  const agora = Date.now();
  const ontem = agora - 26 * 3_600_000;
  let c = casaInicial('victor@exemplo.com', 'u1', 'Victor');
  c = aplicar(c, { membros: ['victor@exemplo.com', 'ana@exemplo.com'], 'nomes.u2': 'Ana' });
  c = aplicar(c, marcarFalta(c, 'filtro', 'Ana', 'u2', agora - 3 * 3_600_000));
  c = aplicar(c, marcarFalta(c, 'banana', 'Ana', 'u2', ontem));
  c = aplicar(c, marcarFalta(c, 'detergente', 'Victor', 'u1', agora - 5 * 3_600_000));
  c = aplicar(c, marcarFalta(c, 'paofrances', 'Victor', 'u1', ontem));
  c = aplicar(c, marcarFalta(c, 'leiteint', 'Ana', 'u2', ontem));
  c = aplicar(c, marcarFalta(c, 'alho', 'Victor', 'u1', ontem));
  S.eu = { uid: 'u1', email: 'victor@exemplo.com', nome: 'Victor' };
  S.casa = c;
  S.repo = { gravar: () => {} };
  S.convidar = async () => 'K7M2P9QXRT';
  render();
  // Para os testes de tela: window.__acabou.remoto('papel') faz a "Ana" marcar algo no celular dela.
  (window as unknown as Record<string, unknown>).__acabou = {
    remoto(id: string) {
      S.casa = aplicar(S.casa!, marcarFalta(S.casa!, id, 'Ana', 'u2', Date.now()));
      avisar(`Ana lembrou: ${S.casa!.itens[id]?.nome}`);
      render();
    },
  };
}
