import { launch, weddingPage, BASE, PLANNING_TIME, settle } from './lib.mjs';
import { Recorder, CURSOR_SCRIPT } from './recorder.mjs';
const b = await launch();
const { page } = await weddingPage(b, { time: PLANNING_TIME, init: CURSOR_SCRIPT });
await page.goto(BASE + '/timeline'); await settle(page, 1200);
await page.locator('header').getByRole('button', { name: '−', exact: true }).click(); await settle(page, 600);
const r = new Recorder(page, 'work/frames/ceremony-moves');
await page.mouse.move(900, 300); r.x = 900; r.y = 300;
r.caption('Timeline: the whole day, in lanes');
await r.hold(1.6);

const ceremony = page.getByRole('button', { name: /^Ceremony, / });
r.caption('The ceremony is pinned at 13:30');
await r.click(ceremony, 0.9);
await r.live(0.4);

const field = page.getByLabel('Anchored at');
await field.scrollIntoViewIfNeeded();
// The day on the canvas, from the ceremony down to dinner, and the verdict under it.
const mainDay = { x: 390, y: 480, width: 350, height: 330 };
const verdict = page.getByText(/Nothing collides|overruns/).first();

async function moveCeremony(time, caption, after) {
  await r.camera([field, page.getByText('Anchored', { exact: true })], { pad: 60, transition: 0.6 });
  r.caption(caption);
  await r.moveToLocator(field, 0.7);
  await field.click({ clickCount: 3 }); await r.frame(1 / 30);
  await r.type(time, 0.12);
  await r.live(0.2);
  await r.camera([mainDay, verdict], { pad: 20, transition: 0.7 });
  r.caption(after);
  await r.live(0.9);
  await page.keyboard.press('Enter');
  await r.live(0.6);
  await r.hold(2.4);
}
await moveCeremony('14:00', 'Move it to 14:00', 'Everything after it follows');
console.log('drinks:', await page.getByRole('button', { name: /^Drinks reception, / }).getAttribute('aria-label'));
await moveCeremony('14:30', 'Later still?', 'It tells you what no longer fits');
console.log('verdict:', await page.getByText(/Nothing collides|overruns/).first().textContent());
await r.camera([], { transition: 0.8 });
await r.live(1.0);
await r.hold(1.6);
r.save();
await b.close();
