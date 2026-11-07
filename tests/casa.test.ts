import { describe, expect, it } from 'vitest';
import {
  acabouDeEntrar, achar, alternarFalta, apagarLista, apagarProduto, aplicar, aprenderOrdem,
  agruparMercado, casaInicial, comecarCompras, criarLista, criarProduto, editarProduto, inicioDasCompras, inverso,
  itensFaltando, lerCasa, marcarFalta, marcarSemEstoque, moverLista, nomeDoEmail, novoId, pegar, renomearLista,
  terminarCompras, tirarFalta, gerarCodigoConvite, normalizarCodigo, mostrarCodigo, emailValido, normalizarEmail, ALFABETO_CONVITE, trocarFigurinhaLista, acharDeNovo, definirAprender, listarItens,
} from '../src/motor/casa.ts';
import { APAGAR, type Alvo } from '../src/motor/tipos.ts';

const T0 = 1_760_000_000_000;
const nova = () => casaInicial('Victor@Email.com', 'u1', 'Victor');
const CAT: Alvo = { tipo: 'categorias' };
const SHI: Alvo = { tipo: 'corredores', mercado: 'shibata' };
const faltando = (c: ReturnType<typeof nova>) => itensFaltando(c).map(i => i.id);

describe('catálogo inicial', () => {
  it('traz 11 categorias, o mercado Shibata com 13 corredores e 113 produtos, tudo "tem em casa"', () => {
    const c = nova();
    expect(c.categorias).toHaveLength(11);
    expect(Object.keys(c.mercados)).toEqual(['shibata']);
    expect(c.mercados.shibata!.corredores).toHaveLength(13);
    expect(Object.keys(c.itens)).toHaveLength(113);
    expect(faltando(c)).toEqual([]);
    expect(c.membros).toEqual(['victor@email.com']);
    expect(c.mercados.shibata!.aprender).toBe(false);
  });
  it('todo produto aponta para categoria e corredor que existem', () => {
    const c = nova();
    for (const i of Object.values(c.itens)) {
      expect(achar(c, CAT, i.cat)).toBeDefined();
      expect(achar(c, SHI, i.cor.shibata ?? null)).toBeDefined();
    }
  });
});

describe('marcar e desmarcar', () => {
  it('um toque marca "falta" e grava só os campos desse produto', () => {
    const c = nova();
    const e = marcarFalta(c, 'cafe', 'Ana', 'u2', T0);
    expect(Object.keys(e).every(k => k.startsWith('itens.cafe.'))).toBe(true);
    expect(e['itens.cafe.falta']).toBe(true);
    const d = aplicar(c, e);
    expect(d.itens.cafe).toMatchObject({ falta: true, quem: 'Ana', por: 'u2', quando: T0 });
    expect(c.itens.cafe!.falta).toBe(false); // a original não muda
  });
  it('outro toque tira da lista', () => {
    let c = aplicar(nova(), marcarFalta(nova(), 'cafe', 'Ana', 'u2', T0));
    c = aplicar(c, alternarFalta(c, 'cafe', 'Ana', 'u2', T0 + 1));
    expect(c.itens.cafe!.falta).toBe(false);
    expect(alternarFalta(nova(), 'cafe', 'x', 'y', T0)['itens.cafe.falta']).toBe(true);
  });
  it('dois toques em produtos diferentes escrevem caminhos diferentes (um não apaga o outro)', () => {
    const c = nova();
    const a = Object.keys(marcarFalta(c, 'cafe', 'A', 'u1', T0)), b = Object.keys(marcarFalta(c, 'sal', 'B', 'u2', T0));
    expect(a.filter(k => b.includes(k))).toEqual([]);
  });
  it('produto que não existe mais não vira produto "pela metade"', () => {
    expect(marcarFalta(nova(), 'fantasma', 'A', 'u', T0)).toEqual({});
    expect(tirarFalta(nova(), 'fantasma')).toEqual({});
    expect(pegar(nova(), 'fantasma', T0)).toEqual({});
  });
  it('Desfazer = as escritas inversas', () => {
    const c = nova();
    const e = marcarFalta(c, 'cafe', 'Ana', 'u2', T0);
    const volta = aplicar(aplicar(c, e), inverso(c, e));
    expect(volta).toEqual(c);
  });
  it('Desfazer de apagar produto traz o produto de volta', () => {
    const c = nova();
    const e = apagarProduto(c, 'cafe');
    const sem = aplicar(c, e);
    expect(sem.itens.cafe).toBeUndefined();
    expect(aplicar(sem, inverso(c, e))).toEqual(c);
  });
});

