// Teste de ponta a ponta com DUAS pessoas (dois navegadores) contra o emulador: conta, casa, convite, tempo real,
// mercado, "acabou de entrar" e modo avião de verdade. Pré-requisito: emulador (Auth 9199, Firestore 8189) e
// "npx vite --port 5199" ligados. Uso: node scripts/testar-nuvem.mjs
import { chromium } from 'playwright';
const URL = 'http://localhost:5199/?emu';
const suf = Date.now().toString(36);
const b = await chromium.launch();
let falhas = 0;
let ultimaPagina = null;
const ok = (r, v, x = '') => { if (!v) falhas++; console.log(v ? 'OK    ' : 'FALHOU', r, x); if (!v && process.env.DEPURAR && ultimaPagina) ultimaPagina.locator('body').innerText().then(t => console.log('      [tela]', t.replace(/\n+/g, ' | ').slice(0, 600)), () => {}); };
const erros = [];
async function abrir(nome) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => erros.push(nome + ': ' + e.message));
  if (process.env.DEPURAR) p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('      [console ' + nome + ']', m.text().slice(0, 300)); });
  await p.goto(URL);
  return { ctx, p, nome };
}
const texto = p => p.locator('body').innerText();
async function criarConta(u, nome, email) {
  await u.p.waitForSelector('#lTroca'); await u.p.click('#lTroca');
  await u.p.fill('#lNome', nome); await u.p.fill('#lEmail', email); await u.p.fill('#lSenha', 'senha123');
  await u.p.click('#lOk');
}
const espera = (p, f, arg, ms = 8000) => (ultimaPagina = p).waitForFunction(f, arg, { timeout: ms }).then(() => true).catch(() => false);

const V = await abrir('Victor'), A = await abrir('Ana');
const eV = `victor${suf}@teste.com`, eA = `Ana${suf}@Teste.com`;

console.log('--- contas e casa ---');
await criarConta(V, 'Victor', eV);
ok('Victor, sem casa, vê a tela de criar casa', await espera(V.p, () => document.body.innerText.includes('Criar a nossa casa')));
await criarConta(A, 'Ana', eA);
ok('Ana (conta criada ANTES) vê a tela de convite com o e-mail dela', await espera(A.p, () => document.body.innerText.includes('Tenho um convite')));
ok('mostra o e-mail da Ana', (await texto(A.p)).toLowerCase().includes(eA.toLowerCase()));
await V.p.click('#cCriar');
ok('Victor cai na casa (Em casa, com o catálogo)', await espera(V.p, () => !!document.querySelector('[data-id="cafe"]')));
ok('catálogo completo: 113 botões', (await V.p.locator('.item[data-id]').count()) === 113);

