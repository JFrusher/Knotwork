import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

/** A pointer drawn into the page, because headless Chromium draws none. */
export const CURSOR_SCRIPT = `
  addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    c.id = '__cursor';
    c.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28"><path d="M5 3 L5 22 L10 17.5 L13.5 25 L17 23.5 L13.6 16 L20 16 Z" fill="#1f1b2e" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '-100px', top: '-100px', zIndex: 2147483647, pointerEvents: 'none', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.25))', transform: 'translate(-5px,-3px)' });
    document.documentElement.appendChild(c);
    const ring = document.createElement('div');
    Object.assign(ring.style, { position: 'fixed', width: '36px', height: '36px', marginLeft: '-18px', marginTop: '-18px', borderRadius: '50%', border: '3px solid rgba(47,111,94,.85)', background: 'rgba(47,111,94,.15)', zIndex: 2147483646, pointerEvents: 'none', opacity: 0, transform: 'scale(.4)', transition: 'transform .35s ease-out, opacity .45s ease-out' });
    document.documentElement.appendChild(ring);
    addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', (e) => {
      ring.style.transition = 'none'; ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px';
      ring.style.opacity = 1; ring.style.transform = 'scale(.4)';
      requestAnimationFrame(() => { ring.style.transition = 'transform .35s ease-out, opacity .45s ease-out'; ring.style.transform = 'scale(1.3)'; ring.style.opacity = 0; });
    }, true);
  });`;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Recorder {
  constructor(page, dir) {
    this.page = page; this.dir = dir; this.frames = []; this.x = 720; this.y = 450;
    this.cameras = []; this.captions = [];
    rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  }
  async frame(seconds = 1 / 30) {
    const file = `${this.dir}/${String(this.frames.length).padStart(5, '0')}.jpg`;
    await this.page.screenshot({ path: file, type: 'jpeg', quality: 92 });
    this.frames.push({ file, seconds });
  }
  /** Hold still: one frame shown for this long. */
  async hold(seconds) { await this.frame(seconds); }
  /** Let something animate, sampling it at 12fps of wall time. */
  async live(seconds) { const n = Math.round(seconds * 12); for (let i = 0; i < n; i++) { await this.page.waitForTimeout(1000 / 12); await this.frame(1 / 12); } }
  async moveTo(x, y, seconds = 0.7, { drag = false } = {}) {
    const steps = Math.max(8, Math.round(seconds * 30)); const x0 = this.x, y0 = this.y;
    for (let i = 1; i <= steps; i++) {
      const t = ease(i / steps);
      await this.page.mouse.move(x0 + (x - x0) * t, y0 + (y - y0) * t);
      if (drag) await this.page.waitForTimeout(10);
      await this.frame(1 / 30);
    }
    this.x = x; this.y = y;
  }
  async moveToLocator(locator, seconds, opts) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    await this.moveTo(box.x + box.width / 2, box.y + box.height / 2, seconds, opts);
  }
  async click(locator, seconds = 0.7) {
    if (locator) await this.moveToLocator(locator, seconds);
    await this.page.mouse.down(); await this.frame(1 / 30); await this.page.mouse.up();
    await this.live(0.35);
  }
  async type(text, perChar = 0.09) { for (const ch of text) { await this.page.keyboard.type(ch); await this.frame(perChar); } }
  async press(key) { await this.page.keyboard.press(key); await this.live(0.4); }
  /**
   * Point the camera at these things (locators or {x,y,width,height} in CSS
   * pixels), easing there over `transition` seconds from the next frame on.
   * No targets means the whole viewport.
   */
  async camera(targets = [], { pad = 48, transition = 0.7 } = {}) {
    let rect;
    if (targets.length === 0) rect = { x: 0, y: 0, width: this.page.viewportSize().width, height: this.page.viewportSize().height };
    else {
      const boxes = await Promise.all(targets.map((t) => (t.boundingBox ? t.boundingBox() : t)));
      const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y));
      const x1 = Math.max(...boxes.map((b) => b.x + b.width)), y1 = Math.max(...boxes.map((b) => b.y + b.height));
      rect = { x: x0 - pad, y: y0 - pad, width: x1 - x0 + 2 * pad, height: y1 - y0 + 2 * pad };
    }
    this.cameras.push({ frame: this.frames.length, rect, transition });
  }
  /** A caption from the next frame on; null clears it. */
  caption(text) { this.captions.push({ frame: this.frames.length, text }); }
  /** The frame list ffmpeg's concat demuxer reads, each frame with its duration. */
  save() {
    const lines = this.frames.flatMap((f) => [`file '${f.file.split('/').at(-1)}'`, `duration ${f.seconds.toFixed(4)}`]);
    lines.push(`file '${this.frames.at(-1).file.split('/').at(-1)}'`);
    writeFileSync(`${this.dir}/frames.txt`, lines.join('\n'));
    const vp = this.page.viewportSize();
    writeFileSync(`${this.dir}/meta.json`, JSON.stringify({ viewport: vp, frames: this.frames.map((f) => ({ file: f.file.split('/').at(-1), seconds: f.seconds })), cameras: this.cameras, captions: this.captions }));
    const total = this.frames.reduce((a, f) => a + f.seconds, 0);
    console.log(`${this.dir}: ${this.frames.length} frames, ${total.toFixed(1)}s`);
  }
}

/** A fingertip for phone recordings: a soft dot that shows on each tap. */
export const TOUCH_SCRIPT = `
  addEventListener('DOMContentLoaded', () => {
    const dot = document.createElement('div');
    Object.assign(dot.style, { position: 'fixed', width: '44px', height: '44px', marginLeft: '-22px', marginTop: '-22px', borderRadius: '50%', background: 'rgba(31,27,46,.28)', border: '2px solid rgba(255,255,255,.9)', boxShadow: '0 2px 8px rgba(0,0,0,.25)', zIndex: 2147483647, pointerEvents: 'none', opacity: 0, transform: 'scale(.6)', transition: 'opacity .25s, transform .25s' });
    document.documentElement.appendChild(dot);
    addEventListener('mousemove', (e) => { dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => { dot.style.opacity = 1; dot.style.transform = 'scale(1)'; }, true);
    addEventListener('mouseup', () => { setTimeout(() => { dot.style.opacity = 0; dot.style.transform = 'scale(.6)'; }, 180); }, true);
  });`;
