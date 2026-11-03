/**
 * A casa (lista de mercado do casal) no Firestore: UM documento por casa, casas/{casaId}.
 * - quem pode ver e mexer: os e-mails em `membros` (regra em Jogos/Computador/firestore.rules);
 * - gravamos SÓ os campos mexidos (updateDoc com caminho: 'itens.cafe.falta'), então dois toques
 *   ao mesmo tempo em produtos diferentes não se apagam;
 * - onSnapshot = atualiza ao vivo; o cache offline fica ligado (mercado, garagem e rua têm sinal ruim):
 *   as marcações feitas sem internet sobem sozinhas quando ela volta.
 * Consumo esperado: dezenas de gravações por dia (a cota grátis é 20 mil, somada com os jogos).
 */
import {
  collection, connectFirestoreEmulator, deleteField, doc, initializeFirestore, onSnapshot, persistentLocalCache,
  persistentMultipleTabManager, query, setDoc, updateDoc, where, type Unsubscribe,
} from 'firebase/firestore';
import { app, usandoEmulador } from './conta.ts';
import { APAGAR, type Casa, type Escritas } from '../motor/tipos.ts';

const banco = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
if (usandoEmulador) connectFirestoreEmulator(banco, '127.0.0.1', 8189);

const COLECAO = 'casas';

export interface CasaNaNuvem {
  id: string;
  dados: unknown;
  /** há marcações feitas neste aparelho que ainda não chegaram ao servidor */
  pendente: boolean;
}

/**
 * Fica de olho na casa em que o e-mail está em `membros` (ao vivo). Quem foi adicionada depois de
 * criar a conta cai na casa assim que alguém a adiciona. Se a pessoa estiver em mais de uma casa,
 * vale a que ela mesma criou (1º e-mail da lista); senão a de menor id (sempre a mesma).
 */
export function observarCasa(email: string, fn: (c: CasaNaNuvem | null) => void, erro: (e: unknown) => void): Unsubscribe {
  const q = query(collection(banco, COLECAO), where('membros', 'array-contains', email));
  return onSnapshot(q, snap => {
    const casas = snap.docs
      .map(d => ({ id: d.id, dados: d.data(), pendente: d.metadata.hasPendingWrites }))
      .sort((a, b) => Number(donaDe(b.dados) === email) - Number(donaDe(a.dados) === email) || a.id.localeCompare(b.id));
    fn(casas[0] ?? null);
  }, erro);
}

function donaDe(dados: unknown): string {
  const m = (dados as { membros?: unknown })?.membros;
  return Array.isArray(m) && typeof m[0] === 'string' ? m[0] : '';
}

/** Cria a casa. Só pode ser criada com UM membro: quem está criando (a regra confere). */
export async function criarCasa(casa: Casa): Promise<string> {
  const ref = doc(collection(banco, COLECAO));
  await setDoc(ref, casa);
  return ref.id;
}

/** Os caminhos do motor viram os do Firestore (APAGAR → deleteField). */
export function paraFirestore(escritas: Escritas): Record<string, unknown> {
  return Object.fromEntries(Object.entries(escritas).map(([k, v]) => [k, v === APAGAR ? deleteField() : v]));
}

/**
 * Grava as escritas de uma ação, de uma vez só. NÃO espere por isto na hora do toque:
 * sem internet a promessa só termina quando a internet volta (a tela já atualizou pelo cache).
 */
export function gravar(casaId: string, escritas: Escritas): Promise<void> {
  if (Object.keys(escritas).length === 0) return Promise.resolve();
  return updateDoc(doc(banco, COLECAO, casaId), paraFirestore(escritas));
}
