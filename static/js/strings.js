/* WRANGLER — the strings.
   Every word on the screen lives here. index.html carries no copy of its
   own; the server sends codes, not sentences. Change the words here.
   These are placeholders in plain English — Michael's words go in. */
const STR = {

  name: "WRANGLER",
  by:   "Made by Hunch",

  /* the parachute — what api() says when the server sent nothing readable */
  fell: "That didn't work. Try again.",

  /* STARTING A REVIEW — Hunch's side, sitting 1 */
  start: {
    title:   "START A REVIEW",
    what:    "What's it called?",
    whatEg:  "Prepay landing page v3",
    drop:    "Drop the work in",
    kinds:   "A PDF, a Word doc, or JPG and PNG pages",
    choose:  "Or click to choose",
    word:    "Magic word",
    go:      "MAKE THE LINK",
    making:  "Making the pages",
    made:    "Here's the link. Send it to whoever needs to have a say.",
    copy:    "COPY LINK",
    copied:  "COPIED",
    open:    "OPEN IT",
    again:   "Start another",
    badword: "That's not the word.",
    nofile:  "Drop the work in first.",
    kind:    "PDF, Word, JPG or PNG only.",
    big:     "Under 40MB please.",
    render:  "Couldn't read that file.",
  },

  /* THE PLATE — what a reviewer sees */
  review: {
    hello:   "Tap anywhere on the work to say what you think.",
    who:     "Your first name",
    say:     "Say what you think",
    save:    "SAVE",
    cancel:  "Cancel",
    bin:     "Bin it",
    edit:    "Change it",
    page:    "Page",
    rail:    "NOTES",
    none:    "No notes yet. Tap the work to leave one.",
    others:  "Other people's notes on a page show once you've left your own.",
    gone:    "This review isn't here. Check the link.",
  },

  /* HOW IT WORKS — the burger card */
  hiw: {
    title: "HOW IT WORKS",
    lines: [
      "Someone sends you a link to a piece of work.",
      "Tap anywhere on it and say what you think. As many times as you like.",
      "You can't change the work. You can only say things about it.",
      "When other people have had their say on the same page, you'll see theirs too.",
    ],
  },
};