describe('mercado: pegar, não tinha, terminar', () => {
  const comFalta = () => {
    let c = nova();
    for (const id of ['cafe', 'sal', 'alho', 'frango']) c = aplicar(c, marcarFalta(c, id, 'Ana', 'u2', T0));
    return c;
  };
  it('pegar põe no carrinho e outro toque desfaz', () => {
    let c = comFalta();
    c = aplicar(c, pegar(c, 'cafe', T0 + 10));
    expect(c.itens.cafe).toMatchObject({ carrinho: true, pegouEm: T0 + 10 });
    c = aplicar(c, pegar(c, 'cafe', T0 + 20));
    expect(c.itens.cafe).toMatchObject({ carrinho: false, pegouEm: 0 });
  });
  it('"não tinha" tira do carrinho e deixa na lista; "achei" volta ao normal', () => {
    let c = comFalta();
    c = aplicar(c, pegar(c, 'cafe', T0));
    c = aplicar(c, marcarSemEstoque(c, 'cafe'));
    expect(c.itens.cafe).toMatchObject({ semEstoque: true, carrinho: false, falta: true });
    c = aplicar(c, acharDeNovo(c, 'cafe'));
    expect(c.itens.cafe!.semEstoque).toBe(false);
  });
  it('terminar: o que está no carrinho volta a "tem em casa"; não tinha e o resto continuam na lista', () => {
    let c = comFalta();
    c = aplicar(c, comecarCompras('u1', T0, 'shibata'));
    c = aplicar(c, pegar(c, 'cafe', T0 + 1));
    c = aplicar(c, pegar(c, 'sal', T0 + 2));
    c = aplicar(c, marcarSemEstoque(c, 'alho'));
    const { escritas, resumo } = terminarCompras(c, 'u1', 'shibata');
    expect(resumo.pegos.map(i => i.id)).toEqual(['cafe', 'sal']);
    expect(resumo.semEstoque.map(i => i.id)).toEqual(['alho']);
    expect(resumo.restaram.map(i => i.id)).toEqual(['frango']);
    const f = aplicar(c, escritas);
    expect(faltando(f).sort()).toEqual(['alho', 'frango']);
    expect(f.itens.alho!.semEstoque).toBe(false);
    expect(f.noMercado.u1).toBeUndefined();
    expect(escritas['mercados.shibata.corredores']).toBeUndefined(); // aprender desligado: não mexe na ordem
  });
  it('agrupa por corredor na ordem definida, "Sem corredor" no fim', () => {
    let c = comFalta();
    c = aplicar(c, { 'itens.sal.cor.shibata': APAGAR });
    const g = agruparMercado(c, itensFaltando(c), 'shibata');
    const ids = g.map(x => x.corredor?.id ?? null);
    expect(ids[ids.length - 1]).toBeNull();
    expect(ids.indexOf('horti')).toBeLessThan(ids.indexOf('acougue'));
    expect(ids.indexOf('acougue')).toBeLessThan(ids.indexOf('cafe'));
    expect(g[0]!.numero).toBe(2); // Hortifrúti é o corredor 2 (Padaria vazia não aparece, mas o número é a posição)
  });
  it('"acabou de entrar": só o que o OUTRO marcou depois que eu cheguei ao mercado', () => {
    const c = aplicar(nova(), comecarCompras('u1', T0, 'shibata'));
    const depois = aplicar(c, marcarFalta(c, 'sal', 'Ana', 'u2', T0 + 5000));
    const inicio = inicioDasCompras(depois, 'u1', T0 + 6000);
    expect(acabouDeEntrar(depois.itens.sal!, 'u1', inicio)).toBe(true);
    expect(acabouDeEntrar(depois.itens.sal!, 'u2', inicio)).toBe(false); // fui eu
    const antes = aplicar(c, marcarFalta(c, 'sal', 'Ana', 'u2', T0 - 5000));
    expect(acabouDeEntrar(antes.itens.sal!, 'u1', inicio)).toBe(false); // já estava na lista
    expect(acabouDeEntrar(depois.itens.sal!, 'u1', null)).toBe(false); // não estou no mercado
  });
  it('"Estou no mercado" esquecido há mais de 8 horas deixa de valer', () => {
    const c = aplicar(nova(), comecarCompras('u1', T0, 'shibata'));
    expect(inicioDasCompras(c, 'u1', T0 + 3_600_000)).toBe(T0);
    expect(inicioDasCompras(c, 'u1', T0 + 9 * 3_600_000)).toBeNull();
    expect(inicioDasCompras(c, 'u2', T0)).toBeNull();
  });
});

