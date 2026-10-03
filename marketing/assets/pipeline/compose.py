"""Every framed marketing image as an HTML page, plus a manifest of sizes to render."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "../screenshots"); FONTS = os.path.join(HERE, "../../../suite/public/fonts"); OUT = os.path.join(HERE, "work/compose")

TOKENS = {  # lib/design/tokens.css
    "ground": "#fdfbf7", "stone": "#f4f1ea", "canvas": "#e9e4da", "border": "#d8d2c6", "muted": "#6b6561", "ink": "#1c1917",
    "sage": "#2f6d5f", "brass": "#80632f", "brass-bright": "#ac8a55", "moss": "#566f59", "taupe": "#736755", "slate": "#46617a", "blush": "#f3e3dc",
}
BASE_CSS = f"""
@font-face {{ font-family: Marcellus; src: url(file://{FONTS}/Marcellus-Regular.ttf); }}
@font-face {{ font-family: Lato; src: url(file://{FONTS}/Lato-Regular.ttf); }}
@font-face {{ font-family: Crimson; src: url(file://{FONTS}/CrimsonText-Regular.ttf); }}
* {{ box-sizing: border-box; margin: 0; }}
html, body {{ width: 100%; height: 100%; }}
body {{ font-family: Lato, sans-serif; color: {TOKENS['ink']}; background: {TOKENS['ground']}; overflow: hidden; -webkit-font-smoothing: antialiased; }}
.bg {{ position: absolute; inset: 0; background:
   radial-gradient(1200px 700px at 85% -10%, var(--tint, #f1e8d7) 0%, transparent 60%),
   radial-gradient(900px 600px at -10% 110%, #e6ede6 0%, transparent 55%),
   linear-gradient(180deg, {TOKENS['ground']} 0%, {TOKENS['stone']} 100%); }}
.grain {{ position: absolute; inset: 0; opacity: .035; background-image: radial-gradient({TOKENS['ink']} 1px, transparent 1px); background-size: 3px 3px; }}
h1 {{ font-family: Marcellus, serif; font-weight: 400; letter-spacing: -0.01em; line-height: 1.05; }}
.eyebrow {{ font-size: 15px; letter-spacing: .22em; text-transform: uppercase; color: var(--accent, {TOKENS['brass']}); font-weight: 400; }}
.sub {{ color: {TOKENS['muted']}; line-height: 1.45; }}
.window {{ position: absolute; border-radius: 14px; overflow: hidden; background: #fff;
   box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 40px 80px -20px rgba(28,25,23,.35), 0 18px 36px -18px rgba(28,25,23,.3), 0 0 0 1px rgba(28,25,23,.08); }}
.chrome {{ height: 40px; background: linear-gradient(#f7f4ee, #efebe3); border-bottom: 1px solid {TOKENS['border']}; display: flex; align-items: center; padding: 0 16px; gap: 8px; }}
.dot {{ width: 12px; height: 12px; border-radius: 50%; }}
.url {{ margin: 0 auto; transform: translateX(-26px); background: #fff; border: 1px solid {TOKENS['border']}; border-radius: 8px; padding: 5px 16px; font-size: 13px; color: {TOKENS['muted']}; min-width: 340px; text-align: center; }}
.shot {{ display: block; width: 100%; }}
.crop {{ background-repeat: no-repeat; }}
.pill {{ display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; padding: 8px 16px; font-size: 16px; background: #fff; border: 1px solid {TOKENS['border']}; }}
.brand {{ font-family: Marcellus, serif; font-size: 26px; display: flex; align-items: center; gap: 10px; }}
"""

def page(name, w, h, body, tint="#f1e8d7", accent=TOKENS["brass"], scale=1):
    html = f"<!doctype html><meta charset=utf-8><style>{BASE_CSS}</style><body style='--tint:{tint};--accent:{accent}'><div class=bg></div><div class=grain></div>{body}</body>"
    open(f"{OUT}/{name}.html", "w").write(html)
    manifest.append({"name": name, "width": w, "height": h, "scale": scale})

def window(src, x, y, w, path, crop=None):
    """A browser window showing a raw capture (1440x900 CSS), optionally cropped to a CSS rect."""
    if crop:
        cx, cy, cw, ch = crop; k = w / cw; ih = ch * k
        inner = f"<div class=crop style='width:{w}px;height:{ih:.0f}px;background-image:url(file://{RAW}/{src}.png);background-size:{1440*k:.1f}px {900*k:.1f}px;background-position:{-cx*k:.1f}px {-cy*k:.1f}px'></div>"
    else:
        inner = f"<img class=shot src='file://{RAW}/{src}.png'>"
    return (f"<div class=window style='left:{x}px;top:{y}px;width:{w}px'><div class=chrome>"
            f"<span class=dot style='background:#e9695e'></span><span class=dot style='background:#e8b650'></span><span class=dot style='background:#6cbf5f'></span>"
            f"<span class=url>knotwork-suite.vercel.app{path}</span></div>{inner}</div>")

manifest = []
os.makedirs(OUT, exist_ok=True)

# ---------- Heroes: 1600x1000, headline over a browser window ----------
HEROES = [
    ("overview", "/", "One wedding, one place", "The whole wedding, in one place.", "Eleven planning tools that share one guest list, one room and one day. Free, private, open source.", TOKENS["brass"], "#f1e8d7"),
    ("guests", "/guests", "Guests", "One guest list. Every tool reads it.", "Import from Joy, Zola, The Knot or any spreadsheet — with a preview before anything is saved.", TOKENS["taupe"], "#eeeae3"),
    ("seating", "/seating", "Seating", "Draw the room. Then put people in it.", "To scale, in real units. Keep-together and keep-apart rules, and a dietary count as you go.", TOKENS["taupe"], "#eeeae3"),
    ("place-cards", "/place-cards", "Place cards", "Place cards, straight from the room.", "Your design, every table number filled in, 100 cards on 13 print-ready sheets.", TOKENS["sage"], "#e4efec"),
    ("timeline-ceremony-selected", "/timeline", "Timeline", "Pin the ceremony. The day follows.", "Collisions, curfew, travel time between places — and golden hour for the photos.", TOKENS["brass"], "#f1e8d7"),
    ("delegation", "/delegation", "Delegation", "Every job has a name next to it.", "Hung off the day itself, so a job moves when its part of the day does. A sheet for each person.", TOKENS["moss"], "#e6ede6"),
    ("group-shots", "/group-shots", "Group shots", "The family photo list, built from who's who.", "26 shots for the photographer, and a copy on your phone to tick off on the day.", TOKENS["slate"], "#e7ecf0"),
    ("ceremony", "/ceremony", "Ceremony", "The order of service, to the minute.", "Who walks when, and to what. Readings, music, and what the law asks for.", TOKENS["slate"], "#e7ecf0"),
    ("boxes", "/boxes", "Boxes", "What's in which box, and where it has to be.", "Labels, a packing list, and a person to take each one.", TOKENS["moss"], "#e6ede6"),
    ("bar", "/bar", "Bar", "How much drink to buy.", "In bottles and cases, worked out from your guest list and your day.", TOKENS["moss"], "#e6ede6"),
    ("money", "/money", "Money", "Every supplier, every payment, one budget.", "What's booked, what's paid, and what falls due next.", TOKENS["moss"], "#e6ede6"),
    ("checklist", "/checklist", "Checklist", "What to do before the day, each with a date.", "What's late, what's due in the next 30 days, and what can wait.", TOKENS["moss"], "#e6ede6"),
]
for src, path, eyebrow, head, sub, accent, tint in HEROES:
    body = (f"<div style='position:absolute;left:0;right:0;top:64px;text-align:center'>"
            f"<div class=eyebrow>{eyebrow}</div>"
            f"<h1 style='font-size:60px;margin-top:14px'>{head}</h1>"
            f"<p class=sub style='font-size:22px;margin:16px auto 0;max-width:900px'>{sub}</p></div>"
            + window(src, 150, 300, 1300, path))
    page(f"hero-{src.replace('-ceremony-selected','')}", 1600, 1000, body, tint, accent)

# ---------- Social preview (GitHub, 1280x640) and link card (1200x630) ----------
def social(name, w, h):
    body = (f"<div style='position:absolute;left:72px;top:0;bottom:0;width:470px;display:flex;flex-direction:column;justify-content:center'>"
            f"<div class=brand>💍 Knotwork</div>"
            f"<h1 style='font-size:50px;margin-top:22px'>Plan the whole wedding in one place.</h1>"
            f"<p class=sub style='font-size:21px;margin-top:18px'>Seating, place cards, the day, the jobs and the money — sharing one wedding.</p>"
            f"<div style='margin-top:26px;display:flex;gap:10px;flex-wrap:wrap'><span class=pill>Free forever</span><span class=pill>Open source</span><span class=pill>No sign-up</span></div></div>"
            + window("seating", 590, 90, 900, "/seating"))
    page(name, w, h, body)
social("social-preview", 1280, 640)
social("og-card", 1200, 630)

# ---------- Square carousel cards, 1080x1080: a tight crop of the part that matters ----------
SQUARES = [
    ("seating", "/seating", "Seating", "Draw the room.<br>Then put people in it.", (330, 60, 880, 603), TOKENS["taupe"], "#eeeae3"),
    ("place-cards", "/place-cards", "Place cards", "Straight from the room,<br>table numbers and all.", (330, 60, 870, 596), TOKENS["sage"], "#e4efec"),
    ("timeline", "/timeline", "Timeline", "Pin the ceremony.<br>The day follows.", (320, 56, 880, 603), TOKENS["brass"], "#f1e8d7"),
    ("money", "/money", "Money", "Booked, paid,<br>and what falls due.", (208, 70, 1024, 701), TOKENS["moss"], "#e6ede6"),
    ("ceremony", "/ceremony", "Ceremony", "The order of service,<br>to the minute.", (0, 60, 1000, 685), TOKENS["slate"], "#e7ecf0"),
    ("overview", "/", "Overview", "Where things stand,<br>and what's next.", (208, 70, 1024, 701), TOKENS["brass"], "#f1e8d7"),
]
for src, path, eyebrow, head, crop, accent, tint in SQUARES:
    body = (f"<div style='position:absolute;left:80px;top:78px'><div class=eyebrow>{eyebrow}</div>"
            f"<h1 style='font-size:58px;margin-top:14px'>{head}</h1></div>"
            + window(src, 80, 330, 920, path, crop)
            + f"<div style='position:absolute;right:80px;top:84px' class=brand>💍 Knotwork</div>")
    page(f"square-{src}", 1080, 1080, body, tint, accent)

# ---------- The Binder, three phones ----------
def phone(src, x, y, w):
    h = w * 844 / 390
    return (f"<div style='position:absolute;left:{x}px;top:{y}px;width:{w+28}px;height:{h+80}px;border-radius:52px;background:{TOKENS['ink']};padding:14px;box-shadow:0 40px 70px -25px rgba(28,25,23,.45)'>"
            f"<div style='border-radius:40px;overflow:hidden;background:{TOKENS['ground']};height:100%'>"
            f"<div style='height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 30px;font-size:17px'><span>13:45</span><span style='width:96px;height:28px;border-radius:14px;background:{TOKENS['ink']}'></span><span>•••</span></div>"
            f"<img src='file://{RAW}/{src}.png' style='display:block;width:100%'></div></div>")
body = (f"<div style='position:absolute;left:0;right:0;top:60px;text-align:center'><div class=eyebrow>The Binder</div>"
        f"<h1 style='font-size:58px;margin-top:14px'>The day, in your pocket.</h1>"
        f"<p class=sub style='font-size:22px;margin-top:14px'>What's on now, who to ring, and where everyone sits — with or without signal.</p></div>"
        + phone("binder-ring", 270, 300, 300) + phone("binder-now", 650, 262, 300) + phone("binder-find", 1030, 300, 300))
page("binder-trio", 1600, 1000, body, "#f3e3dc", TOKENS["brass"])

# ---------- Every tool, one grid ----------
TILES = [("overview", "Overview"), ("guests", "Guests"), ("seating", "Seating"), ("place-cards", "Place cards"),
         ("timeline", "Timeline"), ("delegation", "Delegation"), ("group-shots", "Group shots"), ("ceremony", "Ceremony"),
         ("boxes", "Boxes"), ("bar", "Bar"), ("money", "Money"), ("checklist", "Checklist")]
tiles = "".join(
    f"<div style='background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 10px 24px -14px rgba(28,25,23,.35),0 0 0 1px rgba(28,25,23,.07)'>"
    f"<img src='file://{RAW}/{s}.png' style='display:block;width:100%'><div style='padding:10px 14px;font-size:17px;border-top:1px solid {TOKENS['canvas']}'>{n}</div></div>"
    for s, n in TILES)
body = (f"<div style='position:absolute;left:0;right:0;top:54px;text-align:center'><div class=eyebrow>Knotwork</div>"
        f"<h1 style='font-size:54px;margin-top:12px'>Every tool. One wedding.</h1>"
        f"<p class=sub style='font-size:21px;margin-top:10px'>Add the ones you need. They all read the same guest list, the same room and the same day — and the Binder takes it to your phone.</p></div>"
        f"<div style='position:absolute;left:170px;right:170px;top:212px;display:grid;grid-template-columns:repeat(4,1fr);gap:22px'>{tiles}</div>")
page("tools-grid", 1600, 1000, body)

# ---------- Vertical story / Shorts cover, 1080x1920 ----------
body = (f"<div style='position:absolute;left:80px;right:80px;top:150px;text-align:center'><div class=brand style='justify-content:center;font-size:34px'>💍 Knotwork</div>"
        f"<h1 style='font-size:104px;margin-top:40px'>Your wedding,<br>in one place.</h1>"
        f"<p class=sub style='font-size:38px;margin-top:30px'>Free. Private. Open source.<br>No sign-up to start.</p></div>"
        + phone("binder-now", 276, 560, 500)
        + f"<div style='position:absolute;left:0;right:0;bottom:70px;text-align:center;font-size:34px'>knotwork-suite.vercel.app</div>")
page("story", 1080, 1920, body, "#f3e3dc")

# ---------- The pledge, 1080x1080 ----------
items = [("Free, forever.", "No paid tier, no premium, no trial."), ("Your guests aren't the product.", "No adverts. No vendor leads. No data sales."),
         ("Nobody browses your wedding.", "No admin panel, no support login."), ("It works with no account.", "Your guest list can stay on your laptop."),
         ("You can always leave.", "The whole wedding, as one open file.")]
li = "".join(f"<li style='display:flex;gap:26px;margin-top:34px'><span style='font-family:Marcellus;font-size:40px;color:{TOKENS['brass']};width:46px'>{'i ii iii iv v'.split()[k]}.</span>"
             f"<div><div style='font-size:34px;font-family:Marcellus'>{a}</div><div class=sub style='font-size:24px;margin-top:6px'>{b}</div></div></li>" for k, (a, b) in enumerate(items))
body = (f"<div style='position:absolute;left:100px;right:100px;top:96px'><div class=eyebrow>The Knotwork pledge</div>"
        f"<h1 style='font-size:64px;margin-top:14px'>Planning a wedding shouldn't cost you your privacy.</h1>"
        f"<ol style='list-style:none;padding:0;margin-top:20px'>{li}</ol></div>")
page("pledge", 1080, 1080, body, "#f1e8d7")

json.dump(manifest, open(f"{OUT}/manifest.json", "w"), indent=1)
print(len(manifest), "pages")
