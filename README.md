# AI507 — AI & Society — Exam Drill

An interactive multiple-choice quiz for SDU's AI507 (Artificial Intelligence
and Society) course, covering all 14 lecture sessions with 160 conceptual
questions.

## Files

- **`ai507_quiz.html`** — the quiz app. Open it directly in a browser, or
  serve it with any static file server (e.g. GitHub Pages).
- **`questions.txt`** — the full question bank in plain text, grouped by
  topic, for easy reading and editing.
- **`questions.json`** — the same question bank as structured JSON
  (`{TOPICS: [...], QUESTIONS: [...]}`), useful if you want to script
  changes or regenerate the HTML's embedded array.

## How it works

- Pick topics and a question count, then start.
- Questions and answer options are reshuffled every run.
- Every option — correct or not — has a short explanation, so a wrong
  pick tells you what concept you actually confused it with.
- Results show a per-topic breakdown and let you retry just the missed
  questions.

## Editing questions

The question bank lives embedded in `ai507_quiz.html` as a JS array
(`QUESTIONS`), and is mirrored in `questions.txt` / `questions.json` for
convenience. Each question has 4 options; **option 1 is always the correct
one** — the app shuffles the display order at runtime.

If you edit `questions.txt` or `questions.json`, the changes won't
automatically sync back into the HTML — the HTML's embedded array is the
source of truth for the running app. Treat the `.txt`/`.json` exports as a
readable snapshot for review/version-control purposes, or as a basis for
regenerating the embedded array with a small script.

## No names, no dates

By design, questions test concepts and models — not which researcher
proposed them or when. This matches the exam format (closed-book,
slide-based MCQ).