describe('aprender a ordem dos corredores', () => {
  const L = ['A', 'B', 'C', 'D', 'E'].map(id => ({ id, nome: id, ic: '🛒' }));
  const ids = (l: typeof L) => l.map(x => x.id).join('');
  it('reordena só os corredores tocados; os outros ficam no lugar', () => {
    expect(ids(aprenderOrdem(L, ['C', 'A']))).toBe('CBADE');
  });
  it('3 toques: posições 1,3,4 recebem E, B, D nessa ordem', () => {
    // posições ocupadas por B(1), D(3), E(4) → novo[1]=E, novo[3]=B, novo[4]=D
    expect(ids(aprenderOrdem(L, ['E', 'B', 'D']))).toBe('AECBD');
  });
  it('com menos de 2 corredores tocados, não muda nada', () => {
    expect(aprenderOrdem(L, ['C'])).toBe(L);
    expect(aprenderOrdem(L, [])).toBe(L);
  });
  it('desligado (padrão): terminar não mexe nos corredores', () => {
    let c = nova();
    for (const id of ['frango', 'cafe']) c = aplicar(c, marcarFalta(c, id, 'A', 'u1', T0));
    c = aplicar(c, pegar(c, 'frango', T0 + 1)); c = aplicar(c, pegar(c, 'cafe', T0 + 2));
    expect(terminarCompras(c, 'u1', 'shibata').escritas['mercados.shibata.corredores']).toBeUndefined();
  });
  it('ligado: a ordem dos toques vira a ordem dos corredores', () => {
    let c = aplicar(nova(), definirAprender('shibata', true));
    for (const id of ['frango', 'cafe']) c = aplicar(c, marcarFalta(c, id, 'A', 'u1', T0));
    // cafe (corredor 8) primeiro, depois frango (açougue, corredor 3)
    c = aplicar(c, pegar(c, 'cafe', T0 + 1)); c = aplicar(c, pegar(c, 'frango', T0 + 2));
    const { escritas, resumo } = terminarCompras(c, 'u1', 'shibata');
    const f = aplicar(c, escritas);
    const pos = (id: string) => f.mercados.shibata!.corredores.findIndex(x => x.id === id);
    expect(pos('cafe')).toBeLessThan(pos('acougue'));
    expect(f.mercados.shibata!.corredores).toHaveLength(13);
    expect(resumo.ordemAprendida).toEqual(['Café, aveia e matinais', 'Açougue']);
  });
});

