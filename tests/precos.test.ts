import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aplicar, casaInicial, criarMercado, listarItens, listarMercados, marcarFalta } from '../src/motor/casa.ts';
import {
  anotar, aplicarPrecos, comparar, diasEntre, etiqueta, inversoPrecos, lerEmb, lerMedidas, lerPrecos, lerResposta, lerValor, limpar, novaAnotacao,
  novoIdPreco, porUnidadeEm, reais, textoPergunta, textoPorUnidade, LIMITES_PRECO, type Preco, type Precos,
} from '../src/motor/precos.ts';
import { APAGAR } from '../src/motor/tipos.ts';

const DIA = 86_400_000;
const AGORA = new Date(2026, 10, 7, 12, 0, 0).getTime(); // 7/nov/2026 meio-dia
const dias = (n: number) => AGORA - n * DIA;
const p = (item: string, merc: string, centavos: number, emb: string, quando = AGORA): Preco =>
  ({ item, merc, centavos, emb, marca: '', quando, fonte: 'Ana', por: 'u2' });

describe('lerValor (centavos)', () => {
  it.each([
    ['8,99', 899], ['8.99', 899], ['R$ 8,99', 899], ['R$ 1.234,50', 123450], ['1.234', 123400], ['R$ 6,98/kg', 698],
    ['5', 500], ['5,9', 590], ['12', 1200], ['0,50', 50], ['R$ 99.999,99', 9999999], ['1,234.50', 123450],
  ])('"%s" → %i', (t, c) => expect(lerValor(t)).toBe(c));
  it.each(['', 'abc', '0', '0,00', 'R$ 100.000,00', '1234567', '8,9999', '-'])('"%s" não é preço', t => expect(lerValor(t)).toBeNull());
  it('reais() escreve em reais', () => {
    expect(reais(899)).toBe('R$ 8,99');
    expect(reais(500)).toBe('R$ 5,00');
    expect(reais(123450)).toBe('R$ 1.234,50');
  });
});

describe('embalagem', () => {
  it.each([
    ['20 un', [{ q: 20, un: 'un' }]],
    ['500 g', [{ q: 0.5, un: 'kg' }]],
    ['1,3 kg', [{ q: 1.3, un: 'kg' }]],
    ['1 L', [{ q: 1, un: 'L' }]],
    ['500 ml', [{ q: 0.5, un: 'L' }]],
    ['1 dúzia', [{ q: 12, un: 'un' }]],
    ['2 dúzias', [{ q: 24, un: 'un' }]],
    ['6 x 500 ml', [{ q: 3, un: 'L' }]],
    ['5 un ~400 g', [{ q: 5, un: 'un' }, { q: 0.4, un: 'kg' }]],
    ['~200 g a granel', [{ q: 0.2, un: 'kg' }]],
    ['~1,1 kg a granel', [{ q: 1.1, un: 'kg' }]],
    ['/kg', [{ q: 1, un: 'kg' }]],
    ['1 kg', [{ q: 1, un: 'kg' }]],
    ['2 litros', [{ q: 2, un: 'L' }]],
    ['padaria', []],
  ])('"%s"', (t, esperado) => expect(lerMedidas(t)).toEqual(esperado));
  it('lerEmb = a 1ª medida', () => {
    expect(lerEmb('5 un ~400 g')).toEqual({ q: 5, un: 'un' });
    expect(lerEmb('sem nada')).toBeNull();
  });
  it('preço por unidade', () => {
    expect(porUnidadeEm(p('x', 'a', 599, '5 un ~400 g'), 'kg')).toBeCloseTo(1497.5);
    expect(porUnidadeEm(p('x', 'a', 599, '20 un'), 'kg')).toBeNull();
    expect(textoPorUnidade(p('x', 'a', 899, '20 un'))).toBe('R$ 0,45/un');
    expect(textoPorUnidade(p('x', 'a', 1890, '1 kg'))).toBe(''); // já é o preço do kg
    expect(textoPorUnidade(p('x', 'a', 1890, '500 g'))).toBe('R$ 37,80/kg');
  });
});

