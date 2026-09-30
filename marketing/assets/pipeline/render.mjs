import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
const manifest = JSON.parse(readFileSync('work/compose/manifest.json', 'utf8'));
const only = process.argv[2];
const b = await chromium.launch();
for (const m of manifest) {
  if (only && !m.name.includes(only)) continue;
  const p = await b.newPage({ viewport: { width: m.width, height: m.height }, deviceScaleFactor: m.scale });
  await p.goto(`file://${process.cwd()}/work/compose/${m.name}.html`);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForLoadState('networkidle');
  await p.screenshot({ path: `../images/${m.name}.png` });
  await p.close();
  console.log('✓', m.name);
}
await b.close();
