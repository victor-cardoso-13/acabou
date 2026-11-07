// Testa as regras de casas/{casaId} (../Jogos/Computador/firestore.rules) no EMULADOR, sem tocar no banco de verdade.
// Pré-requisito: emulador ligado (Auth 9199, Firestore 8189), ver LEIA-ME.md dos testes de regras em Jogos/Computador.
// Uso: node scripts/testar-regras.mjs      Esperado: tudo "OK".
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInAnonymously } from 'firebase/auth';
import { arrayUnion, collection, connectFirestoreEmulator, deleteDoc, deleteField, doc, getDoc, getDocs, getFirestore, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

const cfg = { apiKey: 'x', projectId: 'jogos-sem-anuncio' };
const sufixo = Date.now().toString(36);
const apps = [];
async function pessoa(nome, email) {
  const app = initializeApp(cfg, nome + sufixo); apps.push(app);
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9199', { disableWarnings: true });
  const banco = getFirestore(app); connectFirestoreEmulator(banco, '127.0.0.1', 8189);
  if (email) await createUserWithEmailAndPassword(auth, email, 'senha123'); else await signInAnonymously(auth);
  return { banco, auth, email: email?.toLowerCase(), uid: auth.currentUser.uid };
}
let falhas = 0;
const ok = (rotulo, bateu, extra = '') => { if (!bateu) falhas++; console.log(bateu ? 'OK    ' : 'FALHOU', rotulo, extra); };
const tenta = async f => { try { await f(); return 'permitido'; } catch (e) { return e.code === 'permission-denied' ? 'recusado' : 'erro:' + e.code; } };
const deve = async (rotulo, esperado, f) => { const r = await tenta(f); ok(rotulo, r === esperado, `→ ${r}`); };

const casaBase = (email, uid) => ({
  membros: [email], corredores: [{ id: 'a', nome: 'Padaria', ic: '🥖' }], categorias: [{ id: 'b', nome: 'Temperos', ic: '🧂' }],
  itens: { cafe: { nome: 'Café', ic: '☕', cat: 'b', cor: 'a', falta: false, quem: '', por: '', quando: 0, carrinho: false, pegouEm: 0, semEstoque: false, ordem: 0 } },
  noMercado: {}, nomes: { [uid]: 'Victor' }, aprender: false,
});

// e-mail com maiúsculas no cadastro: o app e as regras usam sempre minúsculas
const victor = await pessoa('victor', 'Victor.Teste' + sufixo + '@Email.com');
const ana = await pessoa('ana', 'ANA.Teste' + sufixo + '@email.com');
const intruso = await pessoa('intruso', 'intruso' + sufixo + '@email.com');
const anonimo = await pessoa('anonimo', null);
console.log('e-mail no login do Victor (token):', victor.auth.currentUser.email, '| guardado como:', victor.email);

const ref = (p, id) => doc(p.banco, 'casas', id);
const refVictor = doc(collection(victor.banco, 'casas'));
const id = refVictor.id;

console.log('\n--- criar a casa ---');
await deve('Victor cria a casa só com o próprio e-mail', 'permitido', () => setDoc(refVictor, casaBase(victor.auth.currentUser.email.toLowerCase(), victor.uid)));
await deve('criar casa já com 2 membros (pondo a Ana de surpresa) é recusado', 'recusado', () => setDoc(doc(victor.banco, 'casas', 'x' + sufixo), { ...casaBase(victor.email, victor.uid), membros: [victor.email, ana.email] }));
await deve('criar casa SEM o próprio e-mail (só o da Ana) é recusado', 'recusado', () => setDoc(doc(victor.banco, 'casas', 'y' + sufixo), casaBase(ana.email, victor.uid)));
await deve('criar casa com e-mail em maiúsculas é recusado', 'recusado', () => setDoc(doc(victor.banco, 'casas', 'z' + sufixo), casaBase(victor.auth.currentUser.email.toUpperCase(), victor.uid)));
await deve('criar casa com campo a mais é recusado', 'recusado', () => setDoc(doc(victor.banco, 'casas', 'w' + sufixo), { ...casaBase(victor.email, victor.uid), extra: 1 }));
await deve('criar casa sem campo "itens" é recusado', 'recusado', () => { const c = casaBase(victor.email, victor.uid); delete c.itens; return setDoc(doc(victor.banco, 'casas', 'v' + sufixo), c); });
await deve('login invisível (anônimo) não cria casa', 'recusado', () => setDoc(doc(anonimo.banco, 'casas', 'u' + sufixo), casaBase('a@a.com', anonimo.uid)));

console.log('\n--- quem NÃO é da casa ---');
await deve('Ana (ainda não adicionada) não lê a casa', 'recusado', () => getDoc(ref(ana, id)));
await deve('Ana não grava na casa', 'recusado', () => updateDoc(ref(ana, id), { 'itens.cafe.falta': true }));
await deve('intruso não lê a casa', 'recusado', () => getDoc(ref(intruso, id)));
await deve('intruso procurando "casas do e-mail do Victor" é recusado', 'recusado', () => getDocs(query(collection(intruso.banco, 'casas'), where('membros', 'array-contains', victor.email))));
await deve('intruso se adicionando em membros é recusado', 'recusado', () => updateDoc(ref(intruso, id), { membros: [victor.email, intruso.email] }));
await deve('intruso apagando a casa é recusado', 'recusado', () => deleteDoc(ref(intruso, id)));
await deve('anônimo não lê a casa', 'recusado', () => getDoc(ref(anonimo, id)));
let n = (await getDocs(query(collection(intruso.banco, 'casas'), where('membros', 'array-contains', intruso.email)))).size;
ok('intruso procurando as casas do PRÓPRIO e-mail acha 0', n === 0, `→ ${n}`);
n = (await getDocs(query(collection(ana.banco, 'casas'), where('membros', 'array-contains', ana.email)))).size;
ok('Ana (ainda sem casa) procurando as dela acha 0', n === 0, `→ ${n}`);

console.log('\n--- quem é da casa ---');
await deve('Victor lê a casa', 'permitido', () => getDoc(ref(victor, id)));
await deve('Victor marca "falta" (só campos do produto)', 'permitido', () => updateDoc(ref(victor, id), { 'itens.cafe.falta': true, 'itens.cafe.quem': 'Victor', 'itens.cafe.quando': 1 }));
await deve('Victor cria produto novo (um caminho só)', 'permitido', () => updateDoc(ref(victor, id), { 'itens.nova1': { nome: 'Sal', ic: '🧂', cat: null, cor: null, falta: true, quem: 'Victor', por: victor.uid, quando: 2, carrinho: false, pegouEm: 0, semEstoque: false, ordem: 1 } }));
await deve('Victor apaga um produto (deleteField)', 'permitido', () => updateDoc(ref(victor, id), { 'itens.nova1': deleteField() }));
await deve('Victor reordena corredores (regrava só a lista)', 'permitido', () => updateDoc(ref(victor, id), { corredores: [{ id: 'a', nome: 'Hortifrúti', ic: '🥬' }] }));
await deve('Victor liga "aprender"', 'permitido', () => updateDoc(ref(victor, id), { aprender: true }));
await deve('"aprender" com texto no lugar de true/false é recusado', 'recusado', () => updateDoc(ref(victor, id), { aprender: 'sim' }));
await deve('Victor entra no mercado', 'permitido', () => updateDoc(ref(victor, id), { [`noMercado.${victor.uid}`]: 5 }));
await deve('campo estranho no documento é recusado', 'recusado', () => updateDoc(ref(victor, id), { lixo: 'x' }));
await deve('apagar a casa é recusado (nem o dono)', 'recusado', () => deleteDoc(ref(victor, id)));
await deve('Victor tirar o PRÓPRIO e-mail de membros é recusado (ninguém se tranca para fora)', 'recusado', () => updateDoc(ref(victor, id), { membros: [ana.email] }));
await deve('membros vazio é recusado', 'recusado', () => updateDoc(ref(victor, id), { membros: [] }));
await deve('e-mail com maiúsculas em membros é recusado', 'recusado', () => updateDoc(ref(victor, id), { membros: [victor.email, 'Maiuscula@Email.com'] }));
await deve('"itens" virando texto é recusado', 'recusado', () => updateDoc(ref(victor, id), { itens: 'oi' }));
const muitos = Object.fromEntries(Array.from({ length: 401 }, (_, k) => ['p' + k, { nome: 'x' }]));
await deve('mais de 400 produtos é recusado', 'recusado', () => updateDoc(ref(victor, id), { itens: muitos }));
await deve('mais de 40 corredores é recusado', 'recusado', () => updateDoc(ref(victor, id), { corredores: Array.from({ length: 41 }, (_, k) => ({ id: 'c' + k, nome: 'x', ic: 'x' })) }));

console.log('\n--- entrar só com convite ---');
const convite = (p, codigo, casaId, email, extra = {}) => setDoc(doc(p.banco, 'convites', codigo), { casaId, email, por: p.email, criadoEm: serverTimestamp(), ...extra });
const entrar = (p, codigo, casaId) => { // o mesmo que o app faz: 3 gravações juntas
  const lote = writeBatch(p.banco);
  lote.set(doc(p.banco, 'casas', casaId, 'entradas', p.uid), { codigo, email: p.email });
  lote.update(doc(p.banco, 'casas', casaId), { membros: arrayUnion(p.email) });
  lote.delete(doc(p.banco, 'convites', codigo));
  return lote.commit();
};
await deve('Victor pôr o e-mail da Ana direto em "membros" é recusado (só por convite)', 'recusado', () => updateDoc(ref(victor, id), { membros: [victor.email, ana.email] }));
await deve('ninguém da casa mexe na lista de membros à mão (nem pondo um e-mail qualquer)', 'recusado', () => updateDoc(ref(victor, id), { membros: [victor.email, 'qualquer@x.com'] }));
await deve('intruso não gera convite para a casa do Victor', 'recusado', () => convite(intruso, 'AAAAAAAAAA', id, intruso.email));
await deve('Victor gera convite com código fora do formato (minúsculas/curto)', 'recusado', () => convite(victor, 'abc', id, ana.email));
await deve('Victor gera convite com código com letra proibida (O, 0, 1, I, L)', 'recusado', () => convite(victor, 'AAAAAAAAA0', id, ana.email));
await deve('convite com data falsa (não é a hora do servidor) é recusado', 'recusado', () => convite(victor, 'BBBBBBBBBB', id, ana.email, { criadoEm: new Date(2020, 1, 1) }));
await deve('convite com e-mail em maiúsculas é recusado', 'recusado', () => convite(victor, 'CCCCCCCCCC', id, 'ANA@x.com'));
await deve('convite para casa que não existe é recusado', 'recusado', () => convite(victor, 'DDDDDDDDDD', 'casa-que-nao-existe', ana.email));
await deve('Victor gera o convite para o e-mail da Ana (código K7M2P9QXRT)', 'permitido', () => convite(victor, 'K7M2P9QXRT', id, ana.email));
await deve('intruso não lê o convite, mesmo sabendo o código', 'recusado', () => getDoc(doc(intruso.banco, 'convites', 'K7M2P9QXRT')));
await deve('ninguém lista os convites', 'recusado', () => getDocs(collection(ana.banco, 'convites')));
await deve('intruso tentando entrar com o código da Ana é recusado (e-mail não confere)', 'recusado', () => entrar(intruso, 'K7M2P9QXRT', id));
await deve('intruso criando a "entrada" sozinho é recusado', 'recusado', () => setDoc(doc(intruso.banco, 'casas', id, 'entradas', intruso.uid), { codigo: 'K7M2P9QXRT', email: intruso.email }));
await deve('Ana se põe em "membros" sem convite (sem a entrada) é recusado', 'recusado', () => updateDoc(ref(ana, id), { membros: arrayUnion(ana.email) }));
await deve('Ana com código errado é recusada', 'recusado', () => entrar(ana, 'ZZZZZZZZZZ', id));
const outraCasa = doc(collection(intruso.banco, 'casas'));
await setDoc(outraCasa, casaBase(intruso.email, intruso.uid));
await deve('Ana usando o código da casa do Victor para entrar em OUTRA casa é recusada', 'recusado', () => entrar(ana, 'K7M2P9QXRT', outraCasa.id));
await deve('Ana lê o convite dela (sabendo o código)', 'permitido', () => getDoc(doc(ana.banco, 'convites', 'K7M2P9QXRT')));
await deve('Ana entra na casa com o código (e-mail dela em maiúsculas no cadastro)', 'permitido', () => entrar(ana, 'K7M2P9QXRT', id));
n = (await getDocs(query(collection(ana.banco, 'casas'), where('membros', 'array-contains', ana.email)))).size;
ok('Ana procura as casas dela e acha a casa', n === 1, `→ ${n}`);
await deve('Ana lê a casa', 'permitido', () => getDoc(ref(ana, id)));
await deve('o convite foi gasto: não dá para entrar de novo', 'recusado', () => getDoc(doc(ana.banco, 'convites', 'K7M2P9QXRT')));
await deve('intruso tentando reaproveitar o código gasto é recusado', 'recusado', () => entrar(intruso, 'K7M2P9QXRT', id));
await deve('Ana lê as "entradas" (ninguém lê)', 'recusado', () => getDoc(doc(ana.banco, 'casas', id, 'entradas', ana.uid)));

console.log('\n--- depois de entrar ---');
await deve('Ana marca um produto, ao mesmo tempo que o Victor mexe em outro', 'permitido', () => Promise.all([
  updateDoc(ref(ana, id), { 'itens.cafe.falta': false, 'itens.cafe.quem': 'Ana' }),
  updateDoc(ref(victor, id), { aprender: false }),
]));
const d = (await getDoc(ref(victor, id))).data();
ok('as duas gravações simultâneas ficaram (nenhuma apagou a outra)', d.itens.cafe.quem === 'Ana' && d.aprender === false);
ok('a lista de membros tem os dois, em minúsculas', d.membros.length === 2 && d.membros.every(m => m === m.toLowerCase()), JSON.stringify(d.membros));
await deve('Ana apagar a casa é recusado', 'recusado', () => deleteDoc(ref(ana, id)));
await deve('Ana cancelar um convite que não é dela é recusado', 'recusado', () => deleteDoc(doc(ana.banco, 'convites', 'K7M2P9QXRT')));

console.log('\n--- limite de 4 pessoas ---');
const c3 = await pessoa('c3', 'c3' + sufixo + '@x.com'), c4 = await pessoa('c4', 'c4' + sufixo + '@x.com'), c5 = await pessoa('c5', 'c5' + sufixo + '@x.com');
await convite(ana, 'EEEEEEEEEE', id, c3.email); await entrar(c3, 'EEEEEEEEEE', id);
await deve('Ana convida o 4º e ele entra', 'permitido', async () => { await convite(ana, 'FFFFFFFFFF', id, c4.email); await entrar(c4, 'FFFFFFFFFF', id); });
await deve('com 4 pessoas, novo convite é recusado', 'recusado', () => convite(victor, 'GGGGGGGGGG', id, c5.email));
await deve('quem foi convidado antes de a casa encher não passa de 4 (5º recusado)', 'recusado', async () => {
  // convite criado por outro caminho não existe: simula tentativa de entrar sem convite válido
  await entrar(c5, 'GGGGGGGGGG', id);
});
await deve('intruso continua de fora', 'recusado', () => getDoc(ref(intruso, id)));

console.log('\n--- vários mercados (rodada 3): formato novo e migração ---');
const merc = (nome, ordem = 0) => ({ nome, ic: '🏪', site: 'https://www.exemplo.com.br', aprender: false, ordem, corredores: [{ id: 'k1', nome: 'Padaria', ic: '🥖' }] });
const sufixoM = Date.now().toString(36);
const novaCasaNova = (p, extra = {}) => { const { corredores, aprender, ...resto } = casaBase(p.email, p.uid); return { ...resto, mercados: { shibata: merc('Shibata') }, cidade: 'São José dos Campos (SP)', ...extra }; };
await deve('casa nova no formato novo (sem corredores/aprender, com mercados e cidade) é criada', 'permitido', () => setDoc(doc(victor.banco, 'casas', 'n1' + sufixoM), novaCasaNova(victor)));
await deve('casa nova com 7 mercados é recusada', 'recusado', () => setDoc(doc(victor.banco, 'casas', 'n2' + sufixoM), novaCasaNova(victor, { mercados: Object.fromEntries(Array.from({ length: 7 }, (_, k) => ['m' + k, merc('M' + k, k)])) })));
await deve('casa nova com 6 mercados é criada', 'permitido', () => setDoc(doc(victor.banco, 'casas', 'n3' + sufixoM), novaCasaNova(victor, { mercados: Object.fromEntries(Array.from({ length: 6 }, (_, k) => ['m' + k, merc('M' + k, k)])) })));
await deve('"mercados" que não é mapa é recusado', 'recusado', () => setDoc(doc(victor.banco, 'casas', 'n4' + sufixoM), novaCasaNova(victor, { mercados: [1] })));
await deve('cidade com mais de 60 letras é recusada', 'recusado', () => setDoc(doc(victor.banco, 'casas', 'n5' + sufixoM), novaCasaNova(victor, { cidade: 'x'.repeat(61) })));
await deve('cidade que não é texto é recusada', 'recusado', () => setDoc(doc(victor.banco, 'casas', 'n6' + sufixoM), novaCasaNova(victor, { cidade: 7 })));
await deve('casa sem "categorias" continua recusada', 'recusado', () => { const c = novaCasaNova(victor); delete c.categorias; return setDoc(doc(victor.banco, 'casas', 'n7' + sufixoM), c); });
// a migração: documento no formato de antes (corredores + aprender no topo, cor em texto) → mercados, numa gravação só
const refVelha = doc(victor.banco, 'casas', 'v1' + sufixoM);
await setDoc(refVelha, casaBase(victor.email, victor.uid));
await deve('migração (1 gravação): cria o mercado Shibata, a cor de cada produto e tira corredores/aprender', 'permitido', () => updateDoc(refVelha, {
  'mercados.shibata': merc('Shibata'), 'itens.cafe.cor': { shibata: 'a' }, corredores: deleteField(), aprender: deleteField(), cidade: 'São José dos Campos (SP)',
}));
const migrada = (await getDoc(refVelha)).data();
ok('depois da migração o documento não tem mais "corredores" nem "aprender"', !('corredores' in migrada) && !('aprender' in migrada) && migrada.mercados.shibata.nome === 'Shibata' && migrada.itens.cafe.cor.shibata === 'a');
await deve('mexer só num campo aninhado do mercado (renomear, aprender, corredor de um produto)', 'permitido', () => updateDoc(refVelha, { 'mercados.shibata.nome': 'Shibata 2', 'mercados.shibata.aprender': true, 'itens.cafe.cor.shibata': 'a2' }));
await deve('criar o 2º mercado copiando os corredores (1 gravação, vários caminhos)', 'permitido', () => updateDoc(refVelha, { 'mercados.sams': merc("Sam's", 1), 'itens.cafe.cor.sams': 'k1' }));
await deve('"Estou no mercado" no formato novo { quando, mercado }', 'permitido', () => updateDoc(refVelha, { [`noMercado.${victor.uid}`]: { quando: 5, mercado: 'sams' } }));
await deve('apagar um mercado (deleteField) e a cor dele nos produtos', 'permitido', () => updateDoc(refVelha, { 'mercados.sams': deleteField(), 'itens.cafe.cor.sams': deleteField() }));
await deve('um aparelho com o app VELHO ainda consegue gravar "corredores" e "aprender" (as regras são um superset)', 'permitido', () => updateDoc(refVelha, { corredores: [{ id: 'z', nome: 'Z', ic: 'x' }], aprender: true }));
await deve('"aprender" velho com texto continua recusado', 'recusado', () => updateDoc(refVelha, { aprender: 'sim' }));
await deve('7º mercado por update é recusado', 'recusado', () => updateDoc(refVelha, Object.fromEntries(Array.from({ length: 6 }, (_, k) => ['mercados.x' + k, merc('X' + k, k + 5)]))));
// um produto que ainda tem cor em texto (formato velho) e o novo no mesmo documento: o servidor aceita; o app é que traduz
await deve('regravar "cor" de um produto como texto (aparelho velho) é aceito pelo servidor; o app lê os dois formatos', 'permitido', () => updateDoc(refVelha, { 'itens.cafe.cor': 'a' }));
await deve('depois disso, gravar o caminho aninhado itens.cafe.cor.shibata troca o texto por mapa (observado, não suposto)', 'permitido', () => updateDoc(refVelha, { 'itens.cafe.cor.shibata': 'a3' }));
const aposTexto = (await getDoc(refVelha)).data().itens.cafe.cor;
ok('...e o resultado é um mapa { shibata: "a3" }', typeof aposTexto === 'object' && aposTexto.shibata === 'a3', JSON.stringify(aposTexto));

console.log('\n--- preços: casas/{id}/dados/precos ---');
const refPrecos = (p, casaId = id) => doc(p.banco, 'casas', casaId, 'dados', 'precos');
const preco = (merc = 'shibata', c = 899) => ({ item: 'cafe', centavos: c, emb: '500 g', marca: 'Pilão', merc, quando: Date.now(), fonte: 'Victor', por: victor.uid });
await deve('Victor (da casa) cria o documento de preços com 1ª anotação (setDoc merge)', 'permitido', () => setDoc(refPrecos(victor), { p: { p1: preco() } }, { merge: true }));
await deve('Victor lê os preços', 'permitido', () => getDoc(refPrecos(victor)));
await deve('Ana (já da casa) lê e grava', 'permitido', async () => { await getDoc(refPrecos(ana)); await setDoc(refPrecos(ana), { p: { p2: { ...preco('sams', 1198), fonte: 'Ana', por: ana.uid } } }, { merge: true }); });
await deve('apagar uma anotação (deleteField dentro de p) e guardar outra na mesma gravação', 'permitido', () => setDoc(refPrecos(victor), { p: { p1: deleteField(), p3: preco('shibata', 850) } }, { merge: true }));
const dp = (await getDoc(refPrecos(victor))).data();
ok('o documento tem p2 e p3 (p1 foi apagada) e nenhuma outra chave', Object.keys(dp).join() === 'p' && Object.keys(dp.p).sort().join() === 'p2,p3', JSON.stringify(Object.keys(dp.p)));
await deve('intruso (de fora da casa) não lê os preços', 'recusado', () => getDoc(refPrecos(intruso)));
await deve('intruso não grava preços', 'recusado', () => setDoc(refPrecos(intruso), { p: { x: preco() } }, { merge: true }));
await deve('anônimo (sem e-mail) não lê nem grava', 'recusado', async () => { await getDoc(refPrecos(anonimo)); });
await deve('anônimo não grava', 'recusado', () => setDoc(refPrecos(anonimo), { p: { x: preco() } }, { merge: true }));
await deve('c5 (convidado que NÃO entrou) não lê os preços', 'recusado', () => getDoc(refPrecos(c5)));
await deve('ninguém lista os documentos de dados', 'recusado', () => getDocs(collection(victor.banco, 'casas', id, 'dados')));
await deve('outro nome de documento em dados/ é recusado (só "precos")', 'recusado', () => setDoc(doc(victor.banco, 'casas', id, 'dados', 'outro'), { p: {} }));
await deve('chave a mais no documento de preços é recusada', 'recusado', () => setDoc(refPrecos(victor), { lixo: 1 }, { merge: true }));
await deve('"p" que não é mapa é recusado', 'recusado', () => setDoc(refPrecos(victor), { p: [1, 2] }));
await deve('mais de 600 anotações é recusado', 'recusado', () => setDoc(refPrecos(victor), { p: Object.fromEntries(Array.from({ length: 601 }, (_, k) => ['q' + k, preco()])) }));
await deve('exatamente 600 anotações é aceito', 'permitido', () => setDoc(refPrecos(victor), { p: Object.fromEntries(Array.from({ length: 600 }, (_, k) => ['q' + k, preco()])) }));
await deve('apagar o documento de preços é recusado (nem quem é da casa)', 'recusado', () => deleteDoc(refPrecos(victor)));
await deve('preços de uma casa que NÃO é minha (casa do Victor, gravando como a Ana antes de entrar não existe; usa a casa n1)', 'recusado', () => setDoc(refPrecos(ana, 'n1' + sufixoM), { p: { x: preco() } }, { merge: true }));
await deve('preços de casa que não existe é recusado', 'recusado', () => setDoc(refPrecos(victor, 'casa-que-nao-existe'), { p: { x: preco() } }, { merge: true }));

console.log('\n--- as regras dos jogos continuam valendo ---');
await deve('jogador grava o próprio progresso em jogadores/{uid}/jogos/miaudoku', 'permitido', () => setDoc(doc(victor.banco, 'jogadores', victor.uid, 'jogos', 'miaudoku'), { x: 1 }));
await deve('jogador NÃO grava o progresso de outro', 'recusado', () => setDoc(doc(intruso.banco, 'jogadores', victor.uid, 'jogos', 'miaudoku'), { x: 2 }));
await deve('coleção inventada continua trancada', 'recusado', () => setDoc(doc(victor.banco, 'qualquer', 'coisa'), { x: 1 }));

console.log(falhas ? `\n${falhas} FALHOU(ARAM)` : '\nTUDO COMO ESPERADO');
await Promise.all(apps.map(deleteApp));
process.exit(falhas ? 1 : 0);
