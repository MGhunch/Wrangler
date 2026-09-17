"""
WRANGLER
========
wrangler.hunch.co.nz — feedback from everyone, on one piece of work.

  app.py     Flask. The plate's server side: an upload becomes pages,
             a tap becomes a pin, pins are kept.
  data/      One folder per review, on the volume:
               review.json   title, pages, when
               pins.json     every note anyone has left
               text.json     the words off each page, for the robot later
               pages/N.png   the work, rendered once at upload

SITTING 1 (Sep 2026): the plate and the pins. No door yet (one word gates
starting a review), no robot, no page back. Those are sittings 2 to 4.

The rule that shapes everything here: nobody edits the work. The pages are
pictures. The only thing that ever changes is pins.json.
"""

import json
import os
import re
import secrets
import threading
import time

import pymupdf as fitz
from flask import Flask, abort, jsonify, request, send_from_directory

app = Flask(__name__, static_folder="static", static_url_path="")

HERE = os.path.dirname(os.path.abspath(__file__))
# Railway: set WRANGLER_DATA=/data and mount a volume there. Locally it's ./data.
DATA = os.environ.get("WRANGLER_DATA") or os.path.join(HERE, "data")
# Sitting 1's only gate: the word Hunch types to start a review. The proper
# door (and the client's earned sign-in) is sitting 2.
WORD = os.environ.get("WRANGLER_WORD", "pink unicorn")

MAX_MB = 40
ZOOM = 2.0        # 144dpi — sharp on a phone, still quick
MAX_W = 1800      # px; a poster doesn't need to be a wall
KINDS = {".pdf": "pdf", ".jpg": "jpg", ".jpeg": "jpg", ".png": "png"}

LOCK = threading.Lock()   # pins.json is read-modify-write; one process, one lock


# ---------------------------------------------------------------------------
# small helpers
# ---------------------------------------------------------------------------

def rdir(rid):
    """The review's folder, or 404. The id shape is the whole check."""
    if not re.fullmatch(r"[a-f0-9]{10}", rid or ""):
        abort(404)
    d = os.path.join(DATA, rid)
    if not os.path.isdir(d):
        abort(404)
    return d


