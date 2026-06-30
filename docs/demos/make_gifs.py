"""
Generate illustrative animated GIFs for key code paths in the app.

These are stylised UI animations (drawn with Pillow) that show what each
code snippet does — not screen recordings of the live app. Run with:

    py docs/demos/make_gifs.py

Outputs four GIFs into docs/demos/.
"""

import os
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

W, H = 700, 430

# Theme (matches the app: #081b29 background, #0ef cyan accent)
BG = (8, 27, 41)
PANEL = (14, 40, 58)
PANEL_HI = (20, 52, 74)
CYAN = (0, 238, 255)
TEXT = (231, 241, 246)
MUTED = (143, 165, 180)
BORDER = (40, 70, 92)
RED = (239, 83, 80)
GREEN = (38, 198, 130)
AMBER = (245, 176, 65)
ORANGE = (249, 130, 60)
WHITE = (245, 248, 250)
DARKTEXT = (33, 37, 41)


def font(size, bold=False):
    candidates = (
        ["C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/segoeuib.ttf"]
        if bold
        else ["C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/segoeui.ttf"]
    )
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


F_TITLE = font(26, bold=True)
F_H = font(19, bold=True)
F_BODY = font(16)
F_SMALL = font(13)
F_SMALLB = font(13, bold=True)
F_TINY = font(11, bold=True)


def new_frame(bg=BG):
    img = Image.new("RGB", (W, H), bg)
    return img, ImageDraw.Draw(img)


def cursor(draw, x, y, pressed=False):
    pts = [
        (x, y), (x, y + 19), (x + 5, y + 14), (x + 9, y + 21),
        (x + 12, y + 19), (x + 8, y + 12), (x + 15, y + 12),
    ]
    draw.polygon(pts, fill=(20, 20, 20))
    inner = [(px + 1, py + 1) for px, py in pts]
    draw.polygon(inner, fill=WHITE if not pressed else CYAN)


def badge(draw, x, y, label, fill, w=None, h=24):
    tw = draw.textlength(label, font=F_TINY)
    w = w or int(tw + 22)
    draw.rounded_rectangle([x, y, x + w, y + h], radius=h // 2,
                           fill=tuple(int(c * 0.22) for c in fill),
                           outline=fill, width=1)
    draw.text((x + w / 2, y + h / 2), label, font=F_TINY, fill=fill, anchor="mm")
    return w


def lerp(a, b, t):
    return a + (b - a) * t


def save_gif(name, frames, durations):
    path = os.path.join(OUT_DIR, name)
    frames[0].save(
        path, save_all=True, append_images=frames[1:],
        duration=durations, loop=0, disposal=2, optimize=True,
    )
    print(f"  wrote {name} ({len(frames)} frames)")


def header(draw, text):
    draw.rectangle([0, 0, W, 4], fill=CYAN)
    draw.text((28, 26), text, font=F_TITLE, fill=TEXT)


# ───────────────────────────────────────────────────────────────────────
# GIF 1 — Login / authentication (handleLogin + AuthContext.login)
# ───────────────────────────────────────────────────────────────────────