describe('dias', () => {
  it('conta dias de calendário', () => {
    expect(diasEntre(AGORA, AGORA)).toBe(0);
    expect(diasEntre(dias(1), AGORA)).toBe(1);
    expect(diasEntre(AGORA - 3_600_000, AGORA)).toBe(0);
    expect(diasEntre(dias(7), AGORA)).toBe(7);
    expect(diasEntre(AGORA + DIA, AGORA)).toBe(0); // relógio adiantado não dá número negativo
  });
});

describe('comparar', () => {
  const M = ['shi', 'sams'];
  it('compara pela unidade que TODOS têm: kg antes de L antes de un', () => {
    const precos: Precos = {
      a: p('pao', 'shi', 636, '5 un ~400 g'), // 15,90/kg
      b: p('pao', 'sams', 2998, '1,3 kg'),    // 23,06/kg
    };
    expect(comparar(precos, 'pao', M, AGORA).melhor).toBe('shi');
  });
  it('embalagem maior não engana: R$ 11,98 por 3 L é mais caro por litro que R$ 5,29 por 1 L', () => {
    const precos: Precos = { a: p('x', 'shi', 529, '1 L'), b: p('x', 'sams', 5748, '12 L') };
    expect(comparar(precos, 'x', M, AGORA).melhor).toBe('sams'); // 4,79/L contra 5,29/L
  });
  it('sem unidade em comum, compara o preço cheio', () => {
    const precos: Precos = { a: p('x', 'shi', 500, '20 un'), b: p('x', 'sams', 400, '1 kg') };
    expect(comparar(precos, 'x', M, AGORA).melhor).toBe('sams');
    const sem: Precos = { a: p('x', 'shi', 500, ''), b: p('x', 'sams', 400, '') };
    expect(comparar(sem, 'x', M, AGORA).melhor).toBe('sams');
  });
  it('por mercado vale a anotação MAIS NOVA, mesmo que seja mais cara', () => {
    const precos: Precos = { a: p('x', 'shi', 300, '1 L', dias(3)), b: p('x', 'shi', 900, '1 L', dias(1)), c: p('x', 'sams', 500, '1 L') };
    const c = comparar(precos, 'x', M, AGORA);
    expect(c.por.shi!.centavos).toBe(900);
    expect(c.melhor).toBe('sams');
  });
  it('no mesmo instante vence a última gravada (o id maior)', () => {
    const a = novoIdPreco(AGORA), b = novoIdPreco(AGORA);
    expect(b > a).toBe(true);
    const precos: Precos = { [a]: p('x', 'shi', 300, '1 L'), [b]: p('x', 'shi', 700, '1 L'), z: p('x', 'sams', 500, '1 L') };
    expect(comparar(precos, 'x', M, AGORA).por.shi!.centavos).toBe(700);
  });
  it('ids de anotação crescem com o tempo mesmo passando de 1296 anotações', () => {
    let ant = novoIdPreco(AGORA);
    for (let k = 0; k < 3000; k++) { const n = novoIdPreco(AGORA); expect(n > ant).toBe(true); ant = n; }
    expect(novoIdPreco(AGORA + 1) > ant).toBe(true);
    expect(ant).toMatch(/^[A-Za-z0-9]+$/);
  });
  it('só entram preços de até 7 dias', () => {
    const velho: Precos = { a: p('x', 'shi', 300, '1 L', dias(8)), b: p('x', 'sams', 500, '1 L') };
    const c = comparar(velho, 'x', M, AGORA);
    expect(c.melhor).toBeNull();
    expect(c.por.shi).toBeDefined(); // continua aparecendo (apagado), só não entra na comparação
    const limite: Precos = { a: p('x', 'shi', 300, '1 L', dias(7)), b: p('x', 'sams', 500, '1 L') };
    expect(comparar(limite, 'x', M, AGORA).melhor).toBe('shi');
  });
  it('menos de 2 mercados com preço = sem "melhor"', () => {
    expect(comparar({ a: p('x', 'shi', 300, '1 L') }, 'x', M, AGORA).melhor).toBeNull();
    expect(comparar({}, 'x', M, AGORA).melhor).toBeNull();
  });
  it('preço de mercado que foi apagado ou de outro produto não entra', () => {
    const precos: Precos = { a: p('x', 'shi', 300, '1 L'), b: p('x', 'apagado', 100, '1 L'), c: p('y', 'sams', 100, '1 L') };
    expect(comparar(precos, 'x', M, AGORA).melhor).toBeNull();
  });
  it('empate exato = ninguém é "mais barato"', () => {
    expect(comparar({ a: p('x', 'shi', 500, '1 L'), b: p('x', 'sams', 500, '1 L') }, 'x', M, AGORA).melhor).toBeNull();
  });
  it('etiqueta da tela Mercado', () => {
    const precos: Precos = { a: p('x', 'shi', 300, '1 L'), b: p('x', 'sams', 500, '1 L'), c: p('y', 'shi', 100, '1 L') };
    const c = comparar(precos, 'x', M, AGORA);
    expect(etiqueta(c, 'shi', AGORA)!.tipo).toBe('melhor');
    const outro = etiqueta(c, 'sams', AGORA)!;
    expect(outro).toMatchObject({ tipo: 'outro', outroMerc: 'shi' });
    expect(etiqueta(comparar(precos, 'y', M, AGORA), 'shi', AGORA)!.tipo).toBe('aqui');
    expect(etiqueta(comparar(precos, 'y', M, AGORA), 'sams', AGORA)).toBeNull();
    expect(etiqueta(comparar({ a: p('x', 'shi', 100, '1 L', dias(9)) }, 'x', M, AGORA), 'shi', AGORA)).toBeNull(); // antigo: sem etiqueta
  });
});

