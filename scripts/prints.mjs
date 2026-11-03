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

  await page.click('[data-tab="mercado"]'); await page.waitForTimeout(250); await foto('7-mercado');
  await page.click('#comecar'); await page.waitForTimeout(250);
  await page.evaluate(() => window.__acabou.remoto('manteiga')); await page.waitForTimeout(300);
  await page.locator('.linha.pick').first().click(); await page.locator('.linha.pick').nth(1).click();
  await page.locator('[data-nt]').nth(1).click(); await page.waitForTimeout(2300); await foto('8-mercado-comprando');
  await page.click('#terminar'); await page.waitForSelector('#okFim'); await page.waitForTimeout(400); await foto('9-fim-das-compras');
  await fechar();

  await page.click('[data-tab="organizar"]'); await page.waitForTimeout(250); await foto('10-organizar-corredores');
  await page.locator('[data-abre="corredores:acougue"]').click(); await page.waitForTimeout(200);
  await page.locator('[data-abre="corredores:acougue"]').scrollIntoViewIfNeeded(); await foto('11-corredor-ver');
  await page.locator('[data-ren="corredores:arroz"]').click(); await page.waitForSelector('#fTexto'); await page.waitForTimeout(400); await foto('12-renomear');
  await fechar();
  await page.locator('[data-emo="corredores:arroz"]').click(); await page.waitForSelector('#emoTec'); await page.waitForTimeout(400); await foto('13-seletor-corredor');
  await fechar();
  await page.locator('[data-del="corredores:acougue"]').click(); await page.waitForSelector('#fSim'); await page.waitForTimeout(400); await foto('14-apagar-corredor');
  await fechar();
  await page.click('[data-orgaba="categorias"]'); await page.waitForTimeout(250); await foto('15-organizar-categorias');
  await page.click('#avs'); await page.waitForSelector('#fSair'); await page.waitForTimeout(400); await foto('16-nossa-casa');
  await fechar();
  await ctx.close();
}
await browser.close();
console.log(erros.length ? 'ERROS: ' + erros.join(' | ') : 'prints prontos em ' + pasta + '/ (sem erros na página)');
