import { describe, expect, it } from 'vitest';
import {
  agruparMercado, apagarLista, apagarMercado, aplicar, casaInicial, comecarCompras, corredorDe, criarLista, criarMercado, definirAprender,
  definirCidade, definirCorredor, editarMercado, editarProduto, inverso, itensFaltando, jaTemMercados, lerCasa, limparSite, listarMercados,
  marcarFalta, mercadoDasCompras, mercadoEscolhido, migracao, pegar, terminarCompras,
} from '../src/motor/casa.ts';
import { APAGAR } from '../src/motor/tipos.ts';

const T0 = 1_760_000_000_000;
const nova = () => casaInicial('victor@email.com', 'u1', 'Victor');

/** O documento como estava ANTES da rodada 3 (corredores e aprender no topo, `cor` em texto). */
const documentoAntigo = () => ({
  membros: ['victor@email.com'],
  corredores: [{ id: 'padaria', nome: 'Padaria', ic: '🥖' }, { id: 'horti', nome: 'Hortifrúti', ic: '🥬' }],
  categorias: [{ id: 'cafe', nome: 'Café', ic: '☕' }],
  itens: {
    pao: { nome: 'Pão', ic: '🍞', cat: 'cafe', cor: 'padaria', falta: true, quem: 'Ana', por: 'u2', quando: T0, carrinho: false, pegouEm: 0, semEstoque: false, ordem: 0 },
    alho: { nome: 'Alho', ic: '🧄', cat: null, cor: 'horti', falta: false, quem: '', por: '', quando: 0, carrinho: false, pegouEm: 0, semEstoque: false, ordem: 1 },
    sem: { nome: 'Sem corredor', ic: '🛒', cat: null, cor: null, falta: false, quem: '', por: '', quando: 0, carrinho: false, pegouEm: 0, semEstoque: false, ordem: 2 },
  },
  noMercado: { u1: T0 }, nomes: { u1: 'Victor' }, aprender: true,
});

describe('migração para vários mercados', () => {
  it('lerCasa aceita o formato de antes: os corredores viram o mercado Shibata na memória', () => {
    const c = lerCasa(documentoAntigo());
    expect(Object.keys(c.mercados)).toEqual(['shibata']);
    expect(c.mercados.shibata).toMatchObject({ nome: 'Shibata', site: 'https://www.loja.shibata.com.br', aprender: true });
    expect(c.mercados.shibata!.corredores.map(x => x.id)).toEqual(['padaria', 'horti']);
    expect(c.itens.pao!.cor).toEqual({ shibata: 'padaria' });
    expect(c.itens.sem!.cor).toEqual({});
    expect(c.noMercado.u1).toEqual({ quando: T0, mercado: '' });
  });
  it('as escritas da migração: 1 gravação, mercado + cor de cada produto + some o topo', () => {
    const e = migracao(documentoAntigo())!;
    expect(e['mercados.shibata']).toMatchObject({ nome: 'Shibata', ic: '🏪', ordem: 0, aprender: true, site: 'https://www.loja.shibata.com.br' });
    expect(e['itens.pao.cor']).toEqual({ shibata: 'padaria' });
    expect(e['itens.alho.cor']).toEqual({ shibata: 'horti' });
    expect('itens.sem.cor' in e).toBe(false);
    expect(e.corredores).toBe(APAGAR);
    expect(e.aprender).toBe(APAGAR);
    expect(e.cidade).toBe('São José dos Campos (SP)');
  });
  it('depois de aplicada, o documento está no formato novo e a leitura dá o MESMO resultado (idempotente)', () => {
    const antigo = documentoAntigo();
    const antes = lerCasa(antigo);
    const migrado = aplicar(antes, migracao(antigo)!);
    expect(migrado.mercados).toEqual(antes.mercados);
    expect(migrado.itens).toEqual(antes.itens);
    // o documento no servidor depois da migração: sem os campos de antes
    const noServidor = { ...migrado, corredores: undefined };
    expect(jaTemMercados(noServidor)).toBe(true);
    expect(migracao(noServidor)).toBeNull();
    expect(lerCasa(noServidor).mercados).toEqual(antes.mercados);
  });
  it('duas migrações dão exatamente as mesmas escritas (dois celulares ao mesmo tempo)', () => {
    expect(migracao(documentoAntigo())).toEqual(migracao(documentoAntigo()));
  });
  it('depois da migração, campos soltos de um aparelho velho (corredores, aprender, cor em texto) não bagunçam', () => {
    const migrado = { ...aplicar(lerCasa(documentoAntigo()), migracao(documentoAntigo())!), corredores: [{ id: 'x', nome: 'X', ic: '🛒' }], aprender: true } as unknown;
    const c = lerCasa(migrado);
    expect(Object.keys(c.mercados)).toEqual(['shibata']);
    expect(c.mercados.shibata!.corredores.map(x => x.id)).toEqual(['padaria', 'horti']);
    // um aparelho velho regravou `cor` como texto num documento já migrado
    const velho = lerCasa({ ...(migrado as object), itens: { pao: { ...documentoAntigo().itens.pao, cor: 'horti' } } });
    expect(velho.itens.pao!.cor).toEqual({ shibata: 'horti' });
  });
  it('conserto: mover corredor ANTES da migração criou "mercados.shibata" sem nome; a migração completa sem desfazer a ordem', () => {
    const quebrado = { ...documentoAntigo(), mercados: { shibata: { corredores: [{ id: 'horti', nome: 'Hortifrúti', ic: '🥬' }, { id: 'padaria', nome: 'Padaria', ic: '🥖' }] } } } as Record<string, unknown>;
    delete quebrado.corredores; delete quebrado.aprender;
    const e = migracao(quebrado)!;
    expect(e['mercados.shibata.nome']).toBe('Shibata');
    expect('mercados.shibata.corredores' in e).toBe(false);
    expect(e['itens.pao.cor']).toEqual({ shibata: 'padaria' });
    const c = aplicar(lerCasa(quebrado), e);
    expect(c.mercados.shibata!.nome).toBe('Shibata');
    expect(c.mercados.shibata!.corredores.map(x => x.id)).toEqual(['horti', 'padaria']);
    expect(migracao({ ...quebrado, mercados: { shibata: { ...(quebrado.mercados as any).shibata, nome: 'Shibata' } } })).toBeNull();
  });
  it('a casa nova já nasce no formato novo', () => {
    expect(migracao(nova())).toBeNull();
    expect(lerCasa(nova())).toEqual(nova());
  });
});

