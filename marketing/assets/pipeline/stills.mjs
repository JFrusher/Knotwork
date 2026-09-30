import { launch, weddingPage, BASE, OUT, PLANNING_TIME, settle } from './lib.mjs';
const b = await launch();
const { page } = await weddingPage(b, { time: PLANNING_TIME });
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('✓', name); };
const go = async (r) => { await page.goto(BASE + r); await settle(page); };

await go('/'); await shot('overview');
await page.mouse.wheel(0, 500); await page.waitForTimeout(500); await shot('overview-scrolled');
await go('/guests'); await shot('guests');
await go('/seating'); await shot('seating');
await go('/place-cards'); await shot('place-cards');
await go('/timeline'); await shot('timeline');
await page.getByRole('button', { name: /^Ceremony, / }).click(); await page.waitForTimeout(600); await shot('timeline-ceremony-selected');
await go('/delegation'); await shot('delegation');
await go('/group-shots'); await page.getByText(/The couple with Alex.s parents/).first().click(); await page.waitForTimeout(600); await shot('group-shots');
await go('/ceremony'); await shot('ceremony');
await go('/boxes'); await page.getByText(/The rings and the paperwork/).first().click(); await page.waitForTimeout(600); await shot('boxes');
await go('/bar'); await shot('bar');
await go('/money'); await shot('money');
await go('/checklist'); await shot('checklist');
await go('/'); await page.getByRole('button', { name: 'Add or remove tools' }).click(); await page.waitForTimeout(700); await shot('toolbox');
await go('/seating'); await page.keyboard.press('Control+k'); await page.waitForTimeout(400);
await page.getByLabel('Find a guest, table, block, job or page').pressSequentially('zain', { delay: 60 }); await page.waitForTimeout(700); await shot('command-palette');
await b.close();

// The Binder, on a phone, at 13:45 on the day: the ceremony is "now".
const p2 = await launch();
const phone = await weddingPage(p2, { width: 390, height: 844, scale: 3, time: '2028-06-01T13:45:00+01:00' });
const ph = phone.page;
const pshot = async (name) => { await ph.screenshot({ path: `${OUT}/${name}.png` }); console.log('✓', name); };
await ph.goto(BASE + '/binder'); await settle(ph); await pshot('binder-now');
const nav = ph.getByRole('navigation', { name: 'The Binder' });
await nav.getByRole('button', { name: 'Day' }).click(); await ph.waitForTimeout(500); await pshot('binder-day');
await nav.getByRole('button', { name: 'Ring' }).click(); await ph.waitForTimeout(500); await pshot('binder-ring');
await nav.getByRole('button', { name: 'Find' }).click(); await ph.getByRole('searchbox').fill('zainab'); await ph.waitForTimeout(500); await pshot('binder-find');
await nav.getByRole('button', { name: 'Shots' }).click(); await ph.getByRole('region', { name: 'The shot list' }).getByRole('checkbox').first().check(); await ph.getByRole('region', { name: 'The shot list' }).getByRole('checkbox').nth(1).check(); await ph.waitForTimeout(500); await pshot('binder-shots');
await p2.close();
