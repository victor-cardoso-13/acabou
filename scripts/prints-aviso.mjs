// Prints do aviso acima das abas e acima do "Terminar compras" (modo ?demo).
import { chromium } from 'playwright';
const pasta = process.argv[2] ?? 'prints';
const b = await chromium.launch();
for (const [n, w, h] of [['390', 390, 844], ['deitado', 956, 360]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 }); const p = await ctx.newPage();
  await p.goto('http://localhost:5199/?demo'); await p.waitForSelector('.item');
  await p.locator('.item').first().click(); await p.waitForTimeout(400); await p.screenshot({ path: `${pasta}/aviso-abas-${n}.png` });
  await p.click('[data-tab="mercado"]'); await p.click('#comecar'); await p.waitForTimeout(400); await p.screenshot({ path: `${pasta}/aviso-terminar-${n}.png` });
  await ctx.close();
}
await b.close();