describe('mercados: criar, editar, apagar', () => {
  it('criar COPIANDO: mesmos corredores com ids novos e cada produto no corredor equivalente', () => {
    const c = nova();
    const { id, escritas } = criarMercado(c, "Sam's Club", 'https://www.samsclub.com.br', 'shibata', 'msams');
    const d = aplicar(c, escritas);
    expect(id).toBe('msams');
    const novo = d.mercados.msams!;
    expect(novo).toMatchObject({ nome: "Sam's Club", site: 'https://www.samsclub.com.br', aprender: false, ordem: 1 });
    expect(novo.corredores).toHaveLength(13);
    expect(novo.corredores.map(x => x.nome)).toEqual(d.mercados.shibata!.corredores.map(x => x.nome));
    expect(novo.corredores.some(x => d.mercados.shibata!.corredores.some(y => y.id === x.id))).toBe(false); // ids novos
    const idAcougueNovo = novo.corredores.find(x => x.nome === 'Açougue')!.id;
    expect(d.itens.frango!.cor).toEqual({ shibata: 'acougue', msams: idAcougueNovo });
    expect(corredorDe(d, d.itens.frango!, 'msams')).toBe(idAcougueNovo);
    // o Shibata não mudou
    expect(d.mercados.shibata).toEqual(c.mercados.shibata);
  });
  it('criar VAZIO: sem corredores e todos os produtos "sem corredor" lá', () => {
    const c = nova();
    const { id, escritas } = criarMercado(c, 'Atacadão', '', null);
    const d = aplicar(c, escritas);
    expect(d.mercados[id]!.corredores).toEqual([]);
    expect(Object.values(d.itens).every(i => !(id in i.cor))).toBe(true);
    expect(Object.keys(escritas)).toEqual([`mercados.${id}`]);
  });
  it('nome vazio, site que não é https, site grande e o 7º mercado são recusados', () => {
    const c = nova();
    expect(criarMercado(c, '  ', '', null).escritas).toEqual({});
    expect(criarMercado(c, 'X', 'http://x.com', null).escritas).toEqual({});
    expect(criarMercado(c, 'X', 'javascript:alert(1)', null).escritas).toEqual({});
    expect(criarMercado(c, 'X', 'https://x.com/' + 'a'.repeat(100), null).escritas).toEqual({});
    let d = c;
    for (let k = 0; k < 5; k++) d = aplicar(d, criarMercado(d, `M${k}`, '', null).escritas);
    expect(Object.keys(d.mercados)).toHaveLength(6);
    expect(criarMercado(d, 'Sétimo', '', null).escritas).toEqual({});
  });
  it('site: vazio vale; só https; sem espaço nem sinais de HTML', () => {
    expect(limparSite('')).toBe('');
    expect(limparSite(' https://www.x.com.br ')).toBe('https://www.x.com.br');
    expect(limparSite('https://x.com/<img>')).toBeNull();
    expect(limparSite('https://x .com')).toBeNull();
    expect(limparSite('ftp://x.com')).toBeNull();
  });
  it('nome do mercado não leva "|" nem ":" (a resposta do Claude usa esses sinais)', () => {
    const { id, escritas } = criarMercado(nova(), 'Sam: o | clube', '', null);
    expect(aplicar(nova(), escritas).mercados[id]!.nome).toBe('Sam o clube');
  });
  it('editar escreve só o que mudou', () => {
    const c = nova();
    expect(editarMercado(c, 'shibata', 'Shibata Centro', 'https://www.loja.shibata.com.br')).toEqual({ 'mercados.shibata.nome': 'Shibata Centro' });
    expect(editarMercado(c, 'shibata', 'Shibata', '')).toEqual({ 'mercados.shibata.site': '' });
    expect(editarMercado(c, 'shibata', '', '')).toEqual({});
  });
  it('apagar: só se houver mais de um; os produtos e a lista não mudam e o outro mercado fica igual', () => {
    expect(apagarMercado(nova(), 'shibata')).toEqual({});
    let c = nova();
    c = aplicar(c, marcarFalta(c, 'cafe', 'Ana', 'u2', T0));
    const { id, escritas } = criarMercado(c, 'Sams', '', 'shibata');
    const duas = aplicar(c, escritas);
    const e = apagarMercado(duas, id);
    const d = aplicar(duas, e);
    expect(Object.keys(d.mercados)).toEqual(['shibata']);
    expect(d).toEqual(c); // exatamente como antes de criar
    expect(itensFaltando(d).map(i => i.id)).toEqual(['cafe']);
    expect(aplicar(d, inverso(duas, e))).toEqual(duas); // Desfazer
  });
  it('mercados aparecem na ordem; o lembrado que sumiu cai no primeiro', () => {
    let c = nova();
    c = aplicar(c, criarMercado(c, 'Sams', '', null, 'msams').escritas);
    expect(listarMercados(c).map(m => m.id)).toEqual(['shibata', 'msams']);
    expect(mercadoEscolhido(c, 'msams')!.id).toBe('msams');
    expect(mercadoEscolhido(c, 'fantasma')!.id).toBe('shibata');
    expect(mercadoEscolhido(c, null)!.id).toBe('shibata');
  });
});