describe('guardar e limpar', () => {
  it('guarda no máximo 3 por produto e mercado e apaga o que passou de 90 dias, na mesma gravação', () => {
    const atual: Precos = {
      velho: p('x', 'shi', 100, '', dias(91)),
      a: p('x', 'shi', 100, '', dias(10)), b: p('x', 'shi', 100, '', dias(8)), c: p('x', 'shi', 100, '', dias(5)),
      outro: p('x', 'sams', 100, '', dias(40)),
    };
    const nova = novaAnotacao({ item: 'x', centavos: 700, merc: 'shi', fonte: 'Victor', por: 'u1' }, AGORA);
    const e = anotar(atual, [['n1', nova]], AGORA);
    expect(e['p.n1']).toEqual(nova);
    expect(e['p.velho']).toBe(APAGAR);
    expect(e['p.a']).toBe(APAGAR); // a 4ª mais antiga do Shibata
    expect('p.b' in e).toBe(false);
    expect('p.outro' in e).toBe(false);
    const depois = aplicarPrecos(atual, e);
    expect(Object.keys(depois).sort()).toEqual(['b', 'c', 'n1', 'outro']);
  });
  it('Desfazer devolve também o que a limpeza apagou', () => {
    const atual: Precos = { velho: p('x', 'shi', 100, '', dias(91)), a: p('x', 'shi', 100, '', dias(3)) };
    const e = anotar(atual, [['n1', novaAnotacao({ item: 'x', centavos: 700, merc: 'shi', fonte: 'V', por: 'u1' }, AGORA)]], AGORA);
    const depois = aplicarPrecos(atual, e);
    expect(depois.velho).toBeUndefined();
    expect(aplicarPrecos(depois, inversoPrecos(atual, e))).toEqual(atual);
  });
  it('o documento nunca passa de 600 anotações', () => {
    const muitos: Precos = {};
    for (let k = 0; k < 700; k++) muitos['q' + k] = p('i' + k, 'shi', 100, '', AGORA - k * 1000);
    expect(limpar(muitos, AGORA).size).toBe(LIMITES_PRECO.anotacoes);
    expect(limpar(muitos, AGORA).has('q0')).toBe(true);    // as mais novas ficam
    expect(limpar(muitos, AGORA).has('q699')).toBe(false);
  });
  it('anotação nova com texto grande é cortada (embalagem 20, marca 40)', () => {
    const a = novaAnotacao({ item: 'x', centavos: 100, emb: 'e'.repeat(99), marca: 'm'.repeat(99), merc: 'shi', fonte: 'f'.repeat(99), por: 'u' }, AGORA);
    expect(a.emb).toHaveLength(20);
    expect(a.marca).toHaveLength(40);
    expect(a.fonte).toHaveLength(40);
  });
  it('lerPrecos descarta lixo e corta textos', () => {
    const r = lerPrecos({ p: {
      ok: { item: 'x', centavos: 899, emb: 'e'.repeat(50), marca: 'm', merc: 'shi', quando: 5, fonte: 'Ana', por: 'u' },
      semCentavos: { item: 'x', merc: 'shi', quando: 5 }, decimal: { item: 'x', centavos: 8.5, merc: 'shi', quando: 5 },
      grande: { item: 'x', centavos: 99_999_999_999, merc: 'shi', quando: 5 }, 'a.b': { item: 'x', centavos: 5, merc: 'shi', quando: 5 },
      itemRuim: { item: 'a.b', centavos: 5, merc: 'shi', quando: 5 }, texto: 'oi', zero: { item: 'x', centavos: 0, merc: 'shi', quando: 5 },
    } });
    expect(Object.keys(r)).toEqual(['ok']);
    expect(r.ok!.emb).toHaveLength(20);
    expect(lerPrecos(null)).toEqual({});
    expect(lerPrecos({ p: [1] })).toEqual({});
  });
});

