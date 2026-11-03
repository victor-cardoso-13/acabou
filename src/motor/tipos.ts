/**
 * Os tipos da casa de Acabou!. Este é o formato do documento que fica no Firebase em casas/{casaId}.
 * O motor (src/motor) não sabe que existe tela nem internet.
 */

/** Uma categoria da casa ou um corredor do mercado. */
export interface Lista {
  id: string;
  nome: string;
  ic: string;
}

export interface Item {
  nome: string;
  ic: string;
  /** id da categoria da casa (null = "Sem categoria") */
  cat: string | null;
  /** id do corredor do mercado (null = "Sem corredor") */
  cor: string | null;
  /** o produto está faltando em casa (entrou na lista do mercado) */
  falta: boolean;
  /** nome de quem marcou "falta" e o uid dessa pessoa */
  quem: string;
  por: string;
  /** quando marcou (milissegundos, relógio do aparelho) */
  quando: number;
  /** já está no carrinho (só vale durante as compras) e a que horas foi pego (para a ordem dos corredores) */
  carrinho: boolean;
  pegouEm: number;
  /** "não tinha na prateleira": continua na lista para a próxima compra */
  semEstoque: boolean;
  /** posição de criação: a ordem dos botões dentro da categoria */
  ordem: number;
}

export interface Casa {
  /** e-mails (minúsculos) de quem pode ver e mexer na casa. No máximo 4. */
  membros: string[];
  corredores: Lista[];
  categorias: Lista[];
  itens: Record<string, Item>;
  /** uid → hora em que a pessoa tocou em "Estou no mercado" */
  noMercado: Record<string, number>;
  /** uid → primeiro nome (para o círculo com a letra de cada pessoa) */
  nomes: Record<string, string>;
  /** "Aprender a ordem sozinho" (começa desligado) */
  aprender: boolean;
}

export type TipoLista = 'corredores' | 'categorias';
export type ItemComId = Item & { id: string };

/** Marca "apague este campo" dentro de um conjunto de escritas. */
export const APAGAR = Symbol('apagar');

/**
 * Um conjunto de escritas = o que mudou, como caminhos do Firestore:
 *   { 'itens.cafe.falta': true, 'itens.cafe.quem': 'Ana' }
 * Cada ação do app vira UM conjunto, gravado de uma vez só (só os campos mexidos:
 * dois toques ao mesmo tempo em produtos diferentes nunca se apagam).
 */
export type Escritas = Record<string, unknown>;

/** Limites de tamanho (o app aplica; as regras do Firebase só conseguem limitar a lista toda). */
export const LIMITES = {
  nome: 40,
  figurinha: 16,
  email: 120,
  membros: 4,
  listas: 40,
  itens: 400,
} as const;
