/** Figurinhas (emojis): grupos do seletor, sugestão pelo nome e "pegar o 1º emoji de um texto". */
import { semAcento } from './busca.ts';

export const EMOJIS: [string, string[]][] = ([
  ['Frutas e verduras', '🍌 🍎 🍏 🍐 🍊 🍋 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🫒 🥑 🍆 🥔 🥕 🌽 🌶️ 🫑 🥒 🥬 🥦 🧄 🧅 🫛 🫜 🫚 🍄 🥜 🌰 🌿 🌱'],
  ['Padaria e café', '🍞 🥖 🥐 🥯 🫓 🧇 🥞 ☕ 🫖 🍵 🧃 🥛 🍼 🍯 🥣 🌾 🫘 🍚 🍝 🍜 🌀'],
  ['Carnes, frios e ovos', '🥩 🍖 🍗 🪽 🥓 🌭 🍔 🐟 🦐 🍤 🥚 🧀 🧈 🐔 🐓 🐄 🐖'],
  ['Comidas e molhos', '🥫 🫙 🧂 🍕 🌮 🍟 🧆 🥪 🍱 🍣 🥢 🍲 🥘 🍳 🔴 🟡 🟠 🟢 🟤 ⚪'],
  ['Doces e bebidas', '🍫 🍬 🍭 🍮 🍰 🧁 🍪 🍩 🍦 🍨 🍿 🥤 🧋 🍷 🍺 🥂 🧊 💧 🍶 🫗'],
  ['Limpeza e casa', '🧶 🥈 🎞️ 🧽 🧴 🧼 🫧 🧺 🪣 🧹 🧻 🧾 🗑️ 🧪 🦟 🌸 🐨 💡 🔋 🕯️ 🔥 🛢️ ⚗️'],
  ['Banheiro e cuidados', '🪥 🦷 🧵 👂 💨 🌬️ 🛁 🧖 👶 💊 🩹 💄 🪒 🧷'],
  ['Outros', '🛒 📦 📃 ✨ 💎 💍 💪 🐶 🐱 🎁 ⭐ ❤️ 🪵'],
] as [string, string][]).map(([t, s]) => [t, s.split(' ')]);

/** Palavra (sem acento) → figurinha sugerida para produto novo. */
export const DICA: Record<string, string> = {
  maizena: '🌽', milho: '🌽', batata: '🥔', tomate: '🍅', limao: '🍋', maca: '🍎', uva: '🍇', pimenta: '🌶️',
  oregano: '🌿', fermento: '🧁', queijo: '🧀', agua: '💧', refri: '🥤', cerveja: '🍺', vinho: '🍷',
  biscoito: '🍪', bolacha: '🍪', pipoca: '🍿', sorvete: '🍨', racao: '🐶', pilha: '🔋', aluminio: '🧻',
  pvc: '🧻', desodorante: '🧴', fio: '🦷', cotonete: '🩹', pano: '🧽', pao: '🍞', leite: '🥛', carne: '🥩',
  peixe: '🐟', doce: '🍬', bolo: '🍰', cha: '🫖', suco: '🧃', frango: '🍗', ovo: '🥚', arroz: '🍚',
  feijao: '🫘', macarrao: '🍝', farinha: '🌾', sabao: '🧼', limpeza: '🧽', fruta: '🍎', verdura: '🥬',
};

export const FIGURINHA_PADRAO = '🛒';

/**
 * Sugere uma figurinha pelo nome: 1º uma palavra conhecida, 2º um produto parecido
 * (que começa com a mesma palavra), 3º o carrinho.
 */
export function sugerirEmoji(nome: string, outros: { nome: string; ic: string }[] = []): string {
  const n = semAcento(nome);
  if (!n) return FIGURINHA_PADRAO;
  for (const p of n.split(/\s+/)) if (Object.hasOwn(DICA, p)) return DICA[p]!;
  for (const k of Object.keys(DICA)) if (n.includes(k)) return DICA[k]!;
  const primeira = n.split(' ')[0];
  const parecido = outros.find(o => semAcento(o.nome).split(' ')[0] === primeira);
  return parecido ? parecido.ic : FIGURINHA_PADRAO;
}

/**
 * O 1º emoji de um texto digitado no teclado de emojis (aceita compostos como 👨‍👩‍👧
 * e com tom de pele como 👍🏽). Texto que não é emoji → null.
 */
export function primeiroEmoji(texto: string): string | null {
  const partes = typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? [...new Intl.Segmenter('pt', { granularity: 'grapheme' }).segment(texto)].map(s => s.segment)
    : [...texto];
  const achou = partes.find(g => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g));
  return achou ?? null;
}