def jload(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def jsave(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def render(files, out):
    """Every upload becomes a stack of PNG pages. A PDF is its pages; an
    image is one page. Text comes off for free where there is any, and is
    kept for the robot — it never reaches the screen."""
    os.makedirs(os.path.join(out, "pages"), exist_ok=True)
    pages, text, n = [], {}, 0
    for name, kind, data in files:
        doc = fitz.open(stream=data, filetype=kind)
        for page in doc:
            n += 1
            r = page.rect
            z = min(ZOOM, MAX_W / max(r.width, 1.0))
            pix = page.get_pixmap(matrix=fitz.Matrix(z, z), alpha=False)
            pix.save(os.path.join(out, "pages", f"{n}.png"))
            pages.append({"n": n, "w": pix.width, "h": pix.height})
            t = page.get_text().strip()
            if t:
                text[str(n)] = t
        doc.close()
    return pages, text


# ---------------------------------------------------------------------------
# STARTING A REVIEW — Hunch's side
# ---------------------------------------------------------------------------

@app.route("/api/upload", methods=["POST"])
def upload():
    if (request.form.get("word") or "").strip().lower() != WORD.lower():
        return jsonify(error="word"), 403
    title = (request.form.get("title") or "").strip()[:120] or "Untitled"
    got = request.files.getlist("files")
    if not got:
        return jsonify(error="nofile"), 400
    files, total = [], 0
    for f in got:
        ext = os.path.splitext(f.filename or "")[1].lower()
        if ext not in KINDS:
            return jsonify(error="kind"), 400
        data = f.read()
        total += len(data)
        if total > MAX_MB * 1024 * 1024:
            return jsonify(error="big"), 413
        files.append((f.filename, KINDS[ext], data))

    rid = secrets.token_hex(5)
    out = os.path.join(DATA, rid)
    os.makedirs(out, exist_ok=True)
    try:
        pages, text = render(files, out)
    except Exception:
        return jsonify(error="render"), 400
    if not pages:
        return jsonify(error="render"), 400

    review = {
        "id": rid,
        "title": title,
        "at": int(time.time()),
        "pages": pages,
        "files": [n for n, _, _ in files],
    }
    jsave(os.path.join(out, "review.json"), review)
    jsave(os.path.join(out, "text.json"), text)
    jsave(os.path.join(out, "pins.json"), [])
    return jsonify(id=rid, url=f"/r/{rid}", pages=len(pages))


# ---------------------------------------------------------------------------
# THE PLATE — what a reviewer sees
# ---------------------------------------------------------------------------

@app.route("/r/<rid>")
def review_page(rid):
    rdir(rid)
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/review/<rid>")
def review_get(rid):
    d = rdir(rid)
    return jsonify(
        review=jload(os.path.join(d, "review.json"), {}),
        pins=jload(os.path.join(d, "pins.json"), []),
    )


@app.route("/api/review/<rid>/page/<int:n>.png")
def review_page_png(rid, n):
    d = rdir(rid)
    return send_from_directory(os.path.join(d, "pages"), f"{n}.png", max_age=86400)


# ---------------------------------------------------------------------------
# PINS — the only thing that changes
# ---------------------------------------------------------------------------

def clean_pin(b):
    """What the browser sent, trimmed to what we keep. Returns None if it
    isn't a pin."""
    try:
        page = int(b.get("page"))
        x = float(b.get("x"))
        y = float(b.get("y"))
    except (TypeError, ValueError):
        return None
    if not (0 <= x <= 1 and 0 <= y <= 1):
        return None
    text = str(b.get("text") or "").strip()[:2000]
    who = b.get("who") or {}
    wid = str(who.get("id") or "")[:32]
    name = str(who.get("name") or "").strip()[:40]
    if not text or not wid or not name:
        return None
    return {"page": page, "x": round(x, 4), "y": round(y, 4), "text": text,
            "who": wid, "name": name}


@app.route("/api/review/<rid>/pin", methods=["POST"])
def pin_save(rid):
    d = rdir(rid)
    b = request.get_json(silent=True) or {}
    p = clean_pin(b)
    if not p:
        return jsonify(error="pin"), 400
    review = jload(os.path.join(d, "review.json"), {})
    if not 1 <= p["page"] <= len(review.get("pages", [])):
        return jsonify(error="pin"), 400
    path = os.path.join(d, "pins.json")
    pid = str(b.get("id") or "")
    with LOCK:
        pins = jload(path, [])
        if pid:
            # an edit — only of your own
            for q in pins:
                if q["id"] == pid and q["who"] == p["who"]:
                    q["text"] = p["text"]
                    q["edited"] = int(time.time())
                    jsave(path, pins)
                    return jsonify(pin=q)
            return jsonify(error="pin"), 404
        p["id"] = secrets.token_hex(4)
        p["at"] = int(time.time())
        pins.append(p)
        jsave(path, pins)
    return jsonify(pin=p)


@app.route("/api/review/<rid>/pin/<pid>", methods=["DELETE"])
def pin_bin(rid, pid):
    d = rdir(rid)
    who = (request.get_json(silent=True) or {}).get("who") or ""
    path = os.path.join(d, "pins.json")
    with LOCK:
        pins = jload(path, [])
        keep = [q for q in pins if not (q["id"] == pid and q["who"] == who)]
        if len(keep) == len(pins):
            return jsonify(error="pin"), 404
        jsave(path, keep)
    return jsonify(ok=True)


# ---------------------------------------------------------------------------

@app.route("/api/health")
def health():
    return jsonify(ok=True, data=os.path.isdir(DATA))


@app.route("/")
def home():
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    os.makedirs(DATA, exist_ok=True)
    app.run(debug=True, port=int(os.environ.get("PORT", 5055)))