def draw_login(state, cur, spin=0):
    img, d = new_frame()
    header(d, "Sign In")
    px, py, pw, ph = 110, 80, 480, 300
    d.rounded_rectangle([px, py, px + pw, py + ph], radius=16, fill=PANEL, outline=BORDER, width=1)

    d.text((px + 30, py + 26), "Email", font=F_SMALL, fill=MUTED)
    d.rounded_rectangle([px + 30, py + 48, px + pw - 30, py + 84], radius=8, fill=PANEL_HI, outline=BORDER)
    d.text((px + 44, py + 66), "edward.kelly@example.com", font=F_BODY, fill=TEXT, anchor="lm")

    d.text((px + 30, py + 100), "Password", font=F_SMALL, fill=MUTED)
    d.rounded_rectangle([px + 30, py + 122, px + pw - 30, py + 158], radius=8, fill=PANEL_HI, outline=BORDER)
    d.text((px + 44, py + 140), "\u2022" * 11, font=F_BODY, fill=TEXT, anchor="lm")

    bx0, by0, bx1, by1 = px + 30, py + 188, px + pw - 30, py + 230
    if state in ("idle", "hover"):
        fill = (0, 200, 220) if state == "hover" else CYAN
        d.rounded_rectangle([bx0, by0, bx1, by1], radius=10, fill=fill)
        d.text(((bx0 + bx1) / 2, (by0 + by1) / 2), "Log In", font=F_H, fill=(5, 20, 30), anchor="mm")
    elif state == "loading":
        d.rounded_rectangle([bx0, by0, bx1, by1], radius=10, fill=(0, 150, 168))
        cx = (bx0 + bx1) / 2 - 60
        cyc = (by0 + by1) / 2
        for i in range(8):
            import math
            ang = math.radians(i * 45 + spin * 45)
            sx, sy = cx + 9 * math.cos(ang), cyc + 9 * math.sin(ang)
            a = int(60 + 195 * (i / 7))
            d.ellipse([sx - 2.5, sy - 2.5, sx + 2.5, sy + 2.5], fill=(a, a, a))
        d.text(((bx0 + bx1) / 2 + 12, cyc), "Authenticating", font=F_BODY, fill=(10, 25, 35), anchor="mm")
    elif state == "success":
        d.rounded_rectangle([bx0, by0, bx1, by1], radius=10, fill=GREEN)
        d.text(((bx0 + bx1) / 2, (by0 + by1) / 2), "Logged in  \u2713", font=F_H, fill=(5, 30, 20), anchor="mm")
        d.text((px + 30, py + 246), "Bearer token stored \u2192 redirecting to Home",
               font=F_SMALL, fill=CYAN)
    if cur:
        cursor(d, *cur, pressed=(state == "loading"))
    return img


def build_login():
    frames, durs = [], []

    def add(img, ms):
        frames.append(img); durs.append(ms)

    add(draw_login("idle", (470, 320)), 700)
    for t in (0.34, 0.67, 1.0):
        add(draw_login("idle", (int(lerp(470, 360, t)), int(lerp(320, 290, t)))), 130)
    add(draw_login("hover", (360, 290)), 350)
    for s in range(6):
        add(draw_login("loading", (360, 290), spin=s), 110)
    add(draw_login("success", (360, 290)), 1500)
    return frames, durs


# ───────────────────────────────────────────────────────────────────────
# GIF 2 — Like toggle (handleToggleLike + PostCard)
# ───────────────────────────────────────────────────────────────────────

def heart(d, cx, cy, s, fill, outline):
    import math
    pts = []
    for i in range(60):
        t = math.pi * 2 * i / 60
        x = 16 * math.sin(t) ** 3
        y = -(13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))
        pts.append((cx + x * s / 16, cy + y * s / 16))
    d.polygon(pts, fill=fill, outline=outline)


def draw_like(liked, count, cur, pop=1.0):
    img, d = new_frame()
    header(d, "Feed")
    px, py, pw, ph = 90, 86, 520, 250
    d.rounded_rectangle([px, py, px + pw, py + ph], radius=16, fill=PANEL, outline=BORDER, width=1)
    d.ellipse([px + 24, py + 24, px + 64, py + 64], fill=(127, 29, 29))
    d.text((px + 44, py + 44), "E", font=F_H, fill=WHITE, anchor="mm")
    d.text((px + 78, py + 30), "Edward Kelly", font=F_H, fill=TEXT)
    d.text((px + 78, py + 52), "Blockchain and Digital Security", font=F_SMALL, fill=MUTED)
    d.text((px + 26, py + 90), "Decentralized ledgers offer tamper-proof records", font=F_BODY, fill=TEXT)
    d.text((px + 26, py + 114), "that can revolutionize entire industries.", font=F_BODY, fill=TEXT)

    hx, hy = px + 40, py + 196
    if liked:
        heart(d, hx, hy, 22 * pop, RED, RED)
    else:
        heart(d, hx, hy, 22, PANEL, MUTED)
    d.text((hx + 22, hy), str(count), font=F_H, fill=(RED if liked else MUTED), anchor="lm")
    d.text((px + 130, hy), "POST /api/articles/1/like", font=F_SMALL, fill=CYAN, anchor="lm")
    if cur:
        cursor(d, *cur)
    return img


