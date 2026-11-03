// Teste de ponta a ponta com DUAS pessoas (dois navegadores) contra o emulador: conta, casa, convite, tempo real,
// mercado, "acabou de entrar" e modo avião de verdade. Pré-requisito: emulador (Auth 9199, Firestore 8189) e
// "npx vite --port 5199" ligados. Uso: node scripts/testar-nuvem.mjs
import { chromium } from 'playwright';
const URL = 'http://localhost:5199/?emu';
const suf = Date.now().toString(36);
const b = await chromium.launch();
let falhas = 0;
const ok = (r, v, x = '') => { if (!v) falhas++; console.log(v ? 'OK    ' : 'FALHOU', r, x); };
const erros = [];
async function abrir(nome) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => erros.push(nome + ': ' + e.message));
  await p.goto(URL);
  return { ctx, p, nome };
}
const texto = p => p.locator('body').innerText();
async function criarConta(u, nome, email) {
  await u.p.waitForSelector('#lTroca'); await u.p.click('#lTroca');
  await u.p.fill('#lNome', nome); await u.p.fill('#lEmail', email); await u.p.fill('#lSenha', 'senha123');
  await u.p.click('#lOk');
}
const espera = (p, f, arg, ms = 8000) => p.waitForFunction(f, arg, { timeout: ms }).then(() => true).catch(() => false);

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

console.log('--- sair e entrar de novo ---');
await V.p.click('#avs'); await V.p.click('#fSair');
ok('Victor sai: volta a tela de entrar', await espera(V.p, () => !!document.querySelector('#lOk')));
await V.p.fill('#lEmail', eV.toUpperCase()); await V.p.fill('#lSenha', 'senha-errada'); await V.p.click('#lOk');
ok('senha errada: mensagem simples', await espera(V.p, () => document.body.innerText.includes('E-mail ou senha incorretos.')));
await V.p.fill('#lSenha', 'senha123'); await V.p.click('#lOk');
ok('e-mail em maiúsculas + senha certa: volta para a casa', await espera(V.p, () => !!document.querySelector('[data-id="cafe"]'), null, 10000));

console.log(erros.length ? 'ERROS NA PÁGINA: ' + erros.join(' | ') : 'sem erros na página');
console.log(falhas ? `\n${falhas} FALHOU(ARAM)` : '\nTUDO COMO ESPERADO');
await b.close();
process.exit(falhas ? 1 : 0);
