// Testa as regras de casas/{casaId} (../Jogos/Computador/firestore.rules) no EMULADOR, sem tocar no banco de verdade.
// Pré-requisito: emulador ligado (Auth 9199, Firestore 8189), ver LEIA-ME.md dos testes de regras em Jogos/Computador.
// Uso: node scripts/testar-regras.mjs      Esperado: tudo "OK".
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInAnonymously } from 'firebase/auth';
import { collection, connectFirestoreEmulator, deleteDoc, deleteField, doc, getDoc, getDocs, getFirestore, query, setDoc, updateDoc, where } from 'firebase/firestore';

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

console.log('\n--- adicionar a Ana ---');
await deve('Victor adiciona o e-mail da Ana', 'permitido', () => updateDoc(ref(victor, id), { membros: [victor.email, ana.email] }));
n = (await getDocs(query(collection(ana.banco, 'casas'), where('membros', 'array-contains', ana.email)))).size;
ok('Ana (login com e-mail em maiúsculas) procura as casas dela e acha a casa', n === 1, `→ ${n}`);
await deve('Ana lê a casa', 'permitido', () => getDoc(ref(ana, id)));
await deve('Ana marca um produto, ao mesmo tempo que o Victor mexe em outro', 'permitido', () => Promise.all([
  updateDoc(ref(ana, id), { 'itens.cafe.falta': false, 'itens.cafe.quem': 'Ana' }),
  updateDoc(ref(victor, id), { aprender: false }),
]));
const d = (await getDoc(ref(victor, id))).data();
ok('as duas gravações simultâneas ficaram (nenhuma apagou a outra)', d.itens.cafe.quem === 'Ana' && d.aprender === false);
await deve('Ana apagar a casa é recusado', 'recusado', () => deleteDoc(ref(ana, id)));
await deve('Ana adiciona um 3º e um 4º membro', 'permitido', () => updateDoc(ref(ana, id), { membros: [victor.email, ana.email, 'c@c.com', 'd@d.com'] }));
await deve('um 5º membro é recusado (máximo 4)', 'recusado', () => updateDoc(ref(ana, id), { membros: [victor.email, ana.email, 'c@c.com', 'd@d.com', 'e@e.com'] }));
await deve('intruso continua de fora', 'recusado', () => getDoc(ref(intruso, id)));

console.log('\n--- as regras dos jogos continuam valendo ---');
await deve('jogador grava o próprio progresso em jogadores/{uid}/jogos/miaudoku', 'permitido', () => setDoc(doc(victor.banco, 'jogadores', victor.uid, 'jogos', 'miaudoku'), { x: 1 }));
await deve('jogador NÃO grava o progresso de outro', 'recusado', () => setDoc(doc(intruso.banco, 'jogadores', victor.uid, 'jogos', 'miaudoku'), { x: 2 }));
await deve('coleção inventada continua trancada', 'recusado', () => setDoc(doc(victor.banco, 'qualquer', 'coisa'), { x: 1 }));

console.log(falhas ? `\n${falhas} FALHOU(ARAM)` : '\nTUDO COMO ESPERADO');
await Promise.all(apps.map(deleteApp));
process.exit(falhas ? 1 : 0);