/* ---------- a resposta colada ---------- */
function cenario() {
  let c = casaInicial('v@x.com', 'u1', 'Victor');
  c = aplicar(c, criarMercado(c, "Sam's Club", 'https://www.samsclub.com.br', 'shibata', 'sams').escritas);
  for (const id of ['alho', 'filtro', 'paofrances', 'banana', 'leiteint', 'ovos', 'detergente']) c = aplicar(c, marcarFalta(c, id, 'V', 'u1', AGORA));
  return { c, itens: listarItens(c), mercados: listarMercados(c) };
}
const nomeDe = (itens: ReturnType<typeof listarItens>, id: string) => itens.find(i => i.id === id)!.nome;

describe('lerResposta — a resposta de verdade do Claude (2026-11-07)', () => {
  const texto = readFileSync(new URL('./dados/resposta-real-claude.txt', import.meta.url), 'utf8');
  const { c, itens, mercados } = cenario();
  const r = lerResposta(texto, itens, mercados);
  const preco = (item: string, merc: string) => r.anotacoes.find(a => a.item === item && a.merc === merc);

  it('lê 12 preços (7 do Shibata e 5 do Sam’s; filtro e banana "não achei" no Sam’s)', () => {
    expect(r.erro).toBeNull();
    expect(r.anotacoes).toHaveLength(12);
  });
  it('o apóstrofo curvo de "Sam’s Club" acha o mercado "Sam\'s Club"', () => {
    expect(preco('alho', 'sams')).toMatchObject({ centavos: 3298 });
  });
  it('a vírgula decimal dentro dos parênteses ("1,3 kg") não separa embalagem e marca', () => {
    expect(preco('paofrances', 'sams')).toMatchObject({ centavos: 2998, emb: '1,3 kg', marca: 'Member’s Mark' });
    expect(preco('paofrances', 'shibata')).toMatchObject({ centavos: 636, emb: '5 un ~400 g', marca: 'padaria da loja' });
    expect(preco('banana', 'shibata')).toMatchObject({ centavos: 989, emb: '~1,1 kg a granel', marca: '' });
    expect(preco('alho', 'shibata')).toMatchObject({ emb: '~200 g a granel', marca: '' }); // "sem marca" não vira marca
    expect(preco('detergente', 'sams')).toMatchObject({ centavos: 1498, emb: '6 x 500 ml', marca: 'Limpol' });
  });
  it('"não achei" não vira preço', () => {
    expect(preco('filtro', 'sams')).toBeUndefined();
    expect(preco('banana', 'sams')).toBeUndefined();
    expect(preco('filtro', 'shibata')).toMatchObject({ centavos: 509, emb: '30 un', marca: 'Melitta' });
  });
  it('nome da linha achado pelo "contém": "Filtro de café nº 100" → Filtro de café; "Ovos" → Ovos', () => {
    expect(preco('filtro', 'shibata')).toBeDefined();
    expect(nomeDe(itens, 'ovos')).toBe('Ovos');
    expect(preco('ovos', 'shibata')).toMatchObject({ centavos: 899, emb: '20 un', marca: 'Cami' });
  });
  it('resultado esperado: alho, pão francês, leite, ovos e detergente "mais barato no Shibata"; filtro e banana sem comparação', () => {
    const precos: Precos = {};
    r.anotacoes.forEach((a, k) => { precos[`p${k}`] = { ...a, quando: AGORA, fonte: 'Claude', por: 'u1' }; });
    const ids = mercados.map(m => m.id);
    const melhor = (item: string) => comparar(precos, item, ids, AGORA).melhor;
    for (const item of ['alho', 'paofrances', 'leiteint', 'ovos', 'detergente']) expect(melhor(item)).toBe('shibata');
    expect(melhor('filtro')).toBeNull();
    expect(melhor('banana')).toBeNull();
    // e na tela Mercado (comprando no Sam's), cada um dos 5 ganha "mais barato no Shibata"
    for (const item of ['alho', 'ovos']) expect(etiqueta(comparar(precos, item, ids, AGORA), 'sams', AGORA)).toMatchObject({ tipo: 'outro', outroMerc: 'shibata' });
    expect(c.mercados.sams!.nome).toBe("Sam's Club");
  });
});