describe('corredor por mercado', () => {
  const duasLojas = () => {
    let c = nova();
    c = aplicar(c, criarMercado(c, 'Sams', '', null, 'msams').escritas);
    c = aplicar(c, criarLista(c, { tipo: 'corredores', mercado: 'msams' }, 'Mercearia', '🍚', 'xmerc').escritas);
    return c;
  };
  it('"qual corredor?": grava só aquele produto naquele mercado; Desfazer volta', () => {
    const c = duasLojas();
    const e = definirCorredor(c, 'cafe', 'msams', 'xmerc');
    expect(e).toEqual({ 'itens.cafe.cor.msams': 'xmerc' });
    const d = aplicar(c, e);
    expect(d.itens.cafe!.cor).toEqual({ shibata: 'cafe', msams: 'xmerc' });
    expect(aplicar(d, inverso(c, e))).toEqual(c);
    expect(definirCorredor(c, 'cafe', 'msams', 'nao-existe')).toEqual({});
    expect(definirCorredor(c, 'cafe', 'nada', 'xmerc')).toEqual({});
  });
  it('agrupar usa os corredores do mercado escolhido; sem corredor lá = "Sem corredor"', () => {
    let c = duasLojas();
    c = aplicar(c, definirCorredor(c, 'cafe', 'msams', 'xmerc'));
    for (const id of ['cafe', 'sal']) c = aplicar(c, marcarFalta(c, id, 'A', 'u1', T0));
    const sams = agruparMercado(c, itensFaltando(c), 'msams');
    expect(sams.map(g => [g.corredor?.id ?? null, g.itens.map(i => i.id)])).toEqual([['xmerc', ['cafe']], [null, ['sal']]]);
    const shi = agruparMercado(c, itensFaltando(c), 'shibata');
    expect(shi.every(g => g.corredor !== null)).toBe(true);
  });
  it('apagar um corredor: só aquele mercado fica "sem"; o outro não muda', () => {
    let c = duasLojas();
    c = aplicar(c, definirCorredor(c, 'cafe', 'msams', 'xmerc'));
    const e = apagarLista(c, { tipo: 'corredores', mercado: 'msams' }, 'xmerc');
    const d = aplicar(c, e);
    expect(d.itens.cafe!.cor).toEqual({ shibata: 'cafe' });
    expect(d.mercados.shibata).toEqual(c.mercados.shibata);
    expect(Object.keys(e).sort()).toEqual(['itens.cafe.cor.msams', 'mercados.msams.corredores']);
  });
  it('editar produto troca só o corredor do mercado mexido', () => {
    const c = duasLojas();
    const e = editarProduto(c, 'cafe', { nome: 'Café', ic: c.itens.cafe!.ic, cat: c.itens.cafe!.cat, cor: { shibata: 'cafe', msams: 'xmerc' } });
    expect(e).toEqual({ 'itens.cafe.cor.msams': 'xmerc' });
  });
  it('um corredor que sumiu da lista deixa o produto "sem corredor" (sem quebrar)', () => {
    const c = duasLojas();
    const d = aplicar(c, { 'itens.cafe.cor.msams': 'fantasma' });
    expect(corredorDe(d, d.itens.cafe!, 'msams')).toBeNull();
  });
});

