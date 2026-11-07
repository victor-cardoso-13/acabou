// Confere (modo ?demo, npx vite --port 5199 rodando): o aviso fica acima das abas e do "Terminar compras", e o atalho de categoria não pula.
import { chromium } from 'playwright';
const tamanhos = { 'iphone-390': [390, 844], 'iphone-deitado': [956, 360], 'ipad': [1180, 820], 'iphone-393-seguro': [393, 852] };
const browser = await chromium.launch();
let falhas = 0;
const ok = (r, b, x = '') => { if (!b) falhas++; console.log(b ? 'OK    ' : 'FALHOU', r, x); };
for (const [nome, [width, height]] of Object.entries(tamanhos)) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  if (nome.includes('seguro')) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 59, bottom: 34, left: 0, right: 0 } }).catch(() => {}); }
  await page.goto('http://localhost:5199/?demo'); await page.waitForSelector('.item');
  const caixa = sel => page.locator(sel).first().boundingBox();
  // atalho de categoria
  await page.locator('.pulo').nth(4).click(); await page.waitForTimeout(80);
  const g = await page.evaluate(() => { const c = document.getElementById('conteudo').getBoundingClientRect(); const b = document.getElementById('pulos').getBoundingClientRect(); const t = document.querySelector('.grupo h3[id], .grupo').getBoundingClientRect(); return { c: c.top, b: b.bottom, rolou: document.getElementById('conteudo').scrollTop }; });
  ok(`${nome}: atalho rolou de uma vez`, g.rolou > 0, `scrollTop=${g.rolou}`);
  const alvo = await page.evaluate(() => { const el = document.getElementById('g-' + document.querySelectorAll('.pulo')[4].dataset.pula).getBoundingClientRect(); const b = document.getElementById('pulos').getBoundingClientRect(); return { topo: el.top, barra: b.bottom }; });
  ok(`${nome}: categoria para logo abaixo da barra`, alvo.topo >= alvo.barra - 1 && alvo.topo - alvo.barra < 30, `${alvo.topo.toFixed(0)} vs ${alvo.barra.toFixed(0)}`);
  // aviso
  await page.click('[data-tab="mercado"]'); await page.waitForTimeout(200);
  await page.click('#comecar'); await page.waitForTimeout(400);
  let a = await caixa('#aviso'), abas = await caixa('.abas'), fx = await caixa('#terminar');
  ok(`${nome}: aviso acima do Terminar compras`, a.y + a.height <= fx.y + 1, `aviso fim ${(a.y + a.height).toFixed(0)} · terminar topo ${fx.y.toFixed(0)}`);
  ok(`${nome}: aviso não tampa as abas`, a.y + a.height <= abas.y);
  await page.click('#terminar'); await page.waitForSelector('#okFim'); await page.click('#okFim'); await page.click('[data-tab="mercado"]');
  await page.waitForTimeout(100);
  await page.click('[data-tab="casa"]'); await page.locator('.item').first().click(); await page.waitForTimeout(400);
  a = await caixa('#aviso'); abas = await caixa('.abas');
  ok(`${nome}: aviso (sem Terminar) acima das abas`, a.y + a.height <= abas.y, `aviso fim ${(a.y + a.height).toFixed(0)} · abas topo ${abas.y.toFixed(0)}`);
  await ctx.close();
}
await browser.close();
console.log(falhas ? `${falhas} FALHA(S)` : 'tudo OK');
process.exit(falhas ? 1 : 0);