describe('lerResposta — variações', () => {
  const { itens, mercados } = cenario();
  const linhas = 'Ovos | Shibata: R$ 8,99 (20 un, Cami) | Sam\'s Club: R$ 11,98 (20 un, Member\'s Mark)';
  const quantos = (t: string) => lerResposta(t, itens, mercados);
  it.each(['ACABOU', '**ACABOU**', '# ACABOU', 'ACABOU:', '  ## **ACABOU**  ', 'acabou'])('aceita a linha "%s"', cab => {
    expect(quantos(`Conversa...\n\n${cab}\n${linhas}`).anotacoes).toHaveLength(2);
  });
  it('com negrito nos nomes, marcadores e numeração', () => {
    expect(quantos(`ACABOU\n- **Ovos** | **Shibata**: R$ 8,99 (20 un, Cami)`).anotacoes).toHaveLength(1);
    expect(quantos(`ACABOU\n1. Ovos | Shibata: R$ 8,99`).anotacoes[0]).toMatchObject({ centavos: 899, emb: '', marca: '' });
  });
  it('sem a parte ACABOU', () => {
    expect(quantos(`Ovos | Shibata: R$ 8,99`)).toEqual({ erro: 'sem-bloco', anotacoes: [] });
    expect(quantos('')).toEqual({ erro: 'sem-bloco', anotacoes: [] });
    expect(quantos('Eu escrevi ACABOU no meio da frase\nOvos | Shibata: R$ 8,99').erro).toBe('sem-bloco');
  });
  it('ACABOU achado, mas nada bate: produto desconhecido, mercado desconhecido, tudo "não achei"', () => {
    expect(quantos('ACABOU\nCarro | Shibata: R$ 8,99').erro).toBe('nada-bate');
    expect(quantos('ACABOU\nOvos | Zé do Armazém: R$ 8,99').erro).toBe('nada-bate');
    expect(quantos('ACABOU\nOvos | Shibata: não achei | Sam\'s Club: Não achei').erro).toBe('nada-bate');
    expect(quantos('ACABOU\n').erro).toBe('nada-bate');
  });
  it('"contém" só vale para itens que estão na lista agora', () => {
    // "Café" é um produto que NÃO está na lista: "Café torrado e moído" não pode virar "Café"
    expect(quantos('ACABOU\nCafé torrado e moído | Shibata: R$ 18,90 (500 g)').erro).toBe('nada-bate');
    // exato vale para qualquer produto, na lista ou não
    expect(quantos('ACABOU\nCafé | Shibata: R$ 18,90 (500 g)').anotacoes).toHaveLength(1);
  });
  it('no "contém" escolhe o produto de nome mais específico', () => {
    const r = lerResposta('ACABOU\nFiltro de café nº 100 | Shibata: R$ 5,09 (30 un)', itens, mercados);
    expect(r.anotacoes[0]!.item).toBe('filtro');
  });
  it('linhas a mais, linhas sem "|", preço inválido e linha repetida (vale a última)', () => {
    const r = quantos(`ACABOU\nBom proveito!\nOvos | Shibata: R$ 8,99 (20 un)\nOvos | Shibata: R$ 7,50 (20 un)\nOvos | Sam's Club: R$ 0,00\nOvos | Sam's Club: de graça`);
    expect(r.anotacoes).toHaveLength(1);
    expect(r.anotacoes[0]).toMatchObject({ centavos: 750 });
  });
  it('preço por kg "R$ 6,98/kg" vira embalagem "1 kg"', () => {
    expect(quantos('ACABOU\nBanana prata | Shibata: R$ 6,98/kg').anotacoes[0]).toMatchObject({ centavos: 698, emb: '1 kg' });
  });
  it('texto enorme: lê só os primeiros 20 mil caracteres e 200 linhas', () => {
    const lixo = 'x'.repeat(30_000);
    expect(quantos(`${lixo}\nACABOU\n${linhas}`).erro).toBe('sem-bloco'); // o ACABOU está depois do limite
    const muitas = `ACABOU\n${'bla | bla\n'.repeat(200)}${linhas}`; // a linha boa é a 201ª depois do ACABOU
    expect(quantos(muitas).erro).toBe('nada-bate');
    const gigante = `ACABOU\n${linhas}\n${'a'.repeat(1_000_000)}`;
    expect(quantos(gigante).anotacoes).toHaveLength(2);
  });
  it('marca e embalagem ficam dentro dos limites', () => {
    const r = quantos(`ACABOU\nOvos | Shibata: R$ 8,99 (${'e'.repeat(80)} un, ${'m'.repeat(200)})`);
    expect(r.anotacoes[0]!.emb.length).toBeLessThanOrEqual(20);
    expect(r.anotacoes[0]!.marca.length).toBeLessThanOrEqual(40);
  });
});

