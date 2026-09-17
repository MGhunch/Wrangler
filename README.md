# WRANGLER

`wrangler.hunch.co.nz` — feedback from everyone, on one piece of work.

Wrangler is the simplest, most seamless way to give feedback on a piece of
work. It collects everyone's opinions, surfaces where they disagree,
clarifies on the way and hands back one sorted list of what to change and
what to decide. And it does the whole lot with a smile.

## The shape

Nobody edits the work. Hunch drops in a PDF (or JPG/PNG pages), gets a
link, sends it. Anyone with the link sees the pages, taps to leave a note,
and sees other people's notes on a page once they've left their own.

    data/<id>/            one folder per review, on the volume
      review.json         title, pages, when
      pins.json           every note anyone has left — the only file that changes
      text.json           the words off each page, kept for the robot
      pages/N.png         the work, rendered once at upload

## The build, in sittings

1. **The plate and the pins** — this. Upload, link, pages, tap, note, rail.
2. The door — Hunch's sign-in, the reviewer's earned sign-off (name at the end).
3. The robot — Collide and Sort, speaking second in the thread.
4. The page back — what to change, what to decide, who said what.

## Files

| File | Job |
|---|---|
| `app.py` | Flask. Upload → pages; pins saved and served |
| `static/index.html` | One page, two views: START (Hunch) and the PLATE (reviewer) |
| `static/tokens.css` | The variables. `--hue` is the placeholder colour — change it here |
| `static/wrangler.css` | The chrome (Robot Sandwich's bones) and the plate |
| `static/js/strings.js` | Every word on screen. Change the words here |
| `static/js/chrome.js` | The furniture: helpers, the face, the line, the menu |
| `static/js/start.js` | Hunch's side |
| `static/js/plate.js` | The reviewer's side |

## Running it

Locally:

    pip install -r requirements.txt
    python app.py            # http://localhost:5055 — the word is "pink unicorn"

Railway:

- Mount a volume at `/data` and set `WRANGLER_DATA=/data`
- Set `WRANGLER_WORD` (the word Hunch types to start a review)
- `PORT` is set by Railway; the Procfile does the rest

## House rules

- The pages are pictures. The only thing that changes is `pins.json`.
- Speaks second: nobody sees anyone else's pins on a page until they've left one there.
- A name is a lanyard, not a door: asked once, at the first note, kept in the browser.
- Every word on screen lives in `strings.js`.