describe('compras num mercado', () => {
  it('"Estou no X" guarda a hora e o mercado; o outro celular vê onde estou', () => {
    let c = nova();
    c = aplicar(c, criarMercado(c, 'Sams', '', null, 'msams').escritas);
    c = aplicar(c, comecarCompras('u1', T0, 'msams'));
    expect(c.noMercado.u1).toEqual({ quando: T0, mercado: 'msams' });
    expect(mercadoDasCompras(c, 'u1', T0 + 1000)!.id).toBe('msams');
    expect(mercadoDasCompras(c, 'u2', T0 + 1000)).toBeUndefined();
    expect(mercadoDasCompras(c, 'u1', T0 + 9 * 3_600_000)).toBeUndefined();
  });
  it('aprender a ordem é por mercado (começa desligado) e só mexe no mercado onde se comprou', () => {
    let c = nova();
    c = aplicar(c, criarMercado(c, 'Sams', '', 'shibata', 'msams').escritas);
    expect(c.mercados.msams!.aprender).toBe(false);
    c = aplicar(c, definirAprender('msams', true));
    expect(c.mercados.shibata!.aprender).toBe(false);
    for (const id of ['frango', 'cafe']) c = aplicar(c, marcarFalta(c, id, 'A', 'u1', T0));
    c = aplicar(c, pegar(c, 'cafe', T0 + 1)); c = aplicar(c, pegar(c, 'frango', T0 + 2));
    // no Shibata (desligado) não aprende
    expect(terminarCompras(c, 'u1', 'shibata').escritas['mercados.shibata.corredores']).toBeUndefined();
    const { escritas, resumo } = terminarCompras(c, 'u1', 'msams');
    expect(Object.keys(escritas).filter(k => k.endsWith('.corredores'))).toEqual(['mercados.msams.corredores']);
    const f = aplicar(c, escritas);
    const nomes = f.mercados.msams!.corredores.map(x => x.nome);
    expect(nomes.indexOf('Café, aveia e matinais')).toBeLessThan(nomes.indexOf('Açougue'));
    expect(f.mercados.shibata).toEqual(c.mercados.shibata);
    expect(resumo.ordemAprendida).toEqual(['Café, aveia e matinais', 'Açougue']);
  });
});

describe('cidade', () => {
  it('limpa e corta em 60', () => {
    expect(definirCidade('  São   José ')).toEqual({ cidade: 'São José' });
    expect((definirCidade('x'.repeat(200)).cidade as string).length).toBe(60);
  });
});