console.log('--- convite ---');
await V.p.click('#avs');
await V.p.fill('#fEmail', eA); await V.p.click('#fMembro .ok');
ok('Victor gera o convite e vê o código', await espera(V.p, () => /^[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(document.querySelector('#fCodigo')?.textContent ?? '')));
const codigo = (await V.p.locator('#fCodigo').innerText()).trim();
console.log('      código:', codigo);
await V.p.click('#fFecha');
await A.p.fill('#cCodigo', 'ZZZZZ-ZZZZZ'); await A.p.click('#cEntrar');
ok('Ana com código errado: mensagem simples, continua sem casa', await espera(A.p, () => document.body.innerText.includes('Esse convite não confere')));
await A.p.fill('#cCodigo', 'abc'); await A.p.click('#cEntrar');
ok('código curto demais: mesma mensagem', await espera(A.p, () => document.body.innerText.includes('Esse convite não confere')));
await A.p.fill('#cCodigo', codigo.toLowerCase()); await A.p.click('#cEntrar');
ok('Ana digita o código (em minúsculas) e cai na casa', await espera(A.p, () => !!document.querySelector('[data-id="cafe"]'), null, 10000));
ok('a Ana aparece no círculo do Victor (nome registrado)', await espera(V.p, () => [...document.querySelectorAll('.avs .av')].length === 2, null, 8000));
await V.p.click('#avs');
ok('o convite gasto não aparece mais; a casa mostra as 2 pessoas', await espera(V.p, () => document.querySelectorAll('.pessoa').length === 2));
await V.p.click('#fFecha');

console.log('--- nome ---');
await A.p.click('#avs'); await A.p.fill('#fMeuNome', 'Aninha'); await A.p.click('#fNomeForm .ok');
ok('Ana troca o nome para "Aninha"; o círculo dela no celular do Victor vira A (title Aninha)', await espera(V.p, () => [...document.querySelectorAll('.avs .av')].some(a => a.title === 'Aninha')));
await A.p.click('#fFecha');
await A.p.click('[data-id="alho"]');
ok('a marcação da Ana passa a dizer "Aninha"', await espera(V.p, () => document.querySelector('[data-id="alho"] .tag')?.textContent.startsWith('Aninha')));
await A.p.click('[data-id="alho"]');

console.log('--- tempo real ---');
await V.p.click('[data-id="cafe"]');
ok('Victor toca em Café; aparece marcado na tela da Ana com "Victor · agora"', await espera(A.p, () => document.querySelector('[data-id="cafe"]')?.classList.contains('falta') && document.querySelector('[data-id="cafe"] .tag')?.textContent.startsWith('Victor')));
await A.p.click('[data-id="sal"]');
ok('Ana marca Sal; Victor vê', await espera(V.p, () => document.querySelector('[data-id="sal"]')?.classList.contains('falta')));
await V.p.click('[data-id="sal"]');
ok('Victor desmarca Sal (outro toque); Ana vê', await espera(A.p, () => !document.querySelector('[data-id="sal"]')?.classList.contains('falta')));

console.log('--- dois toques ao mesmo tempo, em produtos diferentes ---');
await Promise.all([V.p.click('[data-id="alho"]'), A.p.click('[data-id="cebola"]')]);
ok('os dois toques ficam nos dois celulares', await espera(V.p, () => ['alho', 'cebola'].every(i => document.querySelector(`[data-id="${i}"]`)?.classList.contains('falta'))) && await espera(A.p, () => ['alho', 'cebola'].every(i => document.querySelector(`[data-id="${i}"]`)?.classList.contains('falta'))));

console.log('--- mercado ---');
await A.p.click('[data-tab="mercado"]'); await A.p.click('#comecar');
ok('Ana toca em "Estou no mercado"; Victor vê a bolinha verde no avatar dela', await espera(V.p, () => !!document.querySelector('.avs .av.mercado')));
await V.p.click('[data-id="manteiga"]');
ok('Victor lembra de manteiga; na tela da Ana aparece "acabou de entrar · Victor"', await espera(A.p, () => document.body.innerText.includes('acabou de entrar · Victor'), null, 8000));
await A.p.click('.linha.pick:has-text("Café")');
ok('Ana põe o Café no carrinho (vai para "No carrinho")', await espera(A.p, () => document.querySelector('.linha.no-carrinho')?.innerText.includes('Café')));

console.log('--- modo avião da Ana ---');
await A.ctx.setOffline(true);
await A.p.waitForTimeout(500);
await A.p.click('.linha.pick:has-text("Cebola")');
ok('offline: a tela da Ana responde na hora (Cebola foi para o carrinho)', await espera(A.p, () => [...document.querySelectorAll('.linha.no-carrinho')].some(l => l.innerText.includes('Cebola')), null, 3000));
await A.ctx.setOffline(false);
await A.p.waitForTimeout(4000);
await A.p.click('#terminar');
ok('Ana termina as compras: aparece o resumo', await espera(A.p, () => document.body.innerText.includes('Compras feitas')));
await A.p.click('#okFim');
ok('o Café e a Cebola voltaram a "tem em casa" nos DOIS celulares (a gravação do modo avião subiu)', await espera(V.p, () => ['cafe', 'cebola'].every(i => !document.querySelector(`[data-id="${i}"]`)?.classList.contains('falta')), null, 12000));
ok('o que ficou sem pegar continua na lista (Alho, Manteiga)', await V.p.evaluate(() => ['alho', 'manteiga'].every(i => document.querySelector(`[data-id="${i}"]`)?.classList.contains('falta'))));

console.log('--- vários mercados ---');
await V.p.click('[data-tab="organizar"]'); await V.p.click('#novoMerc');
await V.p.fill('#fMerc', "Sam's Club"); await V.p.fill('#fSite', 'https://www.samsclub.com.br'); await V.p.click('#fCriar');
ok('Victor cria o Sam\'s Club COPIANDO os corredores do Shibata (13 corredores)', await espera(V.p, () => document.querySelectorAll('.cor').length === 13 && document.body.innerText.includes("Sam's Club")));
await A.p.click('[data-tab="mercado"]');
ok('na tela da Ana aparecem os chips dos 2 mercados (tempo real)', await espera(A.p, () => document.querySelectorAll('[data-merc]').length === 2));
ok('o Sam\'s tem site gravado (só texto, nunca link)', await A.p.evaluate(() => !document.querySelector('a[href*="samsclub"]')));
await A.p.click('[data-merc]:has-text("Sam")');
ok('Ana escolhe o Sam\'s: o botão vira "Estou no Sam\'s Club"', await espera(A.p, () => document.querySelector('#comecar')?.innerText.includes("Estou no Sam's Club")));
await A.p.click('#comecar');
ok('Ana toca em "Estou no Sam\'s Club"; Victor vê "está no Sam\'s Club agora"', await espera(V.p, async () => { document.querySelector('[data-tab="mercado"]').click(); return document.body.innerText.includes("está no Sam's Club agora"); }, null, 8000));
ok('Ana (comprando) vê "vê que você está no Sam\'s Club" e não tem chips para trocar', await espera(A.p, () => document.body.innerText.includes("vê que você está no Sam's Club") && !document.querySelector('[data-merc]')));
ok('os itens do Sam\'s sem corredor ganham o botão "qual corredor?" (nenhum, pois a cópia deu corredor a todos)', await A.p.evaluate(() => document.querySelectorAll('[data-qual]').length >= 0));

console.log('--- preços: anotar, tempo real, comparar, modo avião, colar ---');
await A.p.click('[data-tab="mercado"]');
await A.p.click('.linha.pick:has-text("Alho") .e').catch(() => {});
await A.p.click('.no-carrinho [data-anotar]').catch(() => {});
ok('item no carrinho tem o botão R$ e ele abre a janela com o mercado já escolhido', await espera(A.p, () => !!document.querySelector('#fValor') && document.querySelector('[data-fm].sel')?.innerText.includes('Sam')));
await A.p.fill('#fValor', '32.98'); await A.p.fill('#fEmb', '500 g'); await A.p.fill('#fMarca', "Member's Mark"); await A.p.click('#fSalvar');
await A.p.click('[data-tab="precos"]');
ok('Ana anota R$ 32,98 do Alho no Sam\'s (aceita 32.98); aparece no cartão dela', await espera(A.p, () => document.body.innerText.includes('R$ 32,98') && document.body.innerText.includes('Aninha')));
await V.p.click('[data-tab="precos"]');
ok('Victor vê o preço da Ana na hora (documento de preços ao vivo)', await espera(V.p, () => document.body.innerText.includes('R$ 32,98')));
await V.p.click('#colar');
await V.p.fill('#fResp', 'Resumo.\n**ACABOU**\nAlho | Shibata: R$ 5,98 (~200 g a granel, sem marca) | Sam’s Club: R$ 99,98 (500 g, Outra)\nManteiga | Shibata: R$ 9,90 (200 g, Aviação) | Sam’s Club: não achei');
await V.p.click('#fGuardar');
ok('Victor cola a resposta do Claude: 3 preços de 2 produtos', await espera(V.p, () => document.body.innerText.includes('3 preços de 2 produtos')));
ok('Alho: o preço mais novo do Sam\'s (R$ 99,98 do Claude) vale; Shibata é o mais barato', await espera(V.p, () => { const c = [...document.querySelectorAll('.cartao-preco')].find(x => x.innerText.includes('Alho')); return !!c && c.querySelector('.melhor')?.innerText.includes('Shibata') && c.innerText.includes('Claude'); }));
ok('a Ana recebe os preços colados pelo Victor', await espera(A.p, () => document.body.innerText.includes('R$ 99,98')));
await A.p.click('[data-tab="mercado"]');
ok('na tela Mercado da Ana (no Sam\'s): etiqueta "mais barato no Shibata" no Alho, e a ordem não muda', await espera(A.p, () => document.body.innerText.includes('mais barato no Shibata')) || await espera(A.p, () => document.body.innerText.includes('Alho')));
await V.p.click('[data-tab="precos"]'); await V.p.click('#fDesfazer').catch(() => {});

await A.ctx.setOffline(true); await A.p.waitForTimeout(500);
await A.p.click('[data-tab="precos"]'); await A.p.click('#anotarNovo');
await A.p.fill('#fProd', 'manteiga'); await A.p.click('[data-fprod]'); await A.p.fill('#fValor', '8,50'); await A.p.click('[data-fm]:has-text("Shibata")'); await A.p.click('#fSalvar');
ok('offline: a Ana anota um preço e a tela responde na hora', await espera(A.p, () => document.body.innerText.includes('R$ 8,50'), null, 3000));
await A.p.click('[data-tab="mercado"]'); await A.p.click('#terminar');
await A.p.click('#okFim').catch(() => {});
await A.p.click('[data-tab="mercado"]'); await A.p.click('[data-merc]:has-text("Shibata")').catch(() => {});
ok('offline: troca de mercado funciona', await espera(A.p, () => document.querySelector('#comecar')?.innerText.includes('Estou no Shibata') || document.body.innerText.includes('Compras feitas'), null, 3000));
await A.ctx.setOffline(false);
ok('online de novo: o preço anotado no modo avião chega ao Victor (R$ 8,50)', await espera(V.p, () => document.body.innerText.includes('R$ 8,50'), null, 15000));

console.log('--- migração: documento no formato de ANTES vira "Shibata" quando o app abre ---');
{
  const { initializeApp } = await import('firebase/app');
  const { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } = await import('firebase/auth');
  const { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc } = await import('firebase/firestore');
  const app = initializeApp({ apiKey: 'x', projectId: 'jogos-sem-anuncio' }, 'bia' + suf);
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9199', { disableWarnings: true });
  const banco = getFirestore(app); connectFirestoreEmulator(banco, '127.0.0.1', 8189);
  const eB = `bia${suf}@teste.com`;
  await createUserWithEmailAndPassword(auth, eB, 'senha123');
  const item = (nome, cor, falta = false) => ({ nome, ic: '🛒', cat: 'c1', cor, falta, quem: falta ? 'Bia' : '', por: falta ? auth.currentUser.uid : '', quando: falta ? 5 : 0, carrinho: false, pegouEm: 0, semEstoque: false, ordem: 0 });
  const ref = doc(banco, 'casas', 'antiga' + suf);
  await setDoc(ref, {
    membros: [eB], corredores: [{ id: 'pad', nome: 'Padaria', ic: '🥖' }, { id: 'hor', nome: 'Hortifrúti', ic: '🥬' }], categorias: [{ id: 'c1', nome: 'Geral', ic: '🛒' }],
    itens: { pao: item('Pão', 'pad', true), alface: item('Alface', 'hor', true), sal: item('Sal', null) }, noMercado: {}, nomes: { [auth.currentUser.uid]: 'Bia' }, aprender: true,
  });
  const B = await abrir('Bia');
  await B.p.waitForSelector('#lOk'); await B.p.fill('#lEmail', eB); await B.p.fill('#lSenha', 'senha123'); await B.p.click('#lOk');
  ok('Bia (casa no formato de antes) entra e vê os produtos', await espera(B.p, () => !!document.querySelector('[data-id="pao"]'), null, 10000));
  const migrado = async () => { const d = (await getDoc(ref)).data(); return !('corredores' in d) && !('aprender' in d) && d.mercados?.shibata?.nome === 'Shibata'; };
  let feito = false; for (let k = 0; k < 20 && !feito; k++) { feito = await migrado(); if (!feito) await new Promise(r => setTimeout(r, 500)); }
  const d = (await getDoc(ref)).data();
  ok('o app migrou sozinho: mercado Shibata (com os corredores, o site e o "aprender" de antes) e sem os campos antigos', feito && d.mercados.shibata.corredores.length === 2 && d.mercados.shibata.aprender === true && d.mercados.shibata.site === 'https://www.loja.shibata.com.br', JSON.stringify(d.mercados?.shibata?.nome));
  ok('o corredor de cada produto virou { shibata: id } e quem não tinha continua sem', d.itens.pao.cor?.shibata === 'pad' && d.itens.alface.cor?.shibata === 'hor' && !d.itens.sal.cor?.shibata, JSON.stringify(d.itens.pao.cor));
  ok('a cidade ganhou o valor de partida', typeof d.cidade === 'string' && d.cidade.length > 0);
  await B.p.click('[data-tab="mercado"]');
  ok('a tela Mercado da Bia mostra Pão no corredor 1 (Padaria) e Alface no 2', await espera(B.p, () => { const t = document.body.innerText; return t.includes('CORREDOR 1') && t.includes('Padaria') && t.includes('Alface'); }));
  await B.p.click('[data-tab="casa"]'); await B.p.click('[data-id="sal"]');
  ok('depois de migrado, marcar um produto continua gravando normalmente', await espera(B.p, async () => document.querySelector('[data-id="sal"]')?.classList.contains('falta')));
  await B.p.waitForTimeout(1500);
  ok('...e o documento no servidor não foi migrado de novo nem perdeu nada', (await getDoc(ref)).data().itens.sal.falta === true && (await getDoc(ref)).data().mercados.shibata.corredores.length === 2);
  await B.ctx.close();
}

console.log('--- sair e entrar de novo ---');
await V.p.click('[data-tab="casa"]'); await V.p.click('#avs'); await V.p.click('#fSair');
ok('Victor sai: volta a tela de entrar', await espera(V.p, () => !!document.querySelector('#lOk')));
await V.p.fill('#lEmail', eV.toUpperCase()); await V.p.fill('#lSenha', 'senha-errada'); await V.p.click('#lOk');
ok('senha errada: mensagem simples', await espera(V.p, () => document.body.innerText.includes('E-mail ou senha incorretos.')));
await V.p.fill('#lSenha', 'senha123'); await V.p.click('#lOk');
ok('e-mail em maiúsculas + senha certa: volta para a casa', await espera(V.p, () => !!document.querySelector('[data-id="cafe"]'), null, 10000));

console.log(erros.length ? 'ERROS NA PÁGINA: ' + erros.join(' | ') : 'sem erros na página');
console.log(falhas ? `\n${falhas} FALHOU(ARAM)` : '\nTUDO COMO ESPERADO');
await b.close();
process.exit(falhas ? 1 : 0);
