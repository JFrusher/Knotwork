"""Put phone frames into a bezel on a brand card, caption above; 4:5 (1080x1350)."""
import json, os, sys, shutil
from PIL import Image, ImageDraw, ImageFont, ImageFilter
FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../../suite/public/fonts")
name = sys.argv[1]; W, H = 1080, 1350
src = f"work/frames/{name}"; dst = f"work/frames/{name}-phone"
shutil.rmtree(dst, ignore_errors=True); os.makedirs(dst)
meta = json.load(open(f"{src}/meta.json"))
BG, INK, PAPER, GOLD = (243, 227, 220), (31, 27, 46), (251, 248, 243), (176, 138, 62)
title = ImageFont.truetype(f"{FONTS}/Marcellus-Regular.ttf", 58)
small = ImageFont.truetype(f"{FONTS}/Lato-Regular.ttf", 30)
status = ImageFont.truetype(f"{FONTS}/Lato-Regular.ttf", 24)
# Screen 390x844 CSS at 2.2 = 858x1857: too tall. Fit the screen to 1030 px high.
# The screen: a status bar, then the page at its own aspect under it.
sb = 54; ch = 1010; sw = round(ch * 390 / 844); sh = ch + sb; bez = 18
px = (W - sw) // 2; py = H - sh - 110
base = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(base)
# Soft shadow, then the body of the phone.
sh_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(sh_layer).rounded_rectangle((px - bez, py - bez + 24, px + sw + bez, py + sh + bez + 24), 70, fill=(31, 27, 46, 90))
base = Image.alpha_composite(base.convert("RGBA"), sh_layer.filter(ImageFilter.GaussianBlur(28))).convert("RGB"); d = ImageDraw.Draw(base)
d.rounded_rectangle((px - bez, py - bez, px + sw + bez, py + sh + bez), 64, fill=INK)
d.text((W / 2, H - 46), "Knotwork · the Binder, on the day", font=small, fill=(31, 27, 46), anchor="mm")
mask = Image.new("L", (sw, sh), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw, sh), 48, fill=255)
times, t = [], 0.0
for f in meta["frames"]: times.append(t); t += f["seconds"]
def caption_at(i):
    live = [c for c in meta["captions"] if c["frame"] <= i]
    return live[-1]["text"] if live and live[-1]["text"] else None
lines = []
for i, f in enumerate(meta["frames"]):
    im = base.copy(); d = ImageDraw.Draw(im)
    screen = Image.new("RGB", (sw, sh), PAPER); sd = ImageDraw.Draw(screen)
    sd.text((40, sb / 2 + 2), "13:45", font=status, fill=INK, anchor="lm")
    sd.rounded_rectangle((sw / 2 - 56, 12, sw / 2 + 56, 42), 15, fill=INK)
    for k in range(4): sd.rectangle((sw - 78 + k * 9, 36 - k * 5, sw - 72 + k * 9, 38), fill=INK)
    screen.paste(Image.open(f"{src}/{f['file']}").convert("RGB").resize((sw, ch), Image.LANCZOS), (0, sb))
    im.paste(screen, (px, py), mask)
    text = caption_at(i)
    if text: d.text((W / 2, (py - bez) / 2), text, font=title, fill=INK, anchor="mm")
    out = f"{i:05d}.png"; im.save(f"{dst}/{out}")
    lines += [f"file '{out}'", f"duration {f['seconds']:.4f}"]
lines.append(f"file '{out}'")
open(f"{dst}/frames.txt", "w").write("\n".join(lines))
print(f"{dst}: {len(meta['frames'])} frames")
