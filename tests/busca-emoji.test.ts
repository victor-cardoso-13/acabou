import { describe, expect, it } from 'vitest';
import { combina, mesmoNome, semAcento } from '../src/motor/busca.ts';
import { DICA, EMOJIS, primeiroEmoji, sugerirEmoji } from '../src/motor/emoji.ts';
import { formatarQuando } from '../src/motor/tempo.ts';
import { casaInicial, listarItens } from '../src/motor/casa.ts';

describe('busca sem acento e sem maiúscula', () => {
  it('semAcento', () => {
    expect(semAcento('  Açúcar CRISTAL ')).toBe('acucar cristal');
    expect(semAcento('Feijão')).toBe('feijao');
  });
  it('acha pedaço do nome', () => {
    expect(combina('Açúcar cristal', 'acuc')).toBe(true);
    expect(combina('Açúcar cristal', 'CRIS')).toBe(true);
    expect(combina('Açúcar cristal', 'sal')).toBe(false);
    expect(combina('Qualquer', '')).toBe(true);
  });
  it('no catálogo: "pao" acha pães; "ovo" acha Ovos', () => {
    const itens = listarItens(casaInicial('a@a.com', 'u', ''));
    expect(itens.filter(i => combina(i.nome, 'pao')).map(i => i.id)).toEqual(expect.arrayContaining(['paoforma', 'paofrances', 'paohamb', 'paoqueijo']));
    expect(itens.filter(i => combina(i.nome, 'ovo')).map(i => i.id)).toContain('ovos');
  });
  it('mesmo nome ignora acento e maiúscula', () => {
    expect(mesmoNome('Café', 'cafe')).toBe(true);
  });
});

describe('sugestão de figurinha', () => {
  it('por palavra conhecida', () => {
    expect(sugerirEmoji('Maizena')).toBe('🌽');
    expect(sugerirEmoji('Pão doce')).toBe('🍞');
    expect(sugerirEmoji('Biscoito recheado')).toBe('🍪');
  });
  it('por produto parecido; senão o carrinho', () => {
    expect(sugerirEmoji('Coxinha de frango', [{ nome: 'Coxinha da asa', ic: '🪽' }])).toBe('🍗'); // "frango" é palavra conhecida e vem antes do produto parecido
    expect(sugerirEmoji('Zorbulax', [{ nome: 'Zorbulax azul', ic: '🔵' }])).toBe('🔵');
    expect(sugerirEmoji('Zorbulax')).toBe('🛒');
    expect(sugerirEmoji('')).toBe('🛒');
  });
  it('a lista de dicas e os grupos existem', () => {
    expect(Object.keys(DICA).length).toBeGreaterThan(30);
    expect(EMOJIS.length).toBe(8);
  });
});

describe('pegar o 1º emoji digitado', () => {
  it('emoji simples', () => expect(primeiroEmoji('🍎')).toBe('🍎'));
  it('só o primeiro, mesmo que venham vários', () => expect(primeiroEmoji('🍎🍌')).toBe('🍎'));
  it('composto (família)', () => expect(primeiroEmoji('👨‍👩‍👧')).toBe('👨‍👩‍👧'));
  it('com tom de pele', () => expect(primeiroEmoji('👍🏽')).toBe('👍🏽'));
  it('com variação (coração, pimenta)', () => {
    expect(primeiroEmoji('❤️')).toBe('❤️');
    expect(primeiroEmoji('🌶️')).toBe('🌶️');
  });
  it('bandeira', () => expect(primeiroEmoji('🇧🇷')).toBe('🇧🇷'));
  it('texto que não é emoji não é aceito', () => {
    expect(primeiroEmoji('abc')).toBeNull();
    expect(primeiroEmoji('')).toBeNull();
    expect(primeiroEmoji('123')).toBeNull();
  });
  it('emoji no meio do texto: pega o emoji', () => expect(primeiroEmoji('oi 🍕')).toBe('🍕'));
});

describe('quando', () => {
  const agora = new Date(2026, 10, 3, 15, 0, 0).getTime();
  it('agora, hora de hoje, ontem, dias', () => {
    expect(formatarQuando(agora - 30_000, agora)).toBe('agora');
    expect(formatarQuando(new Date(2026, 10, 3, 7, 15).getTime(), agora)).toBe('7h15');
    expect(formatarQuando(new Date(2026, 10, 3, 8, 2).getTime(), agora)).toBe('8h02');
    expect(formatarQuando(new Date(2026, 10, 2, 23, 0).getTime(), agora)).toBe('ontem');
    expect(formatarQuando(new Date(2026, 10, 1, 9, 0).getTime(), agora)).toBe('há 2 dias');
    expect(formatarQuando(0, agora)).toBe('');
  });
});