describe('produtos: criar, editar, apagar', () => {
  it('criar já na lista, com id seguro e no fim da ordem', () => {
    const c = nova();
    const { id, escritas } = criarProduto(c, { nome: 'maizena', ic: '🌽', cat: 'despensa', cor: { shibata: 'arroz' } }, true, 'Victor', 'u1', T0);
    expect(id).toMatch(/^[a-z0-9]+$/);
    const d = aplicar(c, escritas);
    expect(d.itens[id]).toMatchObject({ nome: 'Maizena', ic: '🌽', falta: true, quem: 'Victor', quando: T0, cat: 'despensa', cor: { shibata: 'arroz' } });
    expect(d.itens[id]!.ordem).toBe(113);
  });
  it('categoria ou corredor inexistente vira "sem"', () => {
    const c = nova();
    const { id, escritas } = criarProduto(c, { nome: 'X', ic: '🛒', cat: 'nao-existe', cor: { shibata: 'fantasma', outro: 'x' } }, false, '', '', T0);
    expect(aplicar(c, escritas).itens[id]).toMatchObject({ cat: null, cor: {}, falta: false });
  });
  it('nome gigante é cortado em 40', () => {
    const c = nova();
    const { id, escritas } = criarProduto(c, { nome: 'a'.repeat(300), ic: '🛒', cat: null, cor: {} }, false, '', '', T0);
    expect(aplicar(c, escritas).itens[id]!.nome).toHaveLength(40);
  });
  it('ids novos nunca repetem nem têm ponto', () => {
    const ids = new Set(Array.from({ length: 500 }, () => novoId('n', T0)));
    expect(ids.size).toBe(500);
    for (const i of ids) expect(i).toMatch(/^[a-z0-9]+$/);
  });
  it('editar escreve só o que mudou', () => {
    const c = nova();
    const e = editarProduto(c, 'cafe', { nome: 'Café torrado', ic: c.itens.cafe!.ic, cat: c.itens.cafe!.cat, cor: c.itens.cafe!.cor });
    expect(e).toEqual({ 'itens.cafe.nome': 'Café torrado' });
    const e2 = editarProduto(c, 'cafe', { nome: 'Café', ic: '🫘', cat: 'despensa', cor: {} });
    expect(Object.keys(e2).sort()).toEqual(['itens.cafe.cat', 'itens.cafe.cor.shibata', 'itens.cafe.ic']);
    expect(e2['itens.cafe.cor.shibata']).toBe(APAGAR);
  });
  it('apagar tira só aquele produto', () => {
    const c = aplicar(nova(), apagarProduto(nova(), 'cafe'));
    expect(c.itens.cafe).toBeUndefined();
    expect(Object.keys(c.itens)).toHaveLength(112);
  });
  it('a ordem dos botões segue a ordem de criação', () => {
    const c = nova();
    const { id, escritas } = criarProduto(c, { nome: 'Zzz', ic: '🛒', cat: 'doces', cor: {} }, false, '', '', T0);
    const l = listarItens(aplicar(c, escritas));
    expect(l[l.length - 1]!.id).toBe(id);
  });
});

describe('corredores e categorias', () => {
  it('criar vai para o fim', () => {
    const c = nova();
    const { id, escritas } = criarLista(c, SHI, 'Pet shop', '🐶');
    const d = aplicar(c, escritas);
    expect(d.mercados.shibata!.corredores).toHaveLength(14);
    expect(d.mercados.shibata!.corredores[13]).toEqual({ id, nome: 'Pet shop', ic: '🐶' });
    expect(Object.keys(escritas)).toEqual(['mercados.shibata.corredores']); // só aquela lista
  });
  it('renomear e trocar figurinha', () => {
    let c = nova();
    c = aplicar(c, renomearLista(c, SHI, 'arroz', 'Arroz, feijão e milho'));
    c = aplicar(c, trocarFigurinhaLista(c, CAT, 'doces', '🍰'));
    expect(achar(c, SHI, 'arroz')!.nome).toBe('Arroz, feijão e milho');
    expect(achar(c, CAT, 'doces')!.ic).toBe('🍰');
    expect(renomearLista(c, SHI, 'arroz', '   ')).toEqual({});
  });
  it('mover: sobe e desce, mas não passa das pontas', () => {
    let c = nova();
    c = aplicar(c, moverLista(c, SHI, 'acougue', 1));
    expect(c.mercados.shibata!.corredores.map(x => x.id).slice(0, 4)).toEqual(['padaria', 'horti', 'frios', 'acougue']);
    c = aplicar(c, moverLista(c, SHI, 'acougue', -1));
    expect(c.mercados.shibata!.corredores[2]!.id).toBe('acougue');
    expect(moverLista(c, SHI, 'padaria', -1)).toEqual({});
    expect(moverLista(c, SHI, 'utilidades', 1)).toEqual({});
  });
  it('apagar corredor: os produtos vão para "Sem corredor" e nenhum some', () => {
    const c = nova();
    const e = apagarLista(c, SHI, 'acougue');
    const d = aplicar(c, e);
    expect(d.mercados.shibata!.corredores).toHaveLength(12);
    expect(Object.keys(d.itens)).toHaveLength(113);
    expect(d.itens.frango!.cor.shibata).toBeUndefined();
    expect(d.itens.frango!.cat).toBe('carnes'); // a categoria não muda
    expect(Object.keys(e).filter(k => k.endsWith('.cor.shibata')).length).toBe(6);
  });
  it('apagar categoria: os produtos vão para "Sem categoria"', () => {
    const d = aplicar(nova(), apagarLista(nova(), CAT, 'carnes'));
    expect(d.itens.frango!.cat).toBeNull();
    expect(d.itens.frango!.cor.shibata).toBe('acougue');
    expect(d.categorias).toHaveLength(10);
  });
});

