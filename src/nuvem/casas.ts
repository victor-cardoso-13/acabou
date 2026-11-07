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
  arrayUnion, collection, connectFirestoreEmulator, deleteField, doc, getDoc, initializeFirestore, onSnapshot,
  persistentLocalCache, persistentMultipleTabManager, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { app, usandoEmulador } from './conta.ts';
import { gerarCodigoConvite } from '../motor/casa.ts';
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
  /** esta leitura veio só da memória do aparelho (ainda não falou com o servidor) */
  deCache: boolean;
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
      .map(d => ({ id: d.id, dados: d.data(), pendente: d.metadata.hasPendingWrites, deCache: d.metadata.fromCache }))
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

/* ---------- preços ----------
 * Documento separado, casas/{casaId}/dados/precos = { p: { <id>: anotação } }, para não engordar o da casa.
 * O documento ainda não existe até a 1ª anotação: por isso a gravação usa setDoc com merge (updateDoc falharia).
 * As escritas do motor ("p.<id>") viram o objeto aninhado { p: { <id>: valor | deleteField() } }.
 */
const refPrecos = (casaId: string) => doc(banco, COLECAO, casaId, 'dados', 'precos');

export function observarPrecos(casaId: string, fn: (dados: unknown) => void, erro: (e: unknown) => void): Unsubscribe {
  return onSnapshot(refPrecos(casaId), snap => fn(snap.exists() ? snap.data() : {}), erro);
}

/** Nunca dê `await` na hora do toque (sem internet a promessa só termina quando ela volta). */
export function gravarPrecos(casaId: string, escritas: Escritas): Promise<void> {
  const p: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(escritas)) if (k.startsWith('p.')) p[k.slice(2)] = v === APAGAR ? deleteField() : v;
  if (Object.keys(p).length === 0) return Promise.resolve();
  return setDoc(refPrecos(casaId), { p }, { merge: true });
}

/* ---------- convite ----------
 * Ninguém entra numa casa só porque alguém digitou o e-mail. É preciso as DUAS coisas:
 *  1. um membro gera um convite para UM e-mail (código de 10 símbolos, vale 2 dias, uma vez só);
 *  2. a pessoa entra com esse e-mail E digita o código.
 * Onde fica: convites/{código} = { casaId, email, por, criadoEm }. Só o e-mail convidado consegue ler (e só
 * sabendo o código); ninguém consegue listar. Regras em Jogos/Computador/firestore.rules.
 */
export async function criarConvite(casaId: string, emailConvidado: string, meuEmail: string): Promise<string> {
  const codigo = gerarCodigoConvite();
  await setDoc(doc(banco, 'convites', codigo), { casaId, email: emailConvidado, por: meuEmail, criadoEm: serverTimestamp() });
  return codigo;
}

/**
 * Entra na casa com o código. Uma gravação só (tudo ou nada): registra a entrada, põe o e-mail em `membros`
 * e gasta o convite. Devolve o id da casa. Qualquer problema (código errado, de outro e-mail, vencido ou
 * já usado) dá o mesmo erro, para não ensinar nada a quem está chutando.
 */
export async function entrarPorConvite(codigo: string, meuEmail: string, meuUid: string): Promise<string> {
  const invalido = () => Object.assign(new Error('convite'), { code: 'acabou/convite-invalido' });
  try {
    const convite = await getDoc(doc(banco, 'convites', codigo));
    const casaId = convite.data()?.casaId;
    if (typeof casaId !== 'string') throw invalido();
    const lote = writeBatch(banco);
    lote.set(doc(banco, 'casas', casaId, 'entradas', meuUid), { codigo, email: meuEmail });
    lote.update(doc(banco, 'casas', casaId), { membros: arrayUnion(meuEmail) });
    lote.delete(doc(banco, 'convites', codigo));
    await lote.commit();
    return casaId;
  } catch (e) {
    // recusa das regras (código errado, de outro e-mail, vencido, usado) = sempre a mesma mensagem
    if ((e as { code?: string })?.code === 'permission-denied' || (e as { code?: string })?.code === 'not-found') throw invalido();
    throw e;
  }
}
