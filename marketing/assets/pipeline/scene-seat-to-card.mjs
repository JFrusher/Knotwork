import { launch, weddingPage, BASE, PLANNING_TIME, settle } from './lib.mjs';
import { Recorder, CURSOR_SCRIPT } from './recorder.mjs';
const b = await launch();
const { page } = await weddingPage(b, { time: PLANNING_TIME, init: CURSOR_SCRIPT });
await page.goto(BASE + '/seating'); await settle(page, 1500);
const r = new Recorder(page, 'work/frames/seat-to-card');
await page.mouse.move(r.x, r.y);
r.caption('Seating: the room, drawn to scale');
await r.hold(1.4);

const search = page.getByPlaceholder(/Search guests/);
const table13 = page.getByRole('button', { name: /^Table 13, / });
const t13 = await table13.boundingBox();
await r.camera([search, { ...t13, height: t13.height + 150 }, page.getByRole('button', { name: /^Table 11, / })], { pad: 40 });
r.caption('Find a guest');
await r.click(search, 0.8);
await r.type('Zainab T');
await r.live(0.5);

r.caption('Drag her to a table');
const guest = page.getByRole('button', { name: /^Zainab Thistlewood/ });
await r.moveToLocator(guest, 0.6);
await page.mouse.down(); await r.frame(1 / 30);
const t = await table13.boundingBox();
await r.moveTo(t.x + t.width / 2, t.y + t.height / 2, 1.3, { drag: true });
await page.mouse.up();
await r.live(1.0);

await r.camera([], { transition: 0.6 });
r.caption('Open Place cards');
await r.click(page.getByRole('link', { name: 'Place cards' }), 0.9);
await settle(page, 600); await r.live(0.5);

const useRoom = page.getByRole('button', { name: /^Use the room/ });
await r.camera([useRoom, page.getByText(/^Card \d+ of \d+$/)], { pad: 30 });
r.caption('Take the guest list from the room');
await r.click(useRoom, 0.9);
await r.live(0.7);

await r.camera([], { transition: 0.5 });
r.caption(null);
await r.click(page.getByText(/^Rows — /), 0.8);
await r.live(0.3);
const row = page.getByRole('button', { name: 'Zainab Thistlewood', exact: true });
await r.click(row, 0.9);
await r.live(0.3);

const cardArea = page.getByText(/^Card \d+ of \d+$/);
const box = await cardArea.boundingBox();
await r.camera([{ x: box.x - 170, y: 115, width: box.width + 340, height: box.y - 115 + box.height }], { pad: 16, transition: 0.9 });
r.caption('Her card has her table');
await r.moveTo(box.x + box.width + 200, box.y + 20, 0.9);
await r.hold(3.0);
r.save();
await b.close();
