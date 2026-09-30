"""Zoom-follow edit: crop every frame to an eased camera, add captions, write a new frame list."""
import json, os, sys, shutil
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../../suite/public/fonts")
name, out_w, out_h = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
src = f"work/frames/{name}"; dst = f"work/frames/{name}-edit"
shutil.rmtree(dst, ignore_errors=True); os.makedirs(dst)
meta = json.load(open(f"{src}/meta.json"))
vw, vh = meta["viewport"]["width"], meta["viewport"]["height"]
aspect = out_w / out_h
first = Image.open(f"{src}/{meta['frames'][0]['file']}"); scale = first.width / vw

def fit(r):
    """Grow a rect to the output's aspect, never smaller than a sane zoom, kept inside the viewport."""
    x, y, w, h = r["x"], r["y"], r["width"], r["height"]
    cx, cy = x + w / 2, y + h / 2
    w = max(w, h * aspect, 560); h = w / aspect
    if w > vw: w = vw; h = w / aspect
    if h > vh: h = vh; w = h * aspect
    x = min(max(cx - w / 2, 0), vw - w); y = min(max(cy - h / 2, 0), vh - h)
    return (x, y, w, h)

ease = lambda t: t * t * (3 - 2 * t)
times, t = [], 0.0
for f in meta["frames"]: times.append(t); t += f["seconds"]
full = (0, 0, vw, vh)
cams = [{"frame": 0, "rect": full, "transition": 0}] + [{**c, "rect": fit(c["rect"])} for c in meta["cameras"]]

def rect_at(i):
    k = max((c for c in cams if c["frame"] <= i), key=lambda c: c["frame"])
    idx = cams.index(k); prev = cams[idx - 1]["rect"] if idx > 0 else k["rect"]
    # Where the previous transition had got to when this one began.
    if idx > 1:
        p = cams[idx - 1]; pp = cams[idx - 2]["rect"]
        pt = min(1, (times[k["frame"]] - times[p["frame"]]) / p["transition"]) if p["transition"] else 1
        prev = tuple(a + (b - a) * ease(pt) for a, b in zip(pp, p["rect"]))
    u = min(1, (times[i] - times[k["frame"]]) / k["transition"]) if k["transition"] else 1
    return tuple(a + (b - a) * ease(u) for a, b in zip(prev, k["rect"]))

def caption_at(i):
    live = [c for c in meta["captions"] if c["frame"] <= i]
    if not live or live[-1]["text"] is None: return None, 0
    c = live[-1]; return c["text"], times[i] - times[c["frame"]]

font = ImageFont.truetype(f"{FONTS}/Lato-Regular.ttf", int(out_h * 0.034))
lines = []
for i, f in enumerate(meta["frames"]):
    x, y, w, h = rect_at(i)
    im = Image.open(f"{src}/{f['file']}").convert("RGB")
    im = im.crop((round(x * scale), round(y * scale), round((x + w) * scale), round((y + h) * scale))).resize((out_w, out_h), Image.LANCZOS)
    text, age = caption_at(i)
    if text:
        alpha = min(1, (age + f['seconds']) / 0.25)
        layer = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
        tw = d.textlength(text, font=font); ph = int(out_h * 0.075); pw = int(tw + ph * 1.1)
        px, py = (out_w - pw) // 2, out_h - ph - int(out_h * 0.045)
        shadow = Image.new("RGBA", im.size, (0, 0, 0, 0)); ImageDraw.Draw(shadow).rounded_rectangle((px, py + 6, px + pw, py + ph + 6), ph // 2, fill=(0, 0, 0, int(70 * alpha)))
        layer = Image.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(10)), layer); d = ImageDraw.Draw(layer)
        d.rounded_rectangle((px, py, px + pw, py + ph), ph // 2, fill=(31, 27, 46, int(235 * alpha)))
        d.text((out_w / 2, py + ph / 2), text, font=font, fill=(251, 248, 243, int(255 * alpha)), anchor="mm")
        im = Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")
    out = f"{i:05d}.png"; im.save(f"{dst}/{out}")
    lines += [f"file '{out}'", f"duration {f['seconds']:.4f}"]
lines.append(f"file '{out}'")
open(f"{dst}/frames.txt", "w").write("\n".join(lines))
print(f"{dst}: {len(meta['frames'])} frames at {out_w}x{out_h}")