def build_like():
    frames, durs = [], []

    def add(img, ms):
        frames.append(img); durs.append(ms)

    add(draw_like(False, 12, (170, 300)), 800)
    for t in (0.5, 1.0):
        add(draw_like(False, 12, (int(lerp(170, 132, t)), int(lerp(300, 286, t)))), 140)
    add(draw_like(True, 13, (132, 286), pop=1.35), 130)
    add(draw_like(True, 13, (132, 286), pop=1.15), 130)
    add(draw_like(True, 13, (132, 286)), 1200)
    add(draw_like(False, 12, (132, 286)), 1100)
    return frames, durs


# ───────────────────────────────────────────────────────────────────────
# GIF 3 — Employee changes priority (handleUpdateTask + TasksPage)
# ───────────────────────────────────────────────────────────────────────

URG = {"Low": GREEN, "Medium": AMBER, "High": ORANGE, "Critical": RED}


def task_card(d, x, y, w, title, urgency, dropdown=None, sel=None):
    h = 78
    d.rounded_rectangle([x, y, x + w, y + h], radius=12, fill=PANEL, outline=BORDER, width=1)
    d.text((x + 18, y + 16), title, font=F_H, fill=TEXT)
    # priority pill with caret
    pw = badge(d, x + 18, y + 44, f"Priority: {urgency}", URG[urgency], w=160)
    d.polygon([(x + 18 + pw - 16, y + 52), (x + 18 + pw - 8, y + 52), (x + 18 + pw - 12, y + 58)],
              fill=URG[urgency])
    badge(d, x + 190, y + 44, "Moderate", CYAN, w=92)
    if dropdown:
        dx, dy = x + 18, y + 70
        d.rounded_rectangle([dx, dy, dx + 150, dy + 4 + 26 * len(dropdown)], radius=8,
                            fill=PANEL_HI, outline=CYAN)
        for i, opt in enumerate(dropdown):
            oy = dy + 4 + 26 * i
            if opt == sel:
                d.rounded_rectangle([dx + 3, oy, dx + 147, oy + 24], radius=6, fill=(0, 80, 92))
            d.text((dx + 14, oy + 12), opt, font=F_SMALLB, fill=URG[opt], anchor="lm")


def draw_priority(layout, cur, dropdown=None, sel=None, dd_card=None):
    img, d = new_frame()
    header(d, "My Tasks  \u00b7  Today")
    for (x, y, w, title, urg) in layout:
        dd = dropdown if (dd_card is not None and title.startswith(dd_card)) else None
        task_card(d, x, y, w, title, urg, dropdown=dd, sel=sel)
    if cur:
        cursor(d, *cur)
    return img


def build_priority():
    frames, durs = [], []
    w = 560
    ax, bx = 70, 70
    a_top, b_top = 86, 184  # A above B

    def layout(a_y, a_urg, b_y, b_urg):
        return [
            (ax, a_y, w, "Upload drone footage", a_urg),
            (bx, b_y, w, "Archive site media", b_urg),
        ]

    def add(img, ms):
        frames.append(img); durs.append(ms)

    base = layout(a_top, "High", b_top, "Low")
    add(draw_priority(base, (150, 230)), 800)
    # open dropdown on card B
    add(draw_priority(base, (110, 250), dropdown=["Low", "Medium", "High", "Critical"], dd_card="Archive"), 900)
    add(draw_priority(base, (110, 320), dropdown=["Low", "Medium", "High", "Critical"], sel="Critical", dd_card="Archive"), 700)
    # B becomes critical (dropdown closed)
    add(draw_priority(layout(a_top, "High", b_top, "Critical"), (110, 250)), 500)
    # reorder: B slides up, A slides down
    for t in (0.5, 1.0):
        ay = int(lerp(a_top, b_top, t))
        by = int(lerp(b_top, a_top, t))
        add(draw_priority([
            (ax, ay, w, "Upload drone footage", "High"),
            (bx, by, w, "Archive site media", "Critical"),
        ], None), 160)
    final = [
        (bx, a_top, w, "Archive site media", "Critical"),
        (ax, b_top, w, "Upload drone footage", "High"),
    ]
    add(draw_priority(final, None), 1600)
    return frames, durs


