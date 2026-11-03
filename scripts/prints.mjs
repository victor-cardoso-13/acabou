// Prints automáticos nos aparelhos que importam. Uso: (npx vite --port 5199 rodando) node scripts/prints.mjs <pasta>
// Nunca iPhone SE. iPad 1180×820 e 820×1180; iPhone em pé 440×800 e 390×844; deitado 956×360.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const pasta = process.argv[2] ?? 'prints';
mkdirSync(pasta, { recursive: true });
const telas = { 'ipad-deitado': [1180, 820], 'ipad-em-pe': [820, 1180], 'iphone-em-pe': [440, 800], 'iphone-390': [390, 844], 'iphone-deitado': [956, 360] };
const browser = await chromium.launch();
for (const [nome, [width, height]] of Object.entries(telas)) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.goto('http://localhost:5199/');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${pasta}/${nome}.png` });
  await page.close();
}
await browser.close();