describe('pessoas e convite', () => {
  it('e-mail: minúsculas e formato', () => {
    expect(normalizarEmail('  Ana@Email.COM ')).toBe('ana@email.com');
    expect(emailValido('ana@email.com')).toBe(true);
    expect(emailValido('sem-arroba')).toBe(false);
  });
  it('código de convite: 10 símbolos, só do alfabeto, e diferente a cada vez', () => {
    const codigos = new Set(Array.from({ length: 200 }, () => gerarCodigoConvite()));
    expect(codigos.size).toBe(200);
    for (const c of codigos) {
      expect(c).toHaveLength(10);
      expect([...c].every(ch => ALFABETO_CONVITE.includes(ch))).toBe(true);
    }
  });
  it('código: ignora bytes que enviesariam o sorteio (>= 248)', () => {
    const seq = [255, 250, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    expect(gerarCodigoConvite(() => Uint8Array.from(seq))).toBe('ABCDEFGHJK');
  });
  it('normalizar o que a pessoa digita', () => {
    expect(normalizarCodigo('k7m2p-9qxrt')).toBe('K7M2P9QXRT');
    expect(normalizarCodigo(' K7M2P 9QXRT ')).toBe('K7M2P9QXRT');
    expect(normalizarCodigo('K7M2P')).toBeNull();
    expect(normalizarCodigo('K7M2P-9QXR0')).toBeNull(); // 0 não existe no alfabeto
    expect(normalizarCodigo('')).toBeNull();
  });
  it('mostrar com hífen', () => expect(mostrarCodigo('K7M2P9QXRT')).toBe('K7M2P-9QXRT'));
  it('nome a partir do e-mail', () => {
    expect(nomeDoEmail('ana@x.com')).toBe('Ana');
    expect(nomeDoEmail('')).toBe('Eu');
  });
});

describe('ler da nuvem com segurança', () => {
  it('descarta produto pela metade, corta textos e conserta tipos', () => {
    const c = lerCasa({
      membros: ['a@a.com', 5],
      corredores: [{ id: 'x', nome: 'Z'.repeat(99), ic: '🛒' }, { nome: 'sem id' }, 7],
      itens: { ok: { nome: 'Pão', ic: '🍞', falta: true, quando: 5 }, fantasma: { falta: true }, ruim: 'texto', __proto__x: { nome: 'a.b' }, 'a.b': { nome: 'ponto' } },
      noMercado: { u1: 12, u2: 'x', u3: { quando: 7, mercado: 'sams' } }, nomes: { u1: 'Ana', u2: 3 }, aprender: 'sim',
    });
    expect(c.membros).toEqual(['a@a.com']);
    expect(c.mercados.shibata!.corredores).toHaveLength(1);
    expect(c.mercados.shibata!.corredores[0]!.nome).toHaveLength(40);
    expect(Object.keys(c.itens)).toEqual(['ok']);
    expect(c.itens.ok).toMatchObject({ nome: 'Pão', falta: true, cat: null, carrinho: false });
    expect(c.noMercado).toEqual({ u1: { quando: 12, mercado: '' }, u3: { quando: 7, mercado: 'sams' } });
    expect(c.nomes).toEqual({ u1: 'Ana' });
    expect(c.mercados.shibata!.aprender).toBe(false);
  });
  it('aguenta lixo', () => {
    expect(lerCasa(null).itens).toEqual({});
    expect(lerCasa('x').mercados.shibata!.corredores).toEqual([]);
  });
  it('APAGAR de um campo que não existe aplica sem quebrar', () => {
    expect(() => aplicar(nova(), { 'itens.nada.falta': APAGAR, 'noMercado.u9': APAGAR })).not.toThrow();
  });
});
