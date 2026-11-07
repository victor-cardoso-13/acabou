/**
 * O que a tela sabe agora: quem sou eu, a casa (cópia local, atualizada ao vivo pela nuvem),
 * a aba aberta... e `fazer()`, o único caminho de uma ação até a nuvem.
 */
import {
  acabouDeEntrar, aplicar, inicioDasCompras, inverso, lerCasa, mercadoDasCompras, mercadoEscolhido, registrarNome,
} from '../motor/casa.ts';
import { aplicarPrecos, inversoPrecos, type Precos } from '../motor/precos.ts';
import type { Alvo, Casa, Escritas, MercadoComId, TipoLista } from '../motor/tipos.ts';

export type Aba = 'casa' | 'mercado' | 'precos' | 'organizar';

export interface Eu { uid: string; email: string; nome: string }

/** Quem guarda as escritas: a nuvem (Firebase) ou, no modo de teste do computador, a memória. */
export interface Repo { gravar(escritas: Escritas): void }

/** O mercado que este aparelho escolheu por último (só uma preferência: um id, nada pessoal). */
const CHAVE_MERCADO = 'acabou.mercado';
export const lembrarMercado = (): string | null => { try { return localStorage.getItem(CHAVE_MERCADO); } catch { return null; } };
const guardarMercado = (id: string): void => { try { localStorage.setItem(CHAVE_MERCADO, id); } catch { /* sem armazenamento: tudo bem */ } };

export const S = {
  eu: null as Eu | null,
  casa: null as Casa | null,
  aba: 'casa' as Aba,
  org: 'corredores' as TipoLista,
  filtro: '',
  /** Preços: procurar produto na aba */
  filtroPreco: '',
  /** mercado escolhido neste aparelho (fora das compras) e o que está aberto em Organizar */
  mercadoSel: lembrarMercado() as string | null,
  orgMercado: null as string | null,
  /** os preços anotados (documento separado) e quem os guarda */
  precos: {} as Precos,
  repoPrecos: null as Repo | null,
  /** "corredores:acougue": qual cartão do Organizar está aberto no "ver" */
  aberta: null as string | null,
  /** cartão que acabou de mexer (pisca) */
  mexeu: null as string | null,
  /** produtos que o outro marcou agora, durante as minhas compras (animação de chegada) */
  recem: new Set<string>(),
  semInternet: false,
  repo: null as Repo | null,
  /** convidar alguém (só existe com a nuvem ligada) */
  convidar: null as ((email: string) => Promise<string>) | null,
  /** guarda o nome na conta (só com a nuvem ligada) */
  guardarNome: null as ((nome: string) => Promise<void>) | null,
  /** texto de erro simples para mostrar na tela */
  mensagemErro: (_e: unknown): string => 'Algo deu errado. Tente de novo daqui a pouco.',
};

let renderizar: () => void = () => {};
export const ligarRender = (f: () => void) => { renderizar = f; };
export const render = () => renderizar();

let avisador: (texto: string, rotulo?: string, acao?: () => void) => void = () => {};
export const ligarAviso = (f: typeof avisador) => { avisador = f; };
export const avisar = (texto: string, rotulo?: string, acao?: () => void) => avisador(texto, rotulo, acao);

export const casa = (): Casa => S.casa!;

/** Onde estou comprando (se estou) ou o mercado escolhido neste aparelho. */
export function mercadoAtual(): MercadoComId | undefined {
  const c = S.casa;
  if (!c) return undefined;
  return mercadoDasCompras(c, meuUid(), Date.now()) ?? mercadoEscolhido(c, S.mercadoSel);
}
export function escolherMercado(id: string): void { S.mercadoSel = id; guardarMercado(id); render(); }
/** O mercado aberto em Organizar → Corredores. */
export const mercadoOrg = (): MercadoComId | undefined => (S.casa ? mercadoEscolhido(S.casa, S.orgMercado) : undefined);
/** Onde mexer agora em Organizar: as categorias ou os corredores do mercado aberto. */
export function alvoOrg(tipo: TipoLista = S.org): Alvo {
  return tipo === 'categorias' ? { tipo } : { tipo, mercado: mercadoOrg()?.id ?? '' };
}
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

/** Anotar/apagar preços: igual a `fazer`, mas no documento de preços. */
export function fazerPrecos(escritas: Escritas, mensagem?: string, desfazer = false): void {
  if (Object.keys(escritas).length === 0) return;
  const volta = inversoPrecos(S.precos, escritas);
  S.precos = aplicarPrecos(S.precos, escritas);
  S.repoPrecos?.gravar(escritas);
  if (mensagem) avisar(mensagem, desfazer ? 'Desfazer' : undefined, desfazer ? () => fazerPrecos(volta) : undefined);
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

/** Muda o meu nome: na conta, na casa (círculo do outro celular) e na tela. */
export function mudarMeuNome(nome: string): void {
  if (!S.eu || !S.casa) return;
  S.eu = { ...S.eu, nome };
  void S.guardarNome?.(nome).catch(() => {});
  fazer(registrarNome(S.casa, S.eu.uid, nome), 'Nome salvo');
}

export const NOMES_DAS_ABAS: Record<Aba, string> = { casa: 'Em casa', mercado: 'Mercado', precos: 'Preços', organizar: 'Organizar' };
