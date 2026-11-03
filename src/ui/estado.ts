/**
 * O que a tela sabe agora: quem sou eu, a casa (cópia local, atualizada ao vivo pela nuvem),
 * a aba aberta... e `fazer()`, o único caminho de uma ação até a nuvem.
 */
import { aplicar, inverso, lerCasa } from '../motor/casa.ts';
import type { Casa, Escritas, TipoLista } from '../motor/tipos.ts';
import { acabouDeEntrar, inicioDasCompras } from '../motor/casa.ts';

export type Aba = 'casa' | 'mercado' | 'organizar';

export interface Eu { uid: string; email: string; nome: string }

/** Quem guarda as escritas: a nuvem (Firebase) ou, no modo de teste do computador, a memória. */
export interface Repo { gravar(escritas: Escritas): void }

export const S = {
  eu: null as Eu | null,
  casa: null as Casa | null,
  aba: 'casa' as Aba,
  org: 'corredores' as TipoLista,
  filtro: '',
  /** "corredores:acougue": qual cartão do Organizar está aberto no "ver" */
  aberta: null as string | null,
  /** cartão que acabou de mexer (pisca) */
  mexeu: null as string | null,
  /** produtos que o outro marcou agora, durante as minhas compras (animação de chegada) */
  recem: new Set<string>(),
  semInternet: false,
  repo: null as Repo | null,
};

let renderizar: () => void = () => {};
export const ligarRender = (f: () => void) => { renderizar = f; };
export const render = () => renderizar();

let avisador: (texto: string, rotulo?: string, acao?: () => void) => void = () => {};
export const ligarAviso = (f: typeof avisador) => { avisador = f; };
export const avisar = (texto: string, rotulo?: string, acao?: () => void) => avisador(texto, rotulo, acao);

export const casa = (): Casa => S.casa!;
export const meuUid = (): string => S.eu?.uid ?? '';
export const meuNome = (): string => S.eu?.nome ?? '';

/**
 * Faz uma ação: muda a cópia local na hora (a tela responde sem esperar a internet) e manda
 * SÓ os campos mexidos para a nuvem, numa gravação só. Com `desfazer`, o aviso ganha o botão Desfazer.
 */
export function fazer(escritas: Escritas, mensagem?: string, desfazer = false): void {
  if (!S.casa || Object.keys(escritas).length === 0) return;
  const volta = inverso(S.casa, escritas);
  S.casa = aplicar(S.casa, escritas);
  S.repo?.gravar(escritas);
  if (mensagem) avisar(mensagem, desfazer ? 'Desfazer' : undefined, desfazer ? () => fazer(volta) : undefined);
  render();
}

/**
 * Chegou uma versão nova da casa (do outro celular ou do cache). Se o outro marcou algo
 * enquanto eu estou no mercado, avisa e faz o item piscar.
 */
export function receberCasa(dados: unknown): void {
  const nova = lerCasa(dados);
  const agora = Date.now();
  const inicio = S.eu ? inicioDasCompras(nova, S.eu.uid, agora) : null;
  const antes = S.casa;
  if (antes && S.eu && inicio !== null) {
    const jaTinha = (id: string) => antes.itens[id] ? acabouDeEntrar(antes.itens[id]!, S.eu!.uid, inicio) : false;
    for (const [id, i] of Object.entries(nova.itens)) {
      if (acabouDeEntrar(i, S.eu.uid, inicio) && !jaTinha(id)) {
        S.recem.add(id);
        setTimeout(() => { S.recem.delete(id); }, 1700);
        avisar(`${i.quem || 'Alguém'} lembrou: ${i.nome}`);
      }
    }
  }
  S.casa = nova;
  render();
}

export const NOMES_DAS_ABAS: Record<Aba, string> = { casa: 'Em casa', mercado: 'Mercado', organizar: 'Organizar' };
