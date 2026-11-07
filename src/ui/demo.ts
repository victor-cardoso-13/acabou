/**
 * Modo de teste no computador (só no "npm run dev", com ?demo): a casa fica na memória, sem login nem nuvem.
 * Serve para os prints e para conferir as telas. NÃO existe no site publicado.
 */
import { aplicar, casaInicial, criarMercado, marcarFalta } from '../motor/casa.ts';
import { aplicarPrecos, anotar, novaAnotacao, novoIdPreco, type Precos } from '../motor/precos.ts';
import { APAGAR } from '../motor/tipos.ts';
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
  // o 2º mercado (exemplo): copia os corredores do Shibata; ovos e filtro ficam "sem corredor" lá
  const sams = criarMercado(c, "Sam's Club", 'https://www.samsclub.com.br', 'shibata', 'sams');
  c = aplicar(c, sams.escritas);
  c = aplicar(c, { 'itens.ovos.cor.sams': APAGAR, 'itens.filtro.cor.sams': APAGAR, cidade: 'São José dos Campos (SP)' });
  // preços de exemplo (inventados)
  let precos: Precos = {};
  const nota = (item: string, merc: string, centavos: number, emb: string, marca: string, diasAtras: number, fonte: string) => {
    const t = agora - diasAtras * 86_400_000;
    precos = aplicarPrecos(precos, anotar(precos, [[novoIdPreco(t), novaAnotacao({ item, centavos, emb, marca, merc, fonte, por: 'u1' }, t)]], agora));
  };
  nota('ovos', 'shibata', 899, '20 un', 'Cami', 0, 'Claude'); nota('ovos', 'sams', 1198, '20 un', "Member's Mark", 0, 'Claude');
  nota('leiteint', 'shibata', 479, '1 L', 'Italac', 1, 'Ana'); nota('leiteint', 'sams', 548, '1 L', 'Parmalat', 1, 'Ana');
  nota('alho', 'shibata', 598, '~200 g a granel', '', 0, 'Claude'); nota('alho', 'sams', 3298, '500 g', "Member's Mark", 0, 'Claude');
  nota('detergente', 'shibata', 179, '500 ml', 'Limpol', 2, 'Victor'); nota('detergente', 'sams', 1498, '6 x 500 ml', 'Limpol', 2, 'Victor');
  nota('filtro', 'shibata', 509, '30 un', 'Melitta', 0, 'Claude');
  nota('cafe', 'shibata', 1890, '500 g', 'Pilão', 12, 'Victor'); nota('cafe', 'sams', 3190, '1 kg', 'Pilão', 12, 'Victor');
  S.precos = precos;
  S.repoPrecos = { gravar: () => {} };
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
