// Prints automáticos nos aparelhos que importam, de TODAS as telas e janelas (modo ?demo do "npm run dev").
// Uso: (npx vite --port 5199 rodando) node scripts/prints.mjs <pasta>
// Nunca iPhone SE. iPad 1180×820 e 820×1180; iPhone em pé 440×800 e 390×844; deitado 956×360;
// mais um 393×852 com área segura (topo 59, base 34) só para ver que nada quebrou.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const pasta = process.argv[2] ?? 'prints';
mkdirSync(pasta, { recursive: true });
const telas = {
  'ipad-deitado': [1180, 820], 'ipad-em-pe': [820, 1180],
  'iphone-440': [440, 800], 'iphone-390': [390, 844], 'iphone-deitado': [956, 360], 'iphone-393-seguro': [393, 852],
};
const browser = await chromium.launch();
const erros = [];
for (const [nome, [width, height]] of Object.entries(telas)) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => erros.push(`${nome}: ${e.message}`));
  if (nome.includes('seguro')) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 59, bottom: 34, left: 0, right: 0 } }).catch(() => {});
  }
  const foto = async quem => page.screenshot({ path: `${pasta}/${nome}-${quem}.png` });
  const fechar = async () => { await page.evaluate(() => { document.getElementById('folha').innerHTML = ''; }); };
  await page.goto('http://localhost:5199/?demo');
  await page.waitForSelector('.item');
  await page.waitForTimeout(300);

  await foto('1-em-casa');
  await page.fill('#busca', 'acuc'); await page.waitForTimeout(150); await foto('2-busca');
  await page.fill('#busca', 'maizena'); await page.waitForTimeout(150); await foto('3-busca-criar');
  await page.click('[data-criar]'); await page.waitForSelector('#fSalvar'); await page.waitForTimeout(400); await foto('4-produto-novo');
  await page.click('#fEmo'); await page.waitForSelector('#emoTec'); await page.waitForTimeout(400); await foto('5-seletor-figurinhas');
  await fechar(); await page.fill('#busca', '');
  // segurar o dedo num botão = editar
  const caixa = await page.locator('[data-id="cafe"]').boundingBox();
  await page.locator('[data-id="cafe"]').scrollIntoViewIfNeeded();
  const c2 = await page.locator('[data-id="cafe"]').boundingBox();
  await page.mouse.move(c2.x + c2.width / 2, c2.y + c2.height / 2); await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up();
  await page.waitForSelector('#fApagar', { timeout: 3000 }).catch(() => {}); await page.waitForTimeout(400); await foto('6-editar-produto');
  await fechar();

  const tab = async t => { await page.click(`[data-tab="${t}"]`); await page.waitForTimeout(250); };
  await tab('mercado'); await foto('7-mercado-shibata');
  await page.click('[data-merc="sams"]'); await page.waitForTimeout(200); await foto('7b-mercado-sams-etiquetas');
  await page.click('[data-merc="shibata"]'); await page.waitForTimeout(150);
  await page.click('#comecar'); await page.waitForTimeout(250);
  await page.evaluate(() => window.__acabou.remoto('manteiga')); await page.waitForTimeout(300);
  await page.locator('.linha.pick').first().click(); await page.locator('.linha.pick').nth(1).click();
  await page.locator('[data-nt]').nth(1).click(); await page.waitForTimeout(2300); await foto('8-mercado-comprando');
  await page.click('#terminar'); await page.waitForSelector('#okFim'); await page.waitForTimeout(400); await foto('9-fim-das-compras');
  await fechar();
  // comprando no Sam's: "qual corredor?", carrinho com R$, janela de preço já preenchida
  await tab('mercado'); await page.click('[data-merc="sams"]'); await page.click('#comecar'); await page.waitForTimeout(300);
  await page.waitForSelector('[data-qual]'); await foto('8b-comprando-sams-qual-corredor');
  await page.locator('[data-qual]').first().click(); await page.waitForSelector('[data-qc]'); await page.waitForTimeout(400); await foto('8c-janela-qual-corredor');
  await page.locator('[data-qc]').first().click(); await page.waitForTimeout(200);
  await page.locator('.linha.pick').first().click(); await page.waitForTimeout(300); await foto('8d-carrinho-com-R$');
  await page.locator('.no-carrinho [data-anotar]').first().click(); await page.waitForSelector('#fSalvar'); await page.waitForTimeout(400); await foto('8e-anotar-no-carrinho');
  await fechar();
  await page.click('#terminar'); await page.waitForSelector('#okFim'); await page.click('#okFim'); await page.waitForTimeout(200);

  await tab('precos'); await foto('17-precos');
  await page.fill('#buscaPreco', 'caf'); await page.waitForTimeout(150); await foto('18-precos-busca'); await page.fill('#buscaPreco', '');
  await page.click('#anotarNovo'); await page.waitForSelector('#fProd'); await page.fill('#fProd', 'caf'); await page.waitForTimeout(300); await foto('19-anotar-preco-escolher');
  await page.locator('[data-fprod]').first().click(); await page.waitForTimeout(300); await page.fill('#fValor', '8,99'); await page.fill('#fEmb', '500 g'); await page.locator('[data-fm]').first().click(); await page.waitForTimeout(300); await foto('20-anotar-preco-pronto');
  await page.click('#fSalvar'); await page.waitForTimeout(400); await foto('21-preco-salvo-aviso');
  await page.click('#perguntar'); await page.waitForSelector('#fPerg'); await page.waitForTimeout(400); await foto('22-perguntar-ao-claude');
  await fechar();
  await page.click('#colar'); await page.waitForSelector('#fResp'); await page.fill('#fResp', 'oi'); await page.click('#fGuardar'); await page.waitForTimeout(300); await foto('23-colar-resposta-erro');
  await page.fill('#fResp', 'Resumo...\nACABOU\nPão francês | Shibata: R$ 6,36 (5 un ~400 g, padaria da loja) | Sam’s Club: R$ 29,98 (1,3 kg, Member’s Mark)\nAlho | Shibata: R$ 5,98 (~200 g a granel, sem marca) | Sam’s Club: R$ 32,98 (500 g, Member’s Mark)'); await page.waitForTimeout(200); await foto('24-colar-resposta-pronta');
  await page.click('#fGuardar'); await page.waitForTimeout(400); await foto('25-respostas-guardadas');
  await page.click('#cidade'); await page.waitForSelector('#fTexto'); await page.waitForTimeout(300); await foto('26-cidade'); await fechar();

  await tab('organizar'); await foto('10-organizar-corredores');
  await page.locator('[data-abre="corredores:acougue"]').click(); await page.waitForTimeout(200);
  await page.locator('[data-abre="corredores:acougue"]').scrollIntoViewIfNeeded(); await foto('11-corredor-ver');
  await page.locator('[data-ren="corredores:arroz"]').click(); await page.waitForSelector('#fTexto'); await page.waitForTimeout(400); await foto('12-renomear');
  await fechar();
  await page.locator('[data-emo="corredores:arroz"]').click(); await page.waitForSelector('#emoTec'); await page.waitForTimeout(400); await foto('13-seletor-corredor');
  await fechar();
  await page.locator('[data-del="corredores:acougue"]').click(); await page.waitForSelector('#fSim'); await page.waitForTimeout(400); await foto('14-apagar-corredor');
  await fechar();
  await page.click('[data-orgmerc="sams"]'); await page.waitForTimeout(250); await foto('10b-organizar-sams');
  await page.evaluate(() => { document.getElementById('conteudo').scrollTop = 99999; }); await page.waitForTimeout(150); await foto('10c-organizar-sams-fim');
  await page.click('#editMerc'); await page.waitForSelector('#fSite'); await page.waitForTimeout(300); await foto('10d-editar-mercado'); await fechar();
  await page.click('#delMerc'); await page.waitForSelector('#fSim'); await page.waitForTimeout(300); await foto('10e-apagar-mercado'); await fechar();
  await page.evaluate(() => { document.getElementById('conteudo').scrollTop = 0; });
  await page.click('#novoMerc'); await page.waitForSelector('#fCriar'); await page.waitForTimeout(400); await foto('10f-mercado-novo');
  await page.fill('#fSite', 'http://errado'); await page.fill('#fMerc', 'Atacadão'); await page.click('#fCriar'); await page.waitForTimeout(200); await foto('10g-mercado-novo-erro');
  await fechar();
  await page.click('[data-orgaba="categorias"]'); await page.waitForTimeout(250); await foto('15-organizar-categorias');
  await page.click('#avs'); await page.waitForSelector('#fSair'); await page.waitForTimeout(400); await foto('16-nossa-casa');
  await fechar();
  // editar produto com a barrinha de mercados
  await tab('casa'); await page.locator('[data-id="cafe"]').scrollIntoViewIfNeeded();
  const c3 = await page.locator('[data-id="cafe"]').boundingBox();
  await page.mouse.move(c3.x + c3.width / 2, c3.y + c3.height / 2); await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up();
  await page.waitForSelector('#fApagar', { timeout: 3000 }).catch(() => {}); await page.click('[data-fmerc="sams"]').catch(() => {}); await page.waitForTimeout(300); await foto('6b-editar-produto-sams');
  await fechar();
  await ctx.close();
}
await browser.close();
console.log(erros.length ? 'ERROS: ' + erros.join(' | ') : 'prints prontos em ' + pasta + '/ (sem erros na página)');