# ───────────────────────────────────────────────────────────────────────
# GIF 4 — Admin changes status (admin/tasks.php quick_update)
# ───────────────────────────────────────────────────────────────────────

STATUS = {"Pending": (108, 117, 125), "In progress": (13, 150, 200), "Done": GREEN}


def draw_admin(status, cur, dropdown=False, sel=None, toast=False):
    img, d = new_frame((242, 244, 247))
    d.rectangle([0, 0, W, 56], fill=(33, 37, 41))
    d.text((24, 28), "Admin Panel", font=F_H, fill=WHITE, anchor="lm")
    d.text((200, 28), "Tasks", font=F_BODY, fill=CYAN, anchor="lm")

    d.text((28, 78), "All Tasks", font=F_TITLE, fill=DARKTEXT)
    tx, ty, tw = 28, 120, W - 56
    d.rectangle([tx, ty, tx + tw, ty + 34], fill=(33, 37, 41))
    for label, ox in (("ID", 14), ("Task", 60), ("Priority", 300), ("Status", 430)):
        d.text((tx + ox, ty + 17), label, font=F_SMALLB, fill=WHITE, anchor="lm")

    ry = ty + 34
    d.rectangle([tx, ry, tx + tw, ry + 64], fill=WHITE, outline=(222, 226, 230))
    d.text((tx + 14, ry + 32), "21", font=F_BODY, fill=DARKTEXT, anchor="lm")
    d.text((tx + 60, ry + 32), "Review pending media approvals", font=F_BODY, fill=DARKTEXT, anchor="lm")
    badge(d, tx + 300, ry + 20, "High", ORANGE, w=70)

    sx, sy = tx + 430, ry + 18
    sc = STATUS[status]
    d.rounded_rectangle([sx, sy, sx + 130, sy + 28], radius=6, fill=(248, 249, 250), outline=sc, width=2)
    d.text((sx + 12, sy + 14), status, font=F_SMALLB, fill=sc, anchor="lm")
    d.polygon([(sx + 112, sy + 11), (sx + 122, sy + 11), (sx + 117, sy + 18)], fill=(90, 100, 110))

    if dropdown:
        opts = ["Pending", "In progress", "Done"]
        dy = sy + 30
        d.rectangle([sx, dy, sx + 130, dy + 4 + 28 * len(opts)], fill=WHITE, outline=(180, 188, 196))
        for i, opt in enumerate(opts):
            oy = dy + 4 + 28 * i
            if opt == sel:
                d.rectangle([sx + 2, oy, sx + 128, oy + 26], fill=(225, 245, 235))
            d.text((sx + 12, oy + 13), opt, font=F_SMALLB, fill=STATUS[opt], anchor="lm")

    if toast:
        d.rounded_rectangle([tx, 372, tx + 220, 404], radius=8, fill=(212, 244, 230), outline=GREEN)
        d.text((tx + 14, 388), "Status updated.", font=F_SMALLB, fill=(20, 110, 70), anchor="lm")

    if cur:
        cursor(d, *cur)
    return img


def build_admin():
    frames, durs = [], []

    def add(img, ms):
        frames.append(img); durs.append(ms)

    add(draw_admin("Pending", (560, 210)), 800)
    add(draw_admin("Pending", (520, 175), dropdown=True), 900)
    add(draw_admin("Pending", (520, 235), dropdown=True, sel="Done"), 700)
    add(draw_admin("Done", (520, 175), toast=True), 1700)
    return frames, durs


def main():
    print("Generating GIFs into docs/demos/ ...")
    save_gif("01-login.gif", *build_login())
    save_gif("02-like-toggle.gif", *build_like())
    save_gif("03-task-priority.gif", *build_priority())
    save_gif("04-admin-status.gif", *build_admin())
    print("Done.")


if __name__ == "__main__":
    main()