describe('textoPergunta', () => {
  const lista = [{ nome: 'Ovos' }, { nome: 'Alho' }];
  const dois = [{ nome: 'Shibata', site: 'https://www.loja.shibata.com.br' }, { nome: "Sam's Club", site: '' }];
  it('traz cidade, lista, mercados com os sites e o pedido do bloco ACABOU', () => {
    const t = textoPergunta('São José dos Campos (SP)', lista, dois);
    expect(t).toContain('Moro em São José dos Campos (SP).');
    expect(t).toContain('- Ovos\n- Alho');
    expect(t).toContain('Compare os preços desses itens no Shibata e no Sam\'s Club.');
    expect(t).toContain('- Shibata: https://www.loja.shibata.com.br');
    expect(t).toContain('- Sam\'s Club: (sem site)');
    expect(t).toContain('"não achei" em vez de chutar');
    expect(t).toContain('por unidade de medida');
    expect(t).toContain('uma linha só com a palavra ACABOU');
    expect(t).toContain('item | Shibata: R$ preço (embalagem, marca) | Sam\'s Club: R$ preço (embalagem, marca)');
    expect(t).toContain('Exemplo: Ovos | Shibata: R$ 8,99 (20 un, Mantiqueira) | Sam\'s Club: R$ 9,49 (20 un, Cami)');
  });
  it('a resposta que segue o exemplo da própria pergunta é lida de volta', () => {
    const { itens, mercados } = cenario();
    const t = textoPergunta('X', lista, [{ nome: 'Shibata', site: '' }, { nome: "Sam's Club", site: '' }]);
    const exemplo = t.slice(t.indexOf('Exemplo: ') + 9).split('\n')[0]!;
    expect(lerResposta(`ACABOU\n${exemplo}`, itens, mercados).anotacoes).toHaveLength(2);
  });
  it('com 3 mercados e com 1 mercado só (logo depois da migração), sem cidade, sem lista', () => {
    const tres = textoPergunta('X', lista, [...dois, { nome: 'Atacadão', site: 'https://a.com' }]);
    expect(tres).toContain('no Shibata, no Sam\'s Club e no Atacadão.');
    const um = textoPergunta('', [], [dois[0]!]);
    expect(um.startsWith('Preciso comprar:\n- (a lista está vazia)')).toBe(true);
    expect(um).not.toContain('Compare');
    expect(um).not.toContain('dividir a compra');
    expect(um).not.toContain('Sam');
  });
});
